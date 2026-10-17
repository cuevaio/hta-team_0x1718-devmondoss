import type { EstadoUsuario } from '@/lib/contracts';
import type { SenalGuardian } from '../esquemas';

/**
 * 🛡️ Guardián — guion cerrado. Las preguntas son texto fijo (nunca pide claves ni
 * aprueba, por construcción); el LLM solo clasifica respuestas libres.
 * Fuente: docs/context/tony_dev/AGENT_PLAYBOOKS.md §4
 */

export type IdPregunta = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export const BANCO_PREGUNTAS: Record<
  IdPregunta,
  { texto: string; senal: Exclude<SenalGuardian, 'intenta_aprobar_por_chat'> }
> = {
  Q1: {
    texto: '¿Alguien te está pidiendo o guiando por teléfono para hacer esta transferencia ahora mismo?',
    senal: 'guiado_por_telefono',
  },
  Q2: {
    texto: '¿Te dijeron que tu dinero está en peligro o que debes moverlo rápido?',
    senal: 'urgencia',
  },
  Q3: {
    texto: '¿Te pidieron mandar tu dinero a una «cuenta segura» o a una cuenta que no conoces?',
    senal: 'cuenta_segura',
  },
  Q4: {
    texto:
      '¿Alguien que dice ser familiar, autoridad o una empresa te está presionando o amenazando por este pago?',
    senal: 'presion_tercero',
  },
};

export const MAX_TURNOS = 3;

/** Elige hasta 3 preguntas según las señales del nivel 0. */
export function seleccionarPreguntas(senales: string[]): IdPregunta[] {
  const q: IdPregunta[] = [];
  if (senales.includes('llamada_activa')) q.push('Q1', 'Q2');
  if (senales.includes('beneficiario_nuevo')) q.push('Q3');
  if (q.length === 0) q.push('Q1');
  if (q.length < MAX_TURNOS) q.push('Q4');
  return [...new Set(q)].slice(0, MAX_TURNOS);
}

export type RespuestaClasificada = 'si' | 'no' | 'incierta' | 'sin_respuesta';

/**
 * Clasificación por regla, sin LLM. Devuelve `null` si la respuesta no es
 * trivial (entonces sí se llama al modelo).
 */
export function clasificarRapido(texto: string | null | undefined): RespuestaClasificada | null {
  if (texto === null || texto === undefined || texto.trim() === '') return 'sin_respuesta';
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .trim();
  const palabras = t.split(/\s+/);
  if (palabras.length > 4) return null; // frase larga: que la lea el modelo
  if (/^(si|sii+|claro|asi es|correcto|ajam|aja|afirmativo)\b/.test(t)) return 'si';
  if (/^(no|nop|nel|negativo|para nada|nadie)\b/.test(t)) return 'no';
  return null;
}

export interface Respuesta {
  pregunta: IdPregunta;
  clasificacion: RespuestaClasificada;
  /** Señales que el LLM detectó además de la propia pregunta. */
  senales_extra?: SenalGuardian[];
}

/** Señales de manipulación acumuladas (un «sí» a su pregunta, o las extras). */
export function senalesDe(respuestas: Respuesta[]): SenalGuardian[] {
  const s = new Set<SenalGuardian>();
  for (const r of respuestas) {
    if (r.clasificacion === 'si') s.add(BANCO_PREGUNTAS[r.pregunta].senal);
    for (const e of r.senales_extra ?? []) s.add(e);
  }
  return [...s];
}

/** Parada anticipada: un «sí» a una pregunta de riesgo ya define el estado. */
export function debeParar(respuestas: Respuesta[]): boolean {
  return senalesDe(respuestas).length > 0;
}

export interface ContextoGuardian {
  canalComprometido: boolean;
}

/** Tabla de estado final: la primera fila que aplica gana (G1–G5). */
export function estadoFinal(respuestas: Respuesta[], ctx: ContextoGuardian): EstadoUsuario {
  if (ctx.canalComprometido) return 'canal_comprometido'; // G1
  if (senalesDe(respuestas).length > 0) return 'manipulacion_probable'; // G2
  if (respuestas.length === 0) return 'no_consultado'; // G5
  if (respuestas.some((r) => r.clasificacion === 'sin_respuesta' || r.clasificacion === 'incierta')) {
    return 'sin_respuesta'; // G3
  }
  return 'confirmado_seguro'; // G4
}

/**
 * R11: si el cliente intenta aprobar por el chat («apruébalo, soy yo»), puede
 * estar dictado por el estafador. Se detecta por regla, sin LLM, y nunca se obedece.
 */
export function detectaIntentoAprobar(texto: string): boolean {
  const t = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return /\b(apruebal|aprueba|aprobar|autoriza|autorizar|confirmal|soy yo|dejalo pasar|libera)/.test(t);
}
