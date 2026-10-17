import { describe, expect, it } from 'vitest';
import { crearAgentes, crearAgentesMock, detectarEscenario, modoAgentes, obtenerAgentes } from '@/lib/agents';
import { ESQUEMAS_AGENTE, type Caso } from '@/lib/contracts';
import { casoDe, crearCtx, crearRunAgentFalso } from '@/lib/agents/simulacion';

const rosa = () => casoDe({ origen: 'rosa', destino: 'M-01', senales: ['beneficiario_nuevo', 'monto_atipico', 'llamada_activa'], score: 7 });
const bodega = () => casoDe({ origen: 'pedro', destino: 'BODEGA-DON-PEPE', senales: ['beneficiario_nuevo', 'monto_atipico'], score: 4 });
const lucia = () => casoDe({ origen: 'lucia', destino: 'EXT-99', senales: ['dispositivo_nuevo', 'beneficiario_nuevo'], score: 6 });

describe('mocks (AGENTS_MOCK=1)', () => {
  it('detecta el escenario por los ids', () => {
    expect(detectarEscenario(rosa())).toBe('mula');
    expect(detectarEscenario(bodega())).toBe('bodega');
    expect(detectarEscenario(lucia())).toBe('suplantacion');
    expect(detectarEscenario(casoDe({ destino: 'AMIGO' }))).toBe('neutral');
  });

  it('acto de Rosa de punta a punta: todas las salidas cumplen su esquema', async () => {
    const mocks = crearAgentesMock();
    const pack = crearCtx({});
    let caso: Caso = rosa();

    const coord = await mocks.coordinador(caso, pack.ctx);
    expect(coord.salida.invocar).toEqual(['guardian', 'detective']);
    expect(ESQUEMAS_AGENTE.coordinador.safeParse(coord.salida).success).toBe(true);

    const det = await mocks.detective(caso, pack.ctx);
    expect(det.salida.riesgo_destino).toBe('alto');
    expect(det.salida.cadena).toEqual(['M-01', 'M-02', 'M-03']);
    expect(ESQUEMAS_AGENTE.detective.safeParse(det.salida).success).toBe(true);

    const g1 = await mocks.guardianTurno(caso, pack.ctx);
    expect(g1.salida.terminado).toBe(false);
    const g2 = await mocks.guardianTurno(caso, pack.ctx, 'Sí, el banco');
    expect(g2.salida.salida?.estado_usuario).toBe('manipulacion_probable');
    expect(ESQUEMAS_AGENTE.guardian.safeParse(g2.salida.salida).success).toBe(true);

    caso = { ...caso, evidencia: pack.ledger.todas, salidas: { detective: det.salida } };
    const aud = await mocks.auditor(caso, pack.ctx);
    expect(aud.salida.recomendacion).toBe('escalar');
    expect(aud.salida.afirmaciones.length).toBeGreaterThan(0);
    expect(ESQUEMAS_AGENTE.auditor.safeParse(aud.salida).success).toBe(true);
    expect(aud.uso.llamadas + det.uso.llamadas + coord.uso.llamadas).toBe(0); // sin gastar IA
  });

  it('Bodega → bajo (el control de falsos positivos del demo)', async () => {
    const det = await crearAgentesMock().detective(bodega(), crearCtx({}).ctx);
    expect(det.salida.riesgo_destino).toBe('bajo');
    expect(det.salida.tipologias).toEqual(['fan_in']);
  });

  it('Lucía: sin respuesta o canal comprometido, y el atacante no se ve como mula', async () => {
    const mocks = crearAgentesMock();
    const pack = crearCtx({});
    const g = await mocks.guardianTurno(lucia(), pack.ctx, '');
    expect(g.salida.salida?.estado_usuario).toBe('canal_comprometido');
    const det = await mocks.detective(lucia(), pack.ctx);
    expect(det.salida.riesgo_destino).toBe('bajo');
  });

  it('funcionan sin ctx de Ale (ids locales)', async () => {
    const det = await crearAgentesMock().detective(rosa(), undefined as never);
    expect(det.salida.evidencia).toEqual(['E-01', 'E-02', 'E-03']);
  });

  it('los mocks y los agentes reales dan la misma decisión de riesgo para M-01', async () => {
    const mocks = crearAgentesMock();
    const real = crearAgentes({ runAgent: crearRunAgentFalso().runAgent });
    const hallazgos = {
      perfil: { cuenta: 'M-01', banco_propio: true, antiguedad_dias: 12, tipo: 'persona' as const },
      listas: { cuenta: 'M-01', en_lista: false, listas: [] },
      fan_in: { cuenta: 'M-01', remitentes_nuevos: 14, ventana_horas: 48, marcado: true },
      reenvio: { cuenta: 'M-01', porcentaje_reenviado: 0.91, ventana_horas: 2, destinos: ['M-02', 'M-03'], marcado: true },
    };
    const a = await mocks.detective(rosa(), crearCtx({}).ctx);
    const b = await real.detective(rosa(), crearCtx({ hallazgos }).ctx);
    expect(a.salida.riesgo_destino).toBe(b.salida.riesgo_destino);
    expect(a.salida.tipologias).toEqual(b.salida.tipologias);
  });
});

describe('obtenerAgentes', () => {
  it('AGENTS_MOCK=1 no necesita API key', () => {
    expect(() => obtenerAgentes({ AGENTS_MOCK: '1' } as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });
  it('sin key → modo simulado (agentes reales + LLM simulado), nunca rompe', () => {
    expect(modoAgentes({} as unknown as NodeJS.ProcessEnv)).toBe('simulado');
    expect(modoAgentes({ ANTHROPIC_API_KEY: 'sk-ant-...' } as unknown as NodeJS.ProcessEnv)).toBe('simulado');
    expect(modoAgentes({ ANTHROPIC_API_KEY: 'sk-ant-real' } as unknown as NodeJS.ProcessEnv)).toBe('claude');
    expect(() => obtenerAgentes({} as unknown as NodeJS.ProcessEnv)).not.toThrow();
  });
});
