import { beforeEach, describe, expect, it } from 'vitest';
import { decide } from '@/lib/policy/engine';
import { evaluarAlerta, evaluarTransferencia } from '@/lib/pipeline';
import { storeCasos } from '@/lib/cases/store';
import { memoria } from '@/lib/memory/store';
import { BANCO_PROPIO, red } from '@/lib/memory/red';
import { crearAgentesMock, fichaCompartible } from '@/lib/agents';
import { riesgoBase, requiereLLMDetective } from '@/lib/agents/decisiones/detective';
import { decidirCoordinador } from '@/lib/agents/decisiones/coordinador';
import { analytics } from '@/lib/analytics';
import { crearVeredicto } from '@/lib/memory/store';
import { repo } from '@/lib/data/repo';

/**
 * 🌎 Red regional: una mula confirmada por un banco protege a los clientes
 * de otro banco y otro país, con confianza graduada y sin compartir datos
 * del cliente.
 */
describe('Red regional · política (confianza graduada)', () => {
  it('veredicto de otro banco solo → PAUSAR por P1R, nunca escala ni libera', () => {
    expect(decide({ mulaEnMemoria: false, mulaEnRed: true, score: 2 })).toMatchObject({ accion: 'PAUSAR', regla: 'P1R' });
    expect(decide({ mulaEnMemoria: false, mulaEnRed: true, score: 0, atajo: 'P2' })).toMatchObject({ regla: 'P1R' });
    expect(decide({ mulaEnMemoria: false, mulaEnRed: true, score: 7, riesgoDestino: 'bajo', estadoUsuario: 'confirmado_seguro' })).toMatchObject({ accion: 'PAUSAR', regla: 'P1R' });
  });
  it('veredicto de otro banco + cliente en riesgo → ESCALAR por P1R', () => {
    expect(decide({ mulaEnMemoria: false, mulaEnRed: true, score: 5, estadoUsuario: 'manipulacion_probable' })).toMatchObject({ accion: 'ESCALAR', regla: 'P1R' });
  });
  it('con evidencia propia de riesgo alto escala por P4/P5, no por la red', () => {
    expect(decide({ mulaEnMemoria: false, mulaEnRed: true, score: 5, riesgoDestino: 'alto' })).toMatchObject({ accion: 'ESCALAR', regla: 'P5' });
  });
  it('el veredicto PROPIO sigue ganando: P1 antes que P1R', () => {
    expect(decide({ mulaEnMemoria: true, mulaEnRed: true, score: 5 })).toMatchObject({ regla: 'P1' });
  });
});

describe('Red regional · agentes', () => {
  it('Coordinador: la red anula el atajo del beneficiario habitual y llama a ambos', () => {
    const s = decidirCoordinador({ puerta: 'transferencia', score: 0, senales: [], atajo: 'P2', memoria_hit: false, destino_conocido_limpio: true, red_hit: true });
    expect(s).toMatchObject({ salida_temprana: false, invocar: ['guardian', 'detective'] });
  });
  it('Coordinador: destino en otro país siempre pasa por el Detective', () => {
    const s = decidirCoordinador({ puerta: 'transferencia', score: 2, senales: ['monto_atipico'], memoria_hit: false, destino_conocido_limpio: true, destino_extranjero: true });
    expect(s.invocar).toContain('detective');
  });
  it('Detective: en_red sola es medio y no gasta IA; con hallazgo propio es alto', () => {
    expect(riesgoBase(['en_red'], false)).toBe('medio');
    expect(requiereLLMDetective('medio', ['en_red'])).toBe(false);
    expect(riesgoBase(['en_red', 'fan_in'], false)).toBe('alto');
  });
  it('Detective: reenvío rápido al exterior es mula regional (alto); reenvío solo sigue en medio', () => {
    expect(riesgoBase(['reenvio_rapido', 'transfronterizo'])).toBe('alto');
    expect(riesgoBase(['reenvio_rapido'])).toBe('medio');
  });
  it('analytics: M-04 saca el 88% a Colombia y Bolivia en menos de 2 h', () => {
    const t = analytics.reenvioTransfronterizo('M-04');
    expect(t.marcado).toBe(true);
    expect(t.porcentaje_al_exterior).toBeCloseTo(0.88, 2);
    expect(t.destinos.map((d) => d.pais).sort()).toEqual(['bo', 'co']);
    expect(analytics.reenvioTransfronterizo('M-01').marcado).toBe(false); // M-01 reenvía dentro de Perú
  });
});

describe('Red regional · de punta a punta', () => {
  beforeEach(() => {
    storeCasos.limpiar();
    memoria.limpiar();
    red.reiniciar();
  });

  it('CU-06: Ana (Perú) transfiere a una mula que confirmó un banco de Colombia → retenida por P1R', async () => {
    const { caso } = await evaluarTransferencia(
      { origen: 'C-ANA', destino: 'CO-M-11', monto: 2500, moneda: 'PEN' },
      { agentes: crearAgentesMock() },
    );
    expect(caso.decision?.regla).toBe('P1R');
    expect(caso.decision?.accion).not.toBe('PERMITIR');
    const eventos = caso.timeline.map((e) => e.evento);
    // La retención ocurre antes de cualquier agente.
    expect(eventos.indexOf('mula_confirmada_en_red')).toBeLessThan(eventos.indexOf('plan'));
    expect(eventos).toContain('pausa_preventiva');
  });

  it('CU-07: alerta sobre M-04 → mula regional, y la ficha que se publica no lleva nada del cliente', async () => {
    const { caso } = await evaluarAlerta('M-04', 'reenvío al exterior', { agentes: crearAgentesMock() });
    expect(caso.decision?.accion).toBe('ESCALAR');

    const ficha = fichaCompartible(caso);
    expect(ficha.cuenta).toBe('M-04');
    expect(ficha.basado_en_red).toBe(false);
    expect(ficha.afirmaciones.every((a) => !/titular|respondi/i.test(a.texto))).toBe(true);

    const publicado = red.publicar(
      crearVeredicto({ cuenta: 'M-04', veredicto: 'mula_confirmada', validado_por: 'analista-pe-01', expediente: caso.id, hoy: repo.ahora() }),
      ficha,
    );
    expect(publicado?.veredicto.emisor).toEqual(BANCO_PROPIO);
    expect(red.todos().map((r) => r.veredicto.emisor.pais).sort()).toEqual(['co', 'pe']);
    // Lo propio no se cuenta como «de otro banco»: no hay eco hacia la propia Memoria.
    expect(red.esMulaDeOtroBanco('M-04', repo.ahora())).toBe(false);
  });

  it('la red exige un humano (R10) y el descarte retira la publicación propia', () => {
    const base = { cuenta: 'M-04', veredicto: 'mula_confirmada' as const, expediente: 'CASO-0001', hoy: repo.ahora() };
    expect(() => red.publicar({ ...crearVeredicto({ ...base, validado_por: 'x' }), validado_por: ' ' })).toThrow(/R10/);
    red.publicar(crearVeredicto({ ...base, validado_por: 'analista' }));
    expect(red.cantidad).toBe(2);
    red.publicar(crearVeredicto({ ...base, veredicto: 'descartada', validado_por: 'analista' }));
    expect(red.cantidad).toBe(1);
  });
});

describe('Cuentas de otra entidad: no se afirma lo que no se ve (19 §10)', () => {
  beforeEach(() => {
    storeCasos.limpiar();
    memoria.limpiar();
    red.reiniciar();
  });

  it('el reenvío de una cuenta externa no es observable', () => {
    expect(analytics.reenvioRapido('CO-M-11').observable).toBe(false);
    expect(analytics.reenvioRapido('M-01').observable).toBe(true);
  });

  it('CU-06: el expediente no dice «Reenvió el 0%» sobre la cuenta colombiana', async () => {
    const { caso } = await evaluarTransferencia(
      { origen: 'C-ANA', destino: 'CO-M-11', monto: 2500, moneda: 'PEN' },
      // Agentes del despliegue (simulados): el mock trae hallazgos fijos y no pasa por las analytics.
      { respuestaCliente: 'sí' },
    );
    const textos = (caso.salidas.auditor?.afirmaciones ?? []).map((a) => a.texto);
    expect(textos.some((t) => /Reenvió el 0%/.test(t))).toBe(false);
    expect(textos.some((t) => /No se ven las salidas de la cuenta CO-M-11/.test(t))).toBe(true);
  });
});
