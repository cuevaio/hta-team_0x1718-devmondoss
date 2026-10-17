import type { Evidencia } from './caso';
import type { SalidaAuditor, SalidaDetective, Tipologia } from './agentes';

/**
 * Validaciones cruzadas que un esquema por sí solo no puede expresar.
 *
 * Fuente: docs/context/tony_dev/adaptive_financial_security_docs/19_MULTIAGENT_SYSTEM.md §3
 *
 * Son funciones puras a propósito: corren después de que zod validó la forma,
 * y son lo que impide que una alucinación del LLM llegue al expediente.
 */

// ─────────────────────────────────────────────────────────────
// 📋 Auditor — toda afirmación cita evidencia que EXISTE en el caso
// ─────────────────────────────────────────────────────────────

export interface ResultadoValidacionAuditor {
  valido: boolean;
  /** Ids citados por el Auditor que no existen en el caso. */
  idsInexistentes: string[];
  /** Índices de afirmaciones sin ninguna evidencia válida. */
  afirmacionesSinRespaldo: number[];
}

/**
 * El esquema ya garantiza que cada afirmación cite >= 1 id con forma E-xx.
 * Esto verifica lo que el esquema no puede: que esos ids EXISTAN en el caso.
 *
 * Si no valida → 1 reintento → `requiere_revision_manual: true` (19 §3).
 */
export function validarCitasAuditor(
  salida: SalidaAuditor,
  evidenciaDelCaso: Evidencia[],
): ResultadoValidacionAuditor {
  const existentes = new Set(evidenciaDelCaso.map((e) => e.id));
  const idsInexistentes = new Set<string>();
  const afirmacionesSinRespaldo: number[] = [];

  salida.afirmaciones.forEach((afirmacion, i) => {
    const validas = afirmacion.evidencia.filter((id) => {
      if (existentes.has(id)) return true;
      idsInexistentes.add(id);
      return false;
    });
    if (validas.length === 0) afirmacionesSinRespaldo.push(i);
  });

  return {
    valido: idsInexistentes.size === 0 && afirmacionesSinRespaldo.length === 0,
    idsInexistentes: [...idsInexistentes],
    afirmacionesSinRespaldo,
  };
}

// ─────────────────────────────────────────────────────────────
// 🔍 Detective — consistencia entre riesgo declarado y tipologías
// ─────────────────────────────────────────────────────────────

export interface ResultadoConsistenciaDetective {
  salida: SalidaDetective;
  /** true si el sistema bajó el riesgo que el agente había declarado. */
  ajustado: boolean;
  motivo?: string;
}

/**
 * "Si el agente dice `alto` pero ninguna tool marcó tipología, el sistema lo
 * baja a `medio` y lo marca para revisión." (19 §3)
 *
 * `tipologiasMarcadas` son las que marcaron las TOOLS deterministas, no las
 * que el agente dice haber visto. Esa distinción es el control antialucinación.
 */
export function aplicarConsistenciaDetective(
  salida: SalidaDetective,
  tipologiasMarcadas: Tipologia[],
): ResultadoConsistenciaDetective {
  if (salida.riesgo_destino === 'alto' && tipologiasMarcadas.length === 0) {
    return {
      salida: { ...salida, riesgo_destino: 'medio' },
      ajustado: true,
      motivo: 'riesgo alto declarado sin ninguna tipología marcada por las tools',
    };
  }
  return { salida, ajustado: false };
}

// ─────────────────────────────────────────────────────────────
// Predicado de mula
// ─────────────────────────────────────────────────────────────

/**
 * "Mula probable = fan_in + reenvio_rapido. Fan-in solo no basta
 * (la bodega también lo tiene)." (19 §3)
 *
 * Este es el control de falsos positivos del demo: Bodega Don Pepe tiene
 * fan-in pero NO reenvío rápido, así que debe dar false.
 */
export function esMulaProbable(tipologias: Tipologia[]): boolean {
  const t = new Set(tipologias);
  return t.has('fan_in') && t.has('reenvio_rapido');
}
