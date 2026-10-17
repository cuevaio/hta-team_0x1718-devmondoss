import { describe, expect, it } from 'vitest';
import {
  acumularIA,
  auditar,
  continuarGuardian,
  crearAgentes,
  crearAgentesMock,
  debeAuditar,
  investigar,
} from '@/lib/agents';
import type { AgentsApi, Caso } from '@/lib/contracts';
import type { Hallazgos } from '@/lib/agents/decisiones/detective';
import { casoDe, crearCtx, crearRunAgentFalso } from '@/lib/agents/simulacion';

const m01: Hallazgos = {
  perfil: { cuenta: 'M-01', banco_propio: true, antiguedad_dias: 12, tipo: 'persona' },
  listas: { cuenta: 'M-01', en_lista: false, listas: [] },
  fan_in: { cuenta: 'M-01', remitentes_nuevos: 14, ventana_horas: 48, marcado: true },
  reenvio: { cuenta: 'M-01', porcentaje_reenviado: 0.91, ventana_horas: 2, destinos: ['M-02', 'M-03'], marcado: true },
};
const rosa = () => casoDe({ origen: 'rosa', destino: 'M-01', senales: ['beneficiario_nuevo', 'monto_atipico', 'llamada_activa'], score: 7 });

describe('orquestador', () => {
  it('Rosa con agentes reales: investigar → guardián pregunta → responde → auditar = 1 llamada de LLM en total', async () => {
    const pack = crearCtx({ hallazgos: m01 });
    const { runAgent, calls } = crearRunAgentFalso({
      auditor: {
        resumen: 'Transferencia guiada por teléfono hacia cuenta con patrón de mula.',
        hipotesis: 'estafa_vishing_mula',
        recomendacion: 'escalar',
        indices_afirmaciones: [0, 1, 2],
        acciones: ['confirmar_mula'],
        confianza: 'alta',
      },
    });
    const agentes = crearAgentes({ runAgent });

    let caso: Caso = rosa();
    const inv = await investigar(caso, pack.ctx, agentes);
    expect(inv.errores).toEqual([]);
    expect(inv.salidas.coordinador?.invocar).toEqual(['guardian', 'detective']);
    expect(inv.salidas.detective?.riesgo_destino).toBe('alto');
    expect(inv.turnoGuardian).toMatchObject({ terminado: false });
    expect(inv.salidas.guardian).toBeUndefined();

    caso = { ...caso, evidencia: [...pack.ledger.todas], salidas: { ...caso.salidas, ...inv.salidas } };
    const t = await continuarGuardian(caso, pack.ctx, agentes, 'Sí, el banco');
    expect(t.turno?.salida?.estado_usuario).toBe('manipulacion_probable');

    caso = {
      ...caso,
      evidencia: [...pack.ledger.todas],
      salidas: { ...caso.salidas, guardian: t.turno!.salida },
      decision: { accion: 'ESCALAR', regla: 'P4', t: new Date().toISOString() },
    };
    expect(debeAuditar(caso)).toBe(true);
    const a = await auditar(caso, pack.ctx, agentes);
    expect(a.salida?.requiere_revision_manual).toBe(false);

    expect(calls.map((c) => c.nombre)).toEqual(['auditor']); // playbook §7: Rosa = 1–2 llamadas
    const ia = acumularIA({ llamadas: 0, tokens: 0, costo_estimado: 0 }, { ...inv.uso, guardian: t.uso, auditor: a.uso });
    expect(ia.llamadas).toBe(1);
    expect(ia.costo_estimado).toBeGreaterThan(0);
  });

  it('salida temprana (Jorge) → no invoca especialistas', async () => {
    const pack = crearCtx({});
    const caso = casoDe({ origen: 'jorge', destino: 'M-01', senales: ['beneficiario_nuevo'], score: 4, atajo: 'P1' });
    const r = await investigar(caso, pack.ctx, crearAgentesMock());
    expect(r.salidas.coordinador?.salida_temprana).toBe(true);
    expect(r.salidas.detective).toBeUndefined();
    expect(r.turnoGuardian).toBeNull();
  });

  it('un agente que lanza no tumba la investigación: queda en errores (→ P10)', async () => {
    const base = crearAgentesMock();
    const roto: AgentsApi = { ...base, detective: async () => { throw new Error('boom'); } };
    const r = await investigar(rosa(), crearCtx({}).ctx, roto);
    expect(r.errores).toEqual([{ agente: 'detective', mensaje: 'boom' }]);
    expect(r.salidas.detective).toBeUndefined();
    expect(r.turnoGuardian).not.toBeNull();
  });

  it('a la AgentsApi le falta un método → error capturado, no tumba la request (reporte de Ale)', async () => {
    const base = crearAgentesMock();
    const incompleto = { ...base, detective: undefined } as unknown as AgentsApi;
    const r = await investigar(rosa(), crearCtx({}).ctx, incompleto);
    expect(r.errores.map((e) => e.agente)).toEqual(['detective']);
    expect(r.salidas.detective).toBeUndefined();
  });

  it('coordinador caído → se invoca a ambos (conservador)', async () => {
    const base = crearAgentesMock();
    const roto: AgentsApi = { ...base, coordinador: async () => { throw new Error('x'); } };
    const r = await investigar(rosa(), crearCtx({}).ctx, roto);
    expect(r.salidas.coordinador?.invocar).toEqual(['guardian', 'detective']);
  });

  it('debeAuditar: solo pausa/escala o alerta AML', () => {
    const t = new Date().toISOString();
    expect(debeAuditar({ ...rosa(), decision: { accion: 'PERMITIR', regla: 'P8', t } })).toBe(false);
    expect(debeAuditar({ ...rosa(), decision: { accion: 'PAUSAR', regla: 'P7', t } })).toBe(true);
    expect(debeAuditar(casoDe({ destino: 'M-01', puerta: 'alerta_aml' }))).toBe(true);
  });

  it('acumularIA: el Auditor (capaz) cuesta más por token que el resto', () => {
    const u = { llamadas: 1, tokens: 1000, ms: 1 };
    const a = acumularIA({ llamadas: 0, tokens: 0, costo_estimado: 0 }, { auditor: u });
    const d = acumularIA({ llamadas: 0, tokens: 0, costo_estimado: 0 }, { detective: u });
    expect(a.costo_estimado).toBeGreaterThan(d.costo_estimado);
  });
});
