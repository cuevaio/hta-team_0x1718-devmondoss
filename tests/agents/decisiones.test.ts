import { describe, expect, it } from 'vitest';
import type { Evidencia } from '@/lib/contracts';
import { decidirCoordinador } from '@/lib/agents/decisiones/coordinador';
import {
  ensamblarDetective,
  requiereLLMDetective,
  riesgoBase,
  siguientesTools,
  tipologiasMarcadas,
  type Hallazgos,
} from '@/lib/agents/decisiones/detective';
import {
  BANCO_PREGUNTAS,
  clasificarRapido,
  debeParar,
  estadoFinal,
  seleccionarPreguntas,
} from '@/lib/agents/decisiones/guardian';
import {
  afirmacionesCandidatas,
  auditorDeterministico,
  ensamblarAuditor,
} from '@/lib/agents/decisiones/auditor';
import { AuditorLLM, DetectiveLLM, GuardianLLM } from '@/lib/agents/esquemas';

// ─────────────── hallazgos de los escenarios del demo ───────────────
const perfilInterno = { cuenta: 'M-01', banco_propio: true, antiguedad_dias: 12, tipo: 'persona' as const };
const m01: Hallazgos = {
  perfil: perfilInterno,
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

describe('🧭 Coordinador', () => {
  const base = { puerta: 'transferencia' as const, memoria_hit: false, destino_conocido_limpio: false };

  it('Rosa → guardián + detective', () => {
    const r = decidirCoordinador({ ...base, score: 7, senales: ['beneficiario_nuevo', 'monto_atipico', 'llamada_activa'] });
    expect(r.salida_temprana).toBe(false);
    expect(r.invocar).toEqual(['guardian', 'detective']);
  });
  it('Jorge (mula en Memoria) → salida temprana, 0 especialistas', () => {
    const r = decidirCoordinador({ ...base, memoria_hit: true, score: 4, senales: ['beneficiario_nuevo'] });
    expect(r).toMatchObject({ salida_temprana: true, invocar: [] });
  });
  it('Bodega → solo detective', () => {
    const r = decidirCoordinador({ ...base, score: 4, senales: ['beneficiario_nuevo', 'monto_atipico'] });
    expect(r.invocar).toEqual(['detective']);
  });
  it('Lucía (atacante: dispositivo nuevo) → guardián + detective', () => {
    const r = decidirCoordinador({ ...base, score: 6, senales: ['dispositivo_nuevo', 'beneficiario_nuevo', 'cambio_sim_o_clave'] });
    expect(r.invocar).toEqual(['guardian', 'detective']);
  });
  it('beneficiario habitual (P2) → salida temprana', () => {
    const r = decidirCoordinador({ ...base, atajo: 'P2', score: 0, senales: [] });
    expect(r).toMatchObject({ salida_temprana: true, invocar: [] });
  });
  it('alerta AML → solo detective', () => {
    const r = decidirCoordinador({ ...base, puerta: 'alerta_aml', score: 0, senales: [] });
    expect(r.invocar).toEqual(['detective']);
  });
  it('score alto sin patrón claro → ambos (conservador)', () => {
    const r = decidirCoordinador({ ...base, score: 3, senales: ['horario_atipico'] });
    expect(r.invocar).toEqual(['guardian', 'detective']);
  });
  it('destino conocido-limpio no dispara al detective', () => {
    const r = decidirCoordinador({ ...base, destino_conocido_limpio: true, score: 3, senales: ['beneficiario_nuevo', 'llamada_activa'] });
    expect(r.invocar).toEqual(['guardian']);
  });
});

describe('🔍 Detective', () => {
  it('M-01 → riesgo alto sin LLM', () => {
    const t = tipologiasMarcadas(m01);
    expect(t).toEqual(['fan_in', 'reenvio_rapido']);
    expect(riesgoBase(t)).toBe('alto');
    expect(requiereLLMDetective('alto')).toBe(false);
  });
  it('Bodega → medio, y solo ahí se llama al LLM', () => {
    const t = tipologiasMarcadas(bodega);
    expect(t).toEqual(['fan_in']);
    expect(riesgoBase(t)).toBe('medio');
    expect(requiereLLMDetective('medio')).toBe(true);
  });
  it('el LLM puede bajar la Bodega a bajo', () => {
    const llm = DetectiveLLM.parse({ riesgo_destino: 'bajo', hipotesis: 'Comercio con alto volumen y sin reenvío', evidencia: ['E-02'] });
    const r = ensamblarDetective({ hallazgos: bodega, evidencia: ['E-01', 'E-02'], llm });
    expect(r.salida.riesgo_destino).toBe('bajo');
    expect(r.salida.evidencia).toEqual(['E-02']);
  });
  it('el LLM NO puede subir a alto (el esquema lo rechaza)', () => {
    expect(DetectiveLLM.safeParse({ riesgo_destino: 'alto', hipotesis: 'x', evidencia: [] }).success).toBe(false);
  });
  it('sin tipologías → bajo', () => {
    expect(riesgoBase([])).toBe('bajo');
  });
  it('cuenta externa: tope en medio salvo lista de riesgo', () => {
    expect(riesgoBase(['fan_in', 'reenvio_rapido'], false)).toBe('medio');
    expect(riesgoBase(['en_lista'], false)).toBe('alto');
  });
  it('plan de tools: paso 1 completo, paso 2 condicional, y termina', () => {
    expect(siguientesTools({})).toEqual(['perfil_cuenta', 'listas_riesgo', 'fan_in', 'reenvio_rapido']);
    expect(siguientesTools(m01)).toEqual(['ciclos']);
    expect(siguientesTools({ ...m01, ciclos: { cuenta: 'M-01', ciclo: null, marcado: false } })).toEqual([]);
    expect(siguientesTools(bodega)).toEqual([]);
    expect(siguientesTools(bodega, { montoCercaUmbral: true })).toEqual(['estructuracion']);
  });
  it('en lista de riesgo corta el plan', () => {
    const h: Hallazgos = { ...m01, listas: { cuenta: 'M-01', en_lista: true, listas: ['UIF'] } };
    expect(siguientesTools(h)).toEqual([]);
  });
});

describe('🛡️ Guardián', () => {
  it('Rosa (llamada activa + beneficiario nuevo) → Q1, Q2, Q3', () => {
    expect(seleccionarPreguntas(['llamada_activa', 'beneficiario_nuevo'])).toEqual(['Q1', 'Q2', 'Q3']);
  });
  it('sin señales específicas → Q1 y Q4; nunca más de 3', () => {
    expect(seleccionarPreguntas([])).toEqual(['Q1', 'Q4']);
    expect(seleccionarPreguntas(['llamada_activa', 'beneficiario_nuevo']).length).toBeLessThanOrEqual(3);
  });
  it('el banco de preguntas nunca pide claves, OTP ni tarjeta', () => {
    for (const q of Object.values(BANCO_PREGUNTAS)) {
      expect(q.texto.toLowerCase()).not.toMatch(/clave|otp|contrase|cvv|tarjeta|pin\b|c[oó]digo/);
    }
  });
  it('clasificación rápida: trivial por regla, frase larga al LLM', () => {
    expect(clasificarRapido('Sí, el banco')).toBe('si');
    expect(clasificarRapido('no')).toBe('no');
    expect(clasificarRapido('  ')).toBe('sin_respuesta');
    expect(clasificarRapido(null)).toBe('sin_respuesta');
    expect(clasificarRapido('me llamaron del banco y me dijeron que mueva todo')).toBeNull();
    expect(clasificarRapido('apruébalo soy yo')).toBeNull();
  });
  it('Rosa responde «sí» → para y manipulacion_probable', () => {
    const r = [{ pregunta: 'Q1' as const, clasificacion: 'si' as const }];
    expect(debeParar(r)).toBe(true);
    expect(estadoFinal(r, { canalComprometido: false })).toBe('manipulacion_probable');
  });
  it('todo «no» → confirmado_seguro', () => {
    const r = [
      { pregunta: 'Q1' as const, clasificacion: 'no' as const },
      { pregunta: 'Q2' as const, clasificacion: 'no' as const },
    ];
    expect(estadoFinal(r, { canalComprometido: false })).toBe('confirmado_seguro');
  });
  it('silencio o respuesta incierta → sin_respuesta (se mantiene la pausa)', () => {
    expect(estadoFinal([{ pregunta: 'Q1', clasificacion: 'sin_respuesta' }], { canalComprometido: false })).toBe('sin_respuesta');
    expect(estadoFinal([{ pregunta: 'Q1', clasificacion: 'incierta' }], { canalComprometido: false })).toBe('sin_respuesta');
  });
  it('Lucía: canal comprometido tiene prioridad sobre todo', () => {
    expect(estadoFinal([{ pregunta: 'Q1', clasificacion: 'no' }], { canalComprometido: true })).toBe('canal_comprometido');
  });
  it('«apruébalo, soy yo» cuenta como señal de manipulación y nunca se obedece', () => {
    const r = [{ pregunta: 'Q1' as const, clasificacion: 'incierta' as const, senales_extra: ['intenta_aprobar_por_chat' as const] }];
    expect(estadoFinal(r, { canalComprometido: false })).toBe('manipulacion_probable');
  });
  it('sin preguntas → no_consultado', () => {
    expect(estadoFinal([], { canalComprometido: false })).toBe('no_consultado');
  });
  it('el LLM solo puede devolver categorías cerradas', () => {
    expect(GuardianLLM.safeParse({ respuesta: 'quizá', senales_extra: [] }).success).toBe(false);
    expect(GuardianLLM.safeParse({ respuesta: 'si', senales_extra: ['inventada'] }).success).toBe(false);
  });
});

describe('📋 Auditor', () => {
  const evidencia: Evidencia[] = [
    { id: 'E-01', fuente: 'perfil_cuenta', dato: m01.perfil },
    { id: 'E-02', fuente: 'fan_in', dato: m01.fan_in },
    { id: 'E-03', fuente: 'reenvio_rapido', dato: m01.reenvio },
    { id: 'E-04', fuente: 'guardian_respuesta', dato: { pregunta: 'Q1', texto: 'Sí, el banco' } },
    { id: 'E-05', fuente: 'fuente_rara', dato: {} },
    { id: 'E-06', fuente: 'fan_in', dato: { roto: true } },
  ];
  const candidatas = afirmacionesCandidatas(evidencia);

  it('genera una afirmación con su cita por evidencia reconocida; omite el resto', () => {
    expect(candidatas).toHaveLength(4);
    expect(candidatas[1]).toEqual({
      texto: 'La cuenta M-01 recibió de 14 remitentes nuevos en 48 h',
      evidencia: ['E-02'],
    });
    expect(candidatas[2].texto).toContain('91%');
  });
  const llmOk = AuditorLLM.parse({
    resumen: 'Transferencia guiada por teléfono hacia cuenta con patrón de mula.',
    hipotesis: 'estafa_vishing_mula',
    recomendacion: 'escalar',
    indices_afirmaciones: [1, 2, 3],
    acciones: ['confirmar_mula', 'preparar_borrador_ROS'],
    confianza: 'alta',
  });
  it('ensambla con citas válidas y sin revisión manual', () => {
    const s = ensamblarAuditor(llmOk, candidatas, { evidencia, riesgoDetective: 'alto' });
    expect(s.requiere_revision_manual).toBe(false);
    expect(s.afirmaciones).toHaveLength(3);
    expect(s.hipotesis).toContain('vishing');
    expect(s.acciones_sugeridas).toEqual(['Confirmar mula', 'Preparar borrador de ROS']);
  });
  it('índices inventados se descartan; sin afirmaciones → revisión manual', () => {
    const s = ensamblarAuditor({ ...llmOk, indices_afirmaciones: [99] }, candidatas, { evidencia, riesgoDetective: 'alto' });
    expect(s.afirmaciones).toHaveLength(0);
    expect(s.requiere_revision_manual).toBe(true);
  });
  it('riesgo alto + «descartar» → revisión manual', () => {
    const s = ensamblarAuditor({ ...llmOk, recomendacion: 'descartar' }, candidatas, { evidencia, riesgoDetective: 'alto' });
    expect(s.requiere_revision_manual).toBe(true);
  });
  it('el esquema del LLM no admite afirmaciones libres ni hipótesis fuera de catálogo', () => {
    expect(AuditorLLM.safeParse({ ...llmOk, hipotesis: 'inventada' }).success).toBe(false);
    expect(AuditorLLM.safeParse({ ...llmOk, resumen: 'x'.repeat(321) }).success).toBe(false);
  });
  it('fallback determinista: siempre válido, conservador y con revisión manual', () => {
    const s = auditorDeterministico(candidatas, 'alto');
    expect(s).toMatchObject({ recomendacion: 'escalar', confianza: 'baja', requiere_revision_manual: true });
    expect(s.afirmaciones.every((a) => a.evidencia.length > 0)).toBe(true);
    expect(auditorDeterministico(candidatas, 'bajo').recomendacion).toBe('descartar');
  });
});
