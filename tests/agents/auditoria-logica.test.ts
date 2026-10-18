import { describe, it, expect } from 'vitest';
import type { Afirmacion, Evidencia } from '@/lib/contracts';
import { clasificarRapido, estadoFinal } from '@/lib/agents/decisiones/guardian';
import { ensamblarDetective, type Hallazgos } from '@/lib/agents/decisiones/detective';
import { ensamblarAuditor } from '@/lib/agents/decisiones/auditor';
import { runAgentSimulado } from '@/lib/agents/llm-simulado';
import { DetectiveLLM, GuardianLLM, type AuditorLLM } from '@/lib/agents/esquemas';

/**
 * Auditoría de lógica de los agentes (revisión crítica pre-demo).
 *
 * Cada bloque reproduce un error encontrado al leer el código. La regla que
 * se protege es la del proyecto: el LLM razona, NO decide sobre el dinero; y
 * ante la duda, el sistema retiene.
 */

describe('Guardián — «no sé» no es «no»', () => {
  it.each(['no sé', 'no se', 'No lo sé', 'no recuerdo', 'no estoy segura', 'no entiendo', 'no sé bien'])(
    '«%s» es incierta, no una negación',
    (texto) => {
      expect(clasificarRapido(texto)).toBe('incierta');
    },
  );

  it('las negaciones reales siguen siendo «no»', () => {
    for (const t of ['no', 'No.', 'no, nadie', 'nadie', 'para nada', 'no gracias', 'negativo']) {
      expect(clasificarRapido(t), t).toBe('no');
    }
  });

  it('consecuencia: tres «no sé» NO dejan al cliente como confirmado_seguro', () => {
    const r = ['Q1', 'Q2', 'Q3'].map((p) => ({
      pregunta: p as 'Q1',
      clasificacion: clasificarRapido('no sé')!,
    }));
    expect(estadoFinal(r, { canalComprometido: false })).toBe('sin_respuesta');
  });
});

describe('Guardián simulado — no pierde lo que el cliente cuenta', () => {
  const simular = async (respuesta: string) =>
    (
      await runAgentSimulado(
        'guardian',
        { pregunta: '¿Te dijeron que tu dinero está en peligro?', respuesta_cliente: respuesta },
        GuardianLLM,
        { nivel: 'rapido', maxLlamadas: 1, timeoutMs: 1000 },
      )
    ).salida;

  it('«no sé» en frase larga → incierta', async () => {
    expect((await simular('mmm no sé, la verdad no estoy segura de nada')).respuesta).toBe('incierta');
  });

  it('un «no» seguido de una señal de riesgo no se toma como negación limpia', async () => {
    const s = await simular('no, solo me llamó el banco para que lo mueva rápido');
    expect(s.respuesta).not.toBe('no');
  });

  it('una negación limpia sigue siendo «no»', async () => {
    expect((await simular('no, estoy comprando una laptop yo solo')).respuesta).toBe('no');
  });
});

describe('Detective — el LLM no puede liberar una cuenta con reenvío rápido', () => {
  const base: Hallazgos = {
    perfil: { cuenta: 'X', banco_propio: true, antiguedad_dias: 900, tipo: 'comercio' },
    listas: { cuenta: 'X', en_lista: false, listas: [] },
    fan_in: { cuenta: 'X', remitentes_nuevos: 3, ventana_horas: 48, marcado: false },
    reenvio: { cuenta: 'X', porcentaje_reenviado: 0.92, ventana_horas: 2, destinos: ['Y'], marcado: true },
    estructuracion: { cuenta: 'X', operaciones_cercanas_umbral: 0, marcado: false },
  };
  const llmDiceBajo = DetectiveLLM.parse({ riesgo_destino: 'bajo', hipotesis: 'Parece un comercio', evidencia: ['E-01'] });

  it('reenvío rápido solo (4 víctimas, bajo el umbral de fan-in) + LLM «bajo» → sigue en medio', () => {
    const r = ensamblarDetective({ hallazgos: base, evidencia: ['E-01'], llm: llmDiceBajo });
    expect(r.salida.riesgo_destino).toBe('medio');
  });

  it('estructuración + LLM «bajo» → sigue en medio', () => {
    const h: Hallazgos = {
      ...base,
      reenvio: { ...base.reenvio!, porcentaje_reenviado: 0, marcado: false, destinos: [] },
      estructuracion: { cuenta: 'X', operaciones_cercanas_umbral: 3, marcado: true },
    };
    expect(ensamblarDetective({ hallazgos: h, evidencia: ['E-01'], llm: llmDiceBajo }).salida.riesgo_destino).toBe('medio');
  });

  it('el caso legítimo (solo fan-in, la Bodega) SÍ puede bajar a bajo', () => {
    const bodega: Hallazgos = {
      ...base,
      fan_in: { ...base.fan_in!, remitentes_nuevos: 11, marcado: true },
      reenvio: { ...base.reenvio!, porcentaje_reenviado: 0, marcado: false, destinos: [] },
    };
    expect(ensamblarDetective({ hallazgos: bodega, evidencia: ['E-01'], llm: llmDiceBajo }).salida.riesgo_destino).toBe('bajo');
  });
});

describe('Auditor — el resumen no puede inventar cifras', () => {
  const evidencia: Evidencia[] = [
    { id: 'E-01', fuente: 'fan_in', dato: {} },
    { id: 'E-02', fuente: 'reenvio_rapido', dato: {} },
  ];
  const candidatas: Afirmacion[] = [
    { texto: 'La cuenta M-01 recibió de 14 remitentes nuevos en 48 h', evidencia: ['E-01'] },
    { texto: 'Reenvió el 91% de lo recibido en menos de 2 h', evidencia: ['E-02'] },
  ];
  const llm = (resumen: string): AuditorLLM => ({
    resumen,
    hipotesis: 'mula_sin_cliente_afectado',
    recomendacion: 'escalar',
    indices_afirmaciones: [0, 1],
    acciones: ['confirmar_mula'],
    confianza: 'alta',
  });

  it('una cifra respaldada por las afirmaciones pasa', () => {
    const s = ensamblarAuditor(llm('Cuenta con 14 remitentes nuevos que reenvía el 91%.'), candidatas, { evidencia, riesgoDetective: 'alto' });
    expect(s.requiere_revision_manual).toBe(false);
    expect(s.resumen).toContain('14');
  });

  it('una cifra que no está en ninguna afirmación → revisión manual y no se muestra', () => {
    const s = ensamblarAuditor(llm('La cuenta recibió de 20 remitentes y movió S/ 50,000.'), candidatas, { evidencia, riesgoDetective: 'alto' });
    expect(s.requiere_revision_manual).toBe(true);
    expect(s.resumen).not.toMatch(/20|50/);
  });
});
