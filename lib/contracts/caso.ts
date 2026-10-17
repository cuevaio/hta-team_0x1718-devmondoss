import { z } from 'zod';

/**
 * Objeto Caso — compartido por todo el sistema.
 *
 * Fuente: docs/context/tony_dev/adaptive_financial_security_docs/19_MULTIAGENT_SYSTEM.md §6
 *
 * La consola del analista y el panel del cliente son vistas de este mismo objeto.
 *
 * CONTRATO COMPARTIDO: no se modifica sin revisión del otro dev (blueprint §7).
 */

/** Decisión final del Policy Engine. */
export const DecisionAccion = z.enum(['PERMITIR', 'PAUSAR', 'VERIFICAR', 'ESCALAR']);
export type DecisionAccion = z.infer<typeof DecisionAccion>;

/** Reglas del Policy Engine, en orden de evaluación (19 §4). */
export const ReglaPolicy = z.enum(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']);
export type ReglaPolicy = z.infer<typeof ReglaPolicy>;

/** Puerta de entrada: transferencia del cliente (Track 04) o alerta AML (B1). */
export const Puerta = z.enum(['transferencia', 'alerta_aml']);
export type Puerta = z.infer<typeof Puerta>;

/**
 * Evidencia.
 *
 * El `id` lo asigna la capa de tools (lib/evidence.ts), NUNCA el LLM.
 * Esto es lo que permite validar que el Auditor no alucine (19 §3, R9).
 */
export const Evidencia = z.object({
  id: z.string().regex(/^E-\d{2,}$/, 'id de evidencia debe tener forma E-01'),
  fuente: z.string().min(1),
  dato: z.unknown(),
});
export type Evidencia = z.infer<typeof Evidencia>;

export const Transaccion = z.object({
  origen: z.string().min(1),
  destino: z.string().min(1),
  monto: z.number().positive(),
  moneda: z.literal('PEN'),
});
export type Transaccion = z.infer<typeof Transaccion>;

/** Salida de las reglas nivel 0 (sin IA). Ver 19 §2. */
export const Nivel0 = z.object({
  senales: z.array(z.string()),
  score: z.number().int().min(0),
  /** Atajo determinista: P1 (mula en Memoria) o P2 (beneficiario habitual). */
  atajo: z.enum(['P1', 'P2']).optional(),
});
export type Nivel0 = z.infer<typeof Nivel0>;

export const EventoTimeline = z.object({
  t: z.string().min(1),
  actor: z.string().min(1),
  evento: z.string().min(1),
  detalle: z.unknown().optional(),
});
export type EventoTimeline = z.infer<typeof EventoTimeline>;

/** Contador de consumo de IA, visible en el demo (19 §7). */
export const UsoIA = z.object({
  llamadas: z.number().int().min(0),
  tokens: z.number().int().min(0),
  costo_estimado: z.number().min(0),
});
export type UsoIA = z.infer<typeof UsoIA>;

export const DecisionTomada = z.object({
  accion: DecisionAccion,
  regla: ReglaPolicy,
  t: z.string().min(1),
});
export type DecisionTomada = z.infer<typeof DecisionTomada>;
