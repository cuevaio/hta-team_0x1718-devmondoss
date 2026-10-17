import { z } from 'zod';

/**
 * 🧠 Memoria de riesgo.
 *
 * Fuente: docs/context/tony_dev/adaptive_financial_security_docs/19_MULTIAGENT_SYSTEM.md §5
 *
 * Reglas que el esquema hace cumplir:
 *  - solo entra lo validado por un humano (R10) → `validado_por` es obligatorio;
 *  - expira (90 días por defecto) y admite revisión.
 *
 * Efecto: pausar transferencias NUEVAS hacia esa cuenta para verificación.
 * No confiscar.
 *
 * CONTRATO COMPARTIDO: no se modifica sin revisión del otro dev (blueprint §7).
 */

const FechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD');

export const TipoVeredicto = z.enum(['mula_confirmada', 'descartada']);
export type TipoVeredicto = z.infer<typeof TipoVeredicto>;

export const Veredicto = z.object({
  cuenta: z.string().min(1),
  veredicto: TipoVeredicto,
  /** Obligatorio: sin humano que lo valide, no entra a Memoria (R10). */
  validado_por: z.string().min(1),
  fecha: FechaISO,
  expira: FechaISO,
  expediente: z.string().min(1),
  apelacion_abierta: z.boolean(),
});
export type Veredicto = z.infer<typeof Veredicto>;

/** Días de vigencia por defecto de un veredicto (19 §5). */
export const DIAS_VIGENCIA_VEREDICTO = 90;

/**
 * Un veredicto cuenta como vigente si no expiró y no tiene apelación abierta.
 * La Memoria se consulta antes que cualquier agente, así que esto corre en
 * el camino caliente: se mantiene como función pura y sin dependencias.
 */
export function veredictoVigente(v: Veredicto, hoy: Date = new Date()): boolean {
  if (v.apelacion_abierta) return false;
  const fechaHoy = hoy.toISOString().slice(0, 10);
  return v.expira >= fechaHoy;
}
