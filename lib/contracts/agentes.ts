import { z } from 'zod';

/**
 * Esquemas de salida de los 4 agentes.
 *
 * Fuente: docs/context/tony_dev/adaptive_financial_security_docs/19_MULTIAGENT_SYSTEM.md §3
 * Los campos son EXACTAMENTE los del doc: son el contrato de cable con el LLM.
 *
 * Nota: se usa z.object() (no strictObject) a propósito — descarta claves
 * desconocidas en vez de rechazar la respuesta. Un LLM que agrega un campo
 * extra no debería costar un reintento.
 *
 * CONTRATO COMPARTIDO: no se modifica sin revisión del otro dev (blueprint §7).
 */

const IdEvidencia = z.string().regex(/^E-\d{2,}$/);

// ─────────────────────────────────────────────────────────────
// 🧭 Coordinador
// ─────────────────────────────────────────────────────────────

export const NombreEspecialista = z.enum(['guardian', 'detective']);
export type NombreEspecialista = z.infer<typeof NombreEspecialista>;

export const SalidaCoordinador = z.object({
  salida_temprana: z.boolean(),
  invocar: z.array(NombreEspecialista),
  motivo: z.string().min(1),
});
export type SalidaCoordinador = z.infer<typeof SalidaCoordinador>;

// ─────────────────────────────────────────────────────────────
// 🛡️ Guardián — frente cliente (Track 04)
// ─────────────────────────────────────────────────────────────

export const EstadoUsuario = z.enum([
  'confirmado_seguro',
  'manipulacion_probable',
  'sin_respuesta',
  'canal_comprometido',
  'no_consultado',
]);
export type EstadoUsuario = z.infer<typeof EstadoUsuario>;

export const SalidaGuardian = z.object({
  estado_usuario: EstadoUsuario,
  senales_manipulacion: z.array(z.string()),
  canal_usado: z.string().min(1),
  evidencia: z.array(IdEvidencia),
});
export type SalidaGuardian = z.infer<typeof SalidaGuardian>;

// ─────────────────────────────────────────────────────────────
// 🔍 Detective — frente cuenta destino (B1)
// ─────────────────────────────────────────────────────────────

export const RiesgoDestino = z.enum(['bajo', 'medio', 'alto']);
export type RiesgoDestino = z.infer<typeof RiesgoDestino>;

/** Tipologías marcadas por las tools deterministas (19 §3). */
export const Tipologia = z.enum([
  'fan_in',
  'reenvio_rapido',
  'estructuracion',
  'circular',
  'en_lista',
  /** Reenvía rápido hacia cuentas de otro país (red regional). */
  'transfronterizo',
  /** Otro banco de la red regional la confirmó como mula. Pesa menos que un veredicto propio. */
  'en_red',
]);
export type Tipologia = z.infer<typeof Tipologia>;

export const SalidaDetective = z.object({
  riesgo_destino: RiesgoDestino,
  tipologias: z.array(Tipologia),
  hipotesis: z.string().min(1),
  cadena: z.array(z.string()),
  evidencia: z.array(IdEvidencia),
});
export type SalidaDetective = z.infer<typeof SalidaDetective>;

// ─────────────────────────────────────────────────────────────
// 📋 Auditor
// ─────────────────────────────────────────────────────────────

export const Afirmacion = z.object({
  texto: z.string().min(1),
  /** Toda afirmación cita al menos un id de evidencia (19 §3, validación). */
  evidencia: z.array(IdEvidencia).min(1),
});
export type Afirmacion = z.infer<typeof Afirmacion>;

export const Recomendacion = z.enum(['descartar', 'escalar']);
export type Recomendacion = z.infer<typeof Recomendacion>;

export const Confianza = z.enum(['baja', 'media', 'alta']);
export type Confianza = z.infer<typeof Confianza>;

export const SalidaAuditor = z.object({
  resumen: z.string().min(1),
  hipotesis: z.string().min(1),
  recomendacion: Recomendacion,
  afirmaciones: z.array(Afirmacion),
  acciones_sugeridas: z.array(z.string()),
  confianza: Confianza,
  requiere_revision_manual: z.boolean(),
});
export type SalidaAuditor = z.infer<typeof SalidaAuditor>;

// ─────────────────────────────────────────────────────────────
// Registro de esquemas, para runAgent
// ─────────────────────────────────────────────────────────────

export const ESQUEMAS_AGENTE = {
  coordinador: SalidaCoordinador,
  guardian: SalidaGuardian,
  detective: SalidaDetective,
  auditor: SalidaAuditor,
} as const;

export type NombreAgente = keyof typeof ESQUEMAS_AGENTE;
