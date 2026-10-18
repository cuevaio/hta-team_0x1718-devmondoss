import { z } from 'zod';
import { Afirmacion, Tipologia } from './agentes';

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

/**
 * Países de la red regional: los de los sistemas de pago inmediato que se
 * están interconectando (TAPP en Perú, Bre-B en Colombia, QR en Bolivia, PIX
 * en Brasil).
 */
export const PAISES_RED = ['pe', 'co', 'bo', 'br'] as const;
export const Pais = z.enum(PAISES_RED);
export type Pais = z.infer<typeof Pais>;

/** Quién emitió un veredicto: un banco de la red y su país. */
export const Emisor = z.object({
  banco: z.string().min(1),
  pais: Pais,
});
export type Emisor = z.infer<typeof Emisor>;

export const Veredicto = z.object({
  cuenta: z.string().min(1),
  veredicto: TipoVeredicto,
  /** Obligatorio: sin humano que lo valide, no entra a Memoria (R10). */
  validado_por: z.string().min(1),
  fecha: FechaISO,
  expira: FechaISO,
  expediente: z.string().min(1),
  apelacion_abierta: z.boolean(),
  /** Banco que lo emitió. Ausente = este banco (los veredictos de antes de la red). */
  emisor: Emisor.optional(),
});
export type Veredicto = z.infer<typeof Veredicto>;

/**
 * Lo que un banco comparte con la red al confirmar una mula: los hechos de la
 * CUENTA, nunca los del cliente. No lleva la conversación del Guardián, ni
 * datos de la víctima, ni atributos de nadie (doc 15, R1).
 */
export const FichaCompartible = z.object({
  cuenta: z.string().min(1),
  tipologias: z.array(Tipologia),
  hipotesis: z.string().nullable(),
  /** Afirmaciones citando la evidencia del banco emisor (sus E-xx). */
  afirmaciones: z.array(Afirmacion),
  /**
   * true si el caso ya partía de un veredicto de la red. Evita el eco: un
   * banco que solo repite lo que dijo otro no suma una confirmación independiente.
   */
  basado_en_red: z.boolean(),
});
export type FichaCompartible = z.infer<typeof FichaCompartible>;

/** Un veredicto publicado en la red regional: siempre con emisor. */
export const VeredictoRed = z.object({
  veredicto: Veredicto.extend({ emisor: Emisor }),
  ficha: FichaCompartible.optional(),
});
export type VeredictoRed = z.infer<typeof VeredictoRed>;

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
