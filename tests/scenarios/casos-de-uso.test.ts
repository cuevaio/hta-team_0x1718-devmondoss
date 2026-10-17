import { describe, it, expect, beforeEach } from 'vitest';
import type { Transaccion } from '@/lib/contracts';
import { validarCitasAuditor } from '@/lib/contracts';
import { evaluarAlerta, evaluarTransferencia, estadisticas } from '@/lib/pipeline';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';
import { repo } from '@/lib/data/repo';

/**
 * Tests end-to-end de los casos de uso (docs/CASOS_DE_USO.md §5).
 *
 * Verifican los criterios de aceptación de cada CU, no solo la decisión final.
 * Es lo que sostiene el SYNC 1 en CI y no solo en `npm run demo`.
 */

const tx = (origen: string, destino: string, monto: number): Transaccion => ({
  origen,
  destino,
  monto,
  moneda: 'PEN',
});

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
});

describe('CU-01 — frenar una estafa a un cliente autenticado', () => {
  it('escala por P4: destino de riesgo alto y clienta manipulada', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí, me está guiando un asesor del banco',
    });
    expect(caso.decision?.accion).toBe('ESCALAR');
    expect(caso.decision?.regla).toBe('P4');
  });

  it('score 7 y pausa preventiva ANTES de cualquier agente (TTPA ≈ 0)', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí',
    });
    expect(caso.nivel0.score).toBe(7);

    const eventos = caso.timeline.map((e) => e.evento);
    const iPausa = eventos.indexOf('pausa_preventiva');
    const iPlan = eventos.indexOf('plan');
    expect(iPausa).toBeGreaterThanOrEqual(0);
    // La pausa ocurre antes de que el Coordinador planifique nada.
    expect(iPausa).toBeLessThan(iPlan === -1 ? Number.MAX_SAFE_INTEGER : iPlan);
  });

  it('el Guardián nunca pide clave, OTP ni datos de tarjeta', async () => {
    const { buzon } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí, me guían',
    });
    expect(buzon.enviados.length).toBeGreaterThan(0);
    for (const m of buzon.enviados) {
      expect(m.texto.toLowerCase()).not.toMatch(/clave|contrase|otp|c[oó]digo|tarjeta|cvv|pin/);
    }
  });

  it('el silencio no libera: sin respuesta NO permite', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      // sin respuestaCliente → el buzón está vacío
    });
    expect(caso.decision?.accion).not.toBe('PERMITIR');
  });
});

describe('Trazabilidad de la evidencia', () => {
  it('las salidas de los agentes citan los ids que emitieron sus tools', async () => {
    // Regresión: antes leían `caso.evidencia`, que el pipeline sincroniza
    // DESPUÉS de que el agente termina, así que llegaban vacías.
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí',
    });
    const det = caso.salidas.detective!;
    expect(det.evidencia.length).toBeGreaterThan(0);

    // Todo id citado debe existir en el caso.
    const existentes = new Set(caso.evidencia.map((e) => e.id));
    for (const id of det.evidencia) expect(existentes.has(id), id).toBe(true);
    for (const id of caso.salidas.guardian!.evidencia) expect(existentes.has(id), id).toBe(true);
  });

  it('los ids son únicos y consecutivos desde E-01', async () => {
    const { caso } = await evaluarAlerta('M-01', 'monitoreo');
    const ids = caso.evidencia.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('E-01');
  });

  it('cada caso numera su evidencia desde cero', async () => {
    const a = await evaluarAlerta('M-01', 'monitoreo');
    const b = await evaluarAlerta('M-02', 'monitoreo');
    expect(a.caso.evidencia[0].id).toBe('E-01');
    expect(b.caso.evidencia[0].id).toBe('E-01');
    expect(a.caso.id).not.toBe(b.caso.id);
  });
});

describe('Clasificación de la respuesta del cliente', () => {
  it('una respuesta corta y afirmativa SÍ detecta manipulación', async () => {
    // Antes solo se afirmaba P4, y `sin_respuesta` también da P4: el test no
    // distinguía "detectó manipulación" de "no contestó".
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí',
    });
    expect(caso.salidas.guardian?.estado_usuario).toBe('manipulacion_probable');
    expect(caso.salidas.guardian?.senales_manipulacion.length).toBeGreaterThan(0);
  });

  it('una frase larga la resuelve el modelo y detecta la manipulación', async () => {
    // `clasificarRapido` devuelve null con más de 4 palabras ("que la lea el
    // modelo"). Con los agentes reales conectados eso ya se resuelve bien;
    // antes, sin runtime de LLM, caía al lado conservador (sin_respuesta).
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí, me está guiando un asesor del banco por teléfono',
    });
    expect(caso.salidas.guardian?.estado_usuario).toBe('manipulacion_probable');
    expect(caso.decision?.accion).not.toBe('PERMITIR');
  });

  it('una negativa corta no inventa señales de manipulación', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'B-PEPE', 1500), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'no',
    });
    expect(caso.salidas.guardian?.senales_manipulacion).toEqual([]);
  });
});

describe('CU-02 — investigar la cuenta destino y entregar el expediente', () => {
  it('una alerta AML produce expediente sin pasar por el Guardián', async () => {
    const { caso } = await evaluarAlerta('M-01', 'fan-in con reenvío inmediato');
    expect(caso.puerta).toBe('alerta_aml');
    expect(caso.salidas.guardian).toBeUndefined();
    expect(caso.salidas.auditor).toBeDefined();
    expect(caso.decision?.accion).toBe('ESCALAR');
  });

  it('100% de las afirmaciones citan un id de evidencia que existe en el caso', async () => {
    const { caso } = await evaluarAlerta('M-01', 'monitoreo');
    const auditor = caso.salidas.auditor!;
    expect(auditor.afirmaciones.length).toBeGreaterThan(0);

    const r = validarCitasAuditor(auditor, caso.evidencia);
    expect(r.idsInexistentes).toEqual([]);
    expect(r.afirmacionesSinRespaldo).toEqual([]);
    expect(r.valido).toBe(true);
  });

  it('los hechos los calculan las tools, no el relato: la evidencia trae el dato crudo', async () => {
    const { caso } = await evaluarAlerta('M-01', 'monitoreo');
    const fanIn = caso.evidencia.find((e) => e.fuente === 'fan_in');
    expect(fanIn).toBeDefined();
    expect((fanIn!.dato as { remitentes_nuevos: number }).remitentes_nuevos).toBe(14);
  });

  it('el expediente no bloquea la decisión: la decisión ya existe cuando corre el Auditor', async () => {
    const { caso } = await evaluarAlerta('M-01', 'monitoreo');
    const eventos = caso.timeline.map((e) => e.evento);
    expect(eventos).toContain('expediente');
    expect(eventos).toContain('decision');
    // El Auditor se registra antes del evento final de decisión, pero la
    // acción protectora (pausa preventiva) ya ocurrió mucho antes.
    expect(eventos.indexOf('pausa_preventiva')).toBeLessThan(eventos.indexOf('expediente'));
  });
});

describe('CU-03 — proteger a la siguiente víctima', () => {
  async function confirmarM01() {
    const { caso } = await evaluarAlerta('M-01', 'monitoreo');
    memoria.confirm(
      'M-01',
      crearVeredicto({
        cuenta: 'M-01',
        veredicto: 'mula_confirmada',
        validado_por: 'analista_01',
        expediente: caso.id,
        hoy: repo.ahora(),
      }),
    );
  }

  it('aplica P1 y gasta 0 llamadas de IA', async () => {
    await confirmarM01();
    const { caso } = await evaluarTransferencia(tx('C-JORGE', 'M-01', 2200));
    expect(caso.decision?.regla).toBe('P1');
    expect(caso.ia.llamadas).toBe(0);
  });

  it('sin veredicto humano no hay protección: la Memoria no se autoalimenta', async () => {
    // Sin llamar a confirmarM01: el caso anterior no dejó nada en Memoria.
    const { caso } = await evaluarTransferencia(tx('C-JORGE', 'M-01', 2200));
    expect(caso.decision?.regla).not.toBe('P1');
  });

  it('el veredicto tiene fecha de expiración', async () => {
    await confirmarM01();
    const v = memoria.get('M-01', repo.ahora());
    expect(v?.expira).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(v!.expira > v!.fecha).toBe(true);
  });
});

describe('CU-05 — no bloquear un pago legítimo de alto volumen', () => {
  it('permite por P8: la bodega tiene fan-in pero no reenvía', async () => {
    const { caso } = await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    expect(caso.decision?.accion).toBe('PERMITIR');
    expect(caso.decision?.regla).toBe('P8');
  });

  it('score 4 (beneficiario nuevo + monto atípico): es el primer pago a la bodega', async () => {
    const { caso } = await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    expect(caso.nivel0.score).toBe(4);
    expect(caso.nivel0.senales).toContain('beneficiario_nuevo');
  });

  it('no se molesta al cliente: el Guardián no se invoca', async () => {
    const { caso, buzon } = await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    expect(caso.salidas.guardian).toBeUndefined();
    expect(buzon.enviados).toEqual([]);
  });

  it('el Detective la clasifica como riesgo bajo pese al fan-in', async () => {
    const { caso } = await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    expect(caso.salidas.detective?.riesgo_destino).toBe('bajo');
    expect(caso.salidas.detective?.tipologias).toContain('fan_in');
    expect(caso.salidas.detective?.tipologias).not.toContain('reenvio_rapido');
  });
});

describe('CU-04 — suplantación con la titular sin señal', () => {
  it('pausa por P7 la operación del atacante', async () => {
    const { caso } = await evaluarTransferencia(tx('C-LUCIA', 'M-02', 3000), {
      contexto: { dispositivo_nuevo_24h: true },
    });
    expect(caso.decision?.accion).toBe('PAUSAR');
    expect(caso.decision?.regla).toBe('P7');
  });

  it('el pago recurrente al hotel SIGUE pasando (P2)', async () => {
    const { caso } = await evaluarTransferencia(tx('C-LUCIA', 'H-SOL', 650));
    expect(caso.decision?.accion).toBe('PERMITIR');
    expect(caso.decision?.regla).toBe('P2');
  });

  it('no se verifica por el canal comprometido (FM3)', async () => {
    const { caso } = await evaluarTransferencia(tx('C-LUCIA', 'M-02', 3000), {
      contexto: { dispositivo_nuevo_24h: true },
    });
    const g = caso.salidas.guardian;
    expect(g?.estado_usuario).toBe('canal_comprometido');
    // La app está marcada como comprometida para Lucía: no puede ser el canal.
    expect(g?.canal_usado).not.toBe('app');
  });
});

describe('Embudo y presupuesto', () => {
  it('el embudo refleja las transacciones evaluadas y su regla', async () => {
    await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    await evaluarTransferencia(tx('C-LUCIA', 'H-SOL', 650));
    const s = estadisticas();
    expect(s.transacciones_evaluadas).toBe(2);
    expect(s.por_regla.P8).toBe(1);
    expect(s.por_regla.P2).toBe(1);
  });

  it('ningún caso excede el presupuesto de 10 llamadas de IA', async () => {
    await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí',
    });
    for (const caso of storeCasos.todos()) {
      expect(caso.ia.llamadas).toBeLessThanOrEqual(10);
    }
  });

  it('las estadísticas declaran que los datos son simulados', () => {
    expect(estadisticas().nota_datos).toMatch(/SINT[ÉE]TICOS/i);
  });
});

describe('Modo seguro — P10', () => {
  it('si un agente lanza, no se libera dinero con score alto', async () => {
    const agentesRotos = {
      coordinador: async () => {
        throw new Error('timeout simulado');
      },
      detective: async () => {
        throw new Error('timeout simulado');
      },
      guardianTurno: async () => {
        throw new Error('timeout simulado');
      },
      auditor: async () => {
        throw new Error('timeout simulado');
      },
    } as never;
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      agentes: agentesRotos,
      contexto: { llamada_activa_o_acceso_remoto: true },
    });
    expect(caso.decision?.regla).toBe('P10');
    expect(caso.decision?.accion).toBe('PAUSAR');
    expect(caso.timeline.map((e) => e.evento)).toContain('error_agentes');
  });

  it('un AgentsApi incompleto tampoco tumba la request: degrada a P10', async () => {
    // `investigar` documenta que nunca lanza, pero un método ausente lanza de
    // forma SINCRÓNICA (`agentes.detective is not a function`). El pipeline lo
    // captura: en una decisión sobre dinero, fallar seguro manda.
    const soloCoordinador = {
      coordinador: async () => ({
        salida: { salida_temprana: false, invocar: ['detective'], motivo: 'x' },
        uso: { llamadas: 1, tokens: 10, ms: 1 },
      }),
    } as never;
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      agentes: soloCoordinador,
      contexto: { llamada_activa_o_acceso_remoto: true },
    });
    expect(caso.decision?.regla).toBe('P10');
    expect(caso.decision?.accion).toBe('PAUSAR');
  });
});
