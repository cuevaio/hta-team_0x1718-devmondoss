import { z } from 'zod';

/**
 * Alias de un jugador (DEMO_JUEGO §8: «alias libre, sin correo ni teléfono»).
 *
 * Las respuestas del juego son anónimas. El alias es lo único que identifica
 * una partida, así que se rechaza lo que pueda identificar a una persona real:
 * un correo, un número de teléfono (7 o más dígitos) o un enlace.
 *
 * No es una garantía absoluta (alguien puede escribir su nombre), pero corta
 * los identificadores de contacto, que es lo que el diseño promete.
 *
 * Dueño: Ale_dev.
 */

const MAX_ALIAS = 24;

export function motivoAliasInvalido(alias: string): string | null {
  if (/@/.test(alias)) return 'el alias no puede ser un correo';
  if ((alias.match(/\d/g) ?? []).length >= 7) return 'el alias no puede contener un número de teléfono';
  if (/https?:|www\./i.test(alias)) return 'el alias no puede ser un enlace';
  return null;
}

export const Alias = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ALIAS)
  .superRefine((alias, ctx) => {
    const motivo = motivoAliasInvalido(alias);
    if (motivo) ctx.addIssue({ code: 'custom', message: motivo });
  });
