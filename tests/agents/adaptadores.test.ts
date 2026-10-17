import { describe, expect, it } from 'vitest';
import { auditor } from '@/lib/agents/auditor';
import { coordinador } from '@/lib/agents/coordinador';
import { detective } from '@/lib/agents/detective';
import { guardianTurno } from '@/lib/agents/guardian';
import { BANCO_PREGUNTAS } from '@/lib/agents/decisiones/guardian';
import type { Hallazgos } from '@/lib/agents/decisiones/detective';
import { ESQUEMAS_AGENTE } from '@/lib/contracts';
import { casoDe, crearCtx, crearRunAgentFalso } from '@/lib/agents/simulacion';

const m01: Hallazgos = {
  perfil: { cuenta: 'M-01', banco_propio: true, antiguedad_dias: 12, tipo: 'persona' },
  listas: { cuenta: 'M-01', en_lista: false, listas: [] },
  fan_in: { cuenta: 'M-01', remitentes_nuevos: 14, ventana_horas: 48, marcado: true },
  reenvio: { cuenta: 'M-01', porcentaje_reenviado: 0.91, ventana_horas: 2, destinos: ['M-02', 'M-03'], marcado: true },
};
const bodega: Hallazgos = {
  perfil: { cuenta: 'BODEGA', banco_propio: true, antiguedad_dias: 900, tipo: 'comercio' },
  listas: { cuenta: 'BODEGA', en_lista: false, listas: [] },
  fan_in: { cuenta: 'BODEGA', remitentes_nuevos: 40, ventana_horas: 48, marcado: true },
  reenvio: { cuenta: 'BODEGA', porcentaje_reenviado: 0.05, ventana_horas: 2, destinos: [], marcado: false },
};

describe('🔍 Detective (adaptador)', () => {
  it('Rosa → M-01: riesgo alto con 0 llamadas de LLM y cadena completa', async () => {
    const { ctx, llamadas } = crearCtx({ hallazgos: m01 });
    const { runAgent, calls } = crearRunAgentFalso();
    const r = await detective(casoDe({ destino: 'M-01' }), ctx, { runAgent });
    expect(calls).toHaveLength(0);
    expect(r.salida.riesgo_destino).toBe('alto');
    expect(r.salida.tipologias).toEqual(['fan_in', 'reenvio_rapido']);
    expect(r.salida.cadena).toEqual(['M-01', 'M-02', 'M-03']); // 2 saltos, solo tools
    expect(r.salida.evidencia.length).toBeGreaterThanOrEqual(5);
    expect(llamadas).toContain('ciclos'); // paso 2 porque el reenvío salió marcado
    expect(r.uso.llamadas).toBe(0);
    expect(ESQUEMAS_AGENTE.detective.safeParse(r.salida).success).toBe(true);
  });

  it('Bodega → 1 llamada de LLM, que la baja a bajo', async () => {
    const { ctx, llamadas } = crearCtx({ hallazgos: bodega });
    const { runAgent, calls } = crearRunAgentFalso({
      detective: { riesgo_destino: 'bajo', hipotesis: 'Comercio con alto volumen y sin reenvío', evidencia: ['E-03'] },
    });
    const r = await detective(casoDe({ destino: 'BODEGA' }), ctx, { runAgent });
    expect(calls).toHaveLength(1);
    expect(calls[0].nombre).toBe('detective');
    expect(r.salida.riesgo_destino).toBe('bajo');
    expect(llamadas).not.toContain('ciclos'); // sin reenvío marcado no se pide el paso 2
  });

  it('Bodega con LLM caído → se queda en medio (modo seguro)', async () => {
    const { ctx } = crearCtx({ hallazgos: bodega });
    const { runAgent } = crearRunAgentFalso({}, true);
    const r = await detective(casoDe({ destino: 'BODEGA' }), ctx, { runAgent });
    expect(r.salida.riesgo_destino).toBe('medio');
    expect(r.uso.llamadas).toBe(1);
  });

  it('el briefing al LLM es corto y no lleva transacciones crudas', async () => {
    const { ctx } = crearCtx({ hallazgos: bodega });
    const { runAgent, calls } = crearRunAgentFalso({
      detective: { riesgo_destino: 'medio', hipotesis: 'x', evidencia: [] },
    });
    await detective(casoDe({ destino: 'BODEGA' }), ctx, { runAgent });
    expect(JSON.stringify(calls[0].input).length).toBeLessThan(900);
  });

  it('sin tools disponibles → medio conservador, sin llamar al LLM', async () => {
    const { ctx } = crearCtx({ sinTools: true });
    const { runAgent, calls } = crearRunAgentFalso();
    const r = await detective(casoDe({ destino: 'M-01' }), ctx, { runAgent });
    expect(calls).toHaveLength(0);
    expect(r.salida.riesgo_destino).toBe('medio');
    expect(r.salida.hipotesis).toContain('No se pudo analizar');
  });

  it('reutiliza el perfil que ya está en el caso', async () => {
    const { ctx, llamadas } = crearCtx({ hallazgos: m01 });
    const caso = casoDe({
      destino: 'M-01',
      evidencia: [{ id: 'E-90', fuente: 'perfil_cuenta', dato: m01.perfil }],
    });
    const { runAgent } = crearRunAgentFalso();
    await detective(caso, ctx, { runAgent });
    expect(llamadas).not.toContain('perfil_cuenta');
  });
});

describe('🧭 Coordinador (adaptador)', () => {
  it('Jorge: mula en Memoria → salida temprana sin tocar tools', async () => {
    const v = { cuenta: 'M-01', veredicto: 'mula_confirmada' as const, validado_por: 'a1', fecha: '2026-10-17', expira: '2099-01-01', expediente: 'CASO-0001', apelacion_abierta: false };
    const { ctx, llamadas } = crearCtx({ memoria: { 'M-01': v } });
    const r = await coordinador(casoDe({ origen: 'jorge', destino: 'M-01', senales: ['beneficiario_nuevo'], score: 4 }), ctx);
    expect(r.salida).toMatchObject({ salida_temprana: true, invocar: [] });
    expect(llamadas).toHaveLength(0);
    expect(r.uso.llamadas).toBe(0);
  });
  it('veredicto vencido no cuenta como Memoria', async () => {
    const v = { cuenta: 'M-01', veredicto: 'mula_confirmada' as const, validado_por: 'a1', fecha: '2025-01-01', expira: '2025-04-01', expediente: 'CASO-0001', apelacion_abierta: false };
    const { ctx } = crearCtx({ memoria: { 'M-01': v } });
    const r = await coordinador(casoDe({ destino: 'M-01', senales: ['beneficiario_nuevo', 'monto_atipico'], score: 4 }), ctx);
    expect(r.salida.salida_temprana).toBe(false);
  });
  it('destino que el cliente ya conocía (no es beneficiario nuevo) → no se invoca al detective', async () => {
    const { ctx } = crearCtx({ hallazgos: { perfil: { cuenta: 'AMIGO', banco_propio: true, antiguedad_dias: 700, tipo: 'persona' } } });
    const r = await coordinador(casoDe({ destino: 'AMIGO', senales: ['monto_atipico', 'llamada_activa'], score: 5 }), ctx);
    expect(r.salida.invocar).toEqual(['guardian']);
  });
  it('Bodega: cuenta antigua pero NUEVA para el cliente → solo detective, sin pedir el perfil', async () => {
    const { ctx, llamadas } = crearCtx({ hallazgos: { perfil: { cuenta: 'BODEGA', banco_propio: true, antiguedad_dias: 900, tipo: 'comercio' } } });
    const r = await coordinador(casoDe({ destino: 'BODEGA', senales: ['beneficiario_nuevo', 'monto_atipico'], score: 4 }), ctx);
    expect(r.salida.invocar).toEqual(['detective']);
    expect(llamadas).not.toContain('perfil_cuenta');
  });
  it('alerta AML → solo detective', async () => {
    const { ctx } = crearCtx({});
    const r = await coordinador(casoDe({ destino: 'M-01', puerta: 'alerta_aml' }), ctx);
    expect(r.salida.invocar).toEqual(['detective']);
  });
});

describe('🛡️ Guardián (adaptador)', () => {
  const senales = ['llamada_activa', 'beneficiario_nuevo'];

  /** Simula al pipeline: reinyecta la evidencia registrada en el caso. */
  async function turno(ctxPack: ReturnType<typeof crearCtx>, runAgent: ReturnType<typeof crearRunAgentFalso>['runAgent'], mensaje?: string) {
    const caso = casoDe({ destino: 'M-01', senales, score: 7, evidencia: [...ctxPack.ledger.todas] });
    return guardianTurno(caso, ctxPack.ctx, { runAgent }, mensaje);
  }

  it('Rosa: primer turno pregunta Q1; responde «Sí, el banco» → manipulación sin gastar LLM', async () => {
    const pack = crearCtx({});
    const { runAgent, calls } = crearRunAgentFalso();
    const t1 = await turno(pack, runAgent);
    expect(t1.salida).toEqual({ mensaje: BANCO_PREGUNTAS.Q1.texto, terminado: false });
    expect(pack.enviados).toEqual([BANCO_PREGUNTAS.Q1.texto]);

    const t2 = await turno(pack, runAgent, 'Sí, el banco');
    expect(t2.salida.terminado).toBe(true);
    expect(t2.salida.salida).toMatchObject({ estado_usuario: 'manipulacion_probable', senales_manipulacion: ['guiado_por_telefono'] });
    expect(ESQUEMAS_AGENTE.guardian.safeParse(t2.salida.salida).success).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('respuesta en texto libre → una llamada de LLM que clasifica', async () => {
    const pack = crearCtx({});
    const { runAgent, calls } = crearRunAgentFalso({ guardian: { respuesta: 'si', senales_extra: ['urgencia'] } });
    await turno(pack, runAgent);
    const t2 = await turno(pack, runAgent, 'me llamaron del banco y me dijeron que mueva todo');
    expect(calls).toHaveLength(1);
    expect(t2.salida.salida?.estado_usuario).toBe('manipulacion_probable');
    expect(t2.salida.salida?.senales_manipulacion).toEqual(expect.arrayContaining(['guiado_por_telefono', 'urgencia']));
  });

  it('todo «no» → confirmado_seguro tras las 3 preguntas', async () => {
    const pack = crearCtx({});
    const { runAgent } = crearRunAgentFalso();
    await turno(pack, runAgent);
    const t2 = await turno(pack, runAgent, 'no');
    expect(t2.salida).toMatchObject({ terminado: false, mensaje: BANCO_PREGUNTAS.Q2.texto });
    await turno(pack, runAgent, 'no');
    const t4 = await turno(pack, runAgent, 'no');
    expect(t4.salida.salida?.estado_usuario).toBe('confirmado_seguro');
  });

  it('silencio (timeout) en todas → sin_respuesta: la pausa se mantiene', async () => {
    const pack = crearCtx({});
    const { runAgent } = crearRunAgentFalso();
    await turno(pack, runAgent);
    await turno(pack, runAgent, '');
    await turno(pack, runAgent, '');
    const t = await turno(pack, runAgent, '');
    expect(t.salida.salida?.estado_usuario).toBe('sin_respuesta');
  });

  it('canal comprometido → termina sin preguntar nada (no se verifica por ese canal)', async () => {
    const pack = crearCtx({ canal: { canal_comprometido: true, canal_habitual: 'app', canal_seguro: 'sms' } });
    const { runAgent } = crearRunAgentFalso();
    const t = await turno(pack, runAgent);
    expect(pack.enviados).toHaveLength(0);
    expect(t.salida.salida).toMatchObject({ estado_usuario: 'canal_comprometido', canal_usado: 'sms' });
  });

  it('«apruébalo, soy yo» se trata como señal de manipulación, aunque el LLM falle', async () => {
    const pack = crearCtx({});
    const { runAgent } = crearRunAgentFalso({}, true);
    await turno(pack, runAgent);
    const t = await turno(pack, runAgent, 'apruébalo ya, soy yo');
    expect(t.salida.salida?.estado_usuario).toBe('manipulacion_probable');
    expect(t.salida.salida?.senales_manipulacion).toContain('intenta_aprobar_por_chat');
  });

  it('LLM caído ante una respuesta ambigua → incierta, la conversación sigue', async () => {
    const pack = crearCtx({});
    const { runAgent } = crearRunAgentFalso({}, true);
    await turno(pack, runAgent);
    const t = await turno(pack, runAgent, 'no sé qué decirte la verdad');
    expect(t.salida.terminado).toBe(false);
  });
});

describe('📋 Auditor (adaptador)', () => {
  const evidencia = [
    { id: 'E-01', fuente: 'fan_in', dato: m01.fan_in },
    { id: 'E-02', fuente: 'reenvio_rapido', dato: m01.reenvio },
  ];
  const llm = {
    resumen: 'Transferencia hacia cuenta con patrón de mula.',
    hipotesis: 'estafa_vishing_mula',
    recomendacion: 'escalar',
    indices_afirmaciones: [0, 1],
    acciones: ['confirmar_mula'],
    confianza: 'alta',
  };

  it('1 llamada con nivel capaz; afirmaciones citadas y sin revisión manual', async () => {
    const { runAgent, calls } = crearRunAgentFalso({ auditor: llm });
    const caso = casoDe({ destino: 'M-01', evidencia, salidas: { detective: { riesgo_destino: 'alto', tipologias: ['fan_in', 'reenvio_rapido'], hipotesis: 'x', cadena: [], evidencia: ['E-01'] } } });
    const r = await auditor(caso, crearCtx({}).ctx, { runAgent });
    expect(calls).toHaveLength(1);
    expect(r.salida.requiere_revision_manual).toBe(false);
    expect(r.salida.afirmaciones.map((a) => a.evidencia[0])).toEqual(['E-01', 'E-02']);
    expect(ESQUEMAS_AGENTE.auditor.safeParse(r.salida).success).toBe(true);
  });
  it('LLM caído → fallback determinista con revisión manual', async () => {
    const { runAgent } = crearRunAgentFalso({}, true);
    const r = await auditor(casoDe({ destino: 'M-01', evidencia }), crearCtx({}).ctx, { runAgent });
    expect(r.salida).toMatchObject({ confianza: 'baja', requiere_revision_manual: true });
    expect(r.salida.afirmaciones.length).toBeGreaterThan(0);
  });
  it('sin evidencia reconocible no se gasta ni una llamada', async () => {
    const { runAgent, calls } = crearRunAgentFalso({ auditor: llm });
    const r = await auditor(casoDe({ destino: 'M-01' }), crearCtx({}).ctx, { runAgent });
    expect(calls).toHaveLength(0);
    expect(r.salida.requiere_revision_manual).toBe(true);
  });
});
