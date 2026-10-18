import { z } from 'zod';

/**
 * Catálogo de golpes del modo atacante (DEMO_JUEGO §4 y §17).
 *
 * Vive en `lib/` y no en el cliente porque el modo EN VIVO · LA BANDA se
 * evalúa **en el servidor**: el celular manda ids de este catálogo (víctima,
 * táctica, cuenta destino, monto) y el servidor arma la transferencia y la
 * pasa por el pipeline real. El cliente nunca elige cuentas ni montos libres;
 * así un jugador no puede inventarse un golpe que el catálogo no contempla.
 *
 * Las cuentas son las de `lib/data/seed.json` (datos 100% sintéticos). Los
 * montos están elegidos alrededor del umbral de «monto atípico» (3× el
 * promedio de 90 días: Rosa 420, Jorge 380, Lucía 650), para que variar el
 * monto cambie de verdad lo que ven las reglas:
 *
 *   | monto   | Rosa (>1260) | Jorge (>1140) | Lucía (>1950) |
 *   |---------|--------------|---------------|---------------|
 *   | 300     | normal       | normal        | normal        |
 *   | 1200    | normal       | atípico       | normal        |
 *   | 4800    | atípico      | atípico       | atípico       |
 *
 * Dueño: Ale_dev.
 */

/** Señales que el canal del banco reporta; no se infieren del cliente. */
export type ContextoJugada = {
  dispositivo_nuevo_24h?: boolean;
  cambio_sim_o_clave_72h?: boolean;
  llamada_activa_o_acceso_remoto?: boolean;
  horario_atipico?: boolean;
};

export const VICTIMAS_GOLPE = ['rosa', 'jorge', 'lucia'] as const;
export type VictimaId = (typeof VICTIMAS_GOLPE)[number];

/** Cuenta de cada víctima en el seed. */
export const CUENTA_VICTIMA: Record<VictimaId, string> = {
  rosa: 'C-ROSA',
  jorge: 'C-JORGE',
  lucia: 'C-LUCIA',
};

export const TACTICAS_GOLPE = [
  'falso_banco',
  'link_falso',
  'falso_familiar',
  'app_falsa',
  'duplicado_chip',
] as const;
export type TacticaId = (typeof TACTICAS_GOLPE)[number];

/** Qué señales deja cada táctica en el canal del banco. */
export const CONTEXTO_TACTICA: Record<TacticaId, ContextoJugada> = {
  falso_banco: { llamada_activa_o_acceso_remoto: true },
  link_falso: { dispositivo_nuevo_24h: true },
  falso_familiar: {},
  app_falsa: { llamada_activa_o_acceso_remoto: true },
  duplicado_chip: { cambio_sim_o_clave_72h: true, dispositivo_nuevo_24h: true },
};

/** Cuentas «alquiladas» a las que puede ir el dinero (todas del seed). */
export const DESTINOS_GOLPE = ['M-01', 'M-02', 'M-03'] as const;
export type DestinoId = (typeof DESTINOS_GOLPE)[number];

export const MONTOS_GOLPE = [
  { id: 'chico', monto: 300, nombre: 'Un monto chico' },
  { id: 'medio', monto: 1200, nombre: 'Algo más' },
  { id: 'todo', monto: 4800, nombre: 'Todo de una' },
] as const;
export type MontoId = (typeof MONTOS_GOLPE)[number]['id'];

export const MONTO_DE = Object.fromEntries(MONTOS_GOLPE.map((m) => [m.id, m.monto])) as Record<MontoId, number>;

export const Golpe = z.object({
  victima: z.enum(VICTIMAS_GOLPE),
  tactica: z.enum(TACTICAS_GOLPE),
  destino: z.enum(DESTINOS_GOLPE),
  monto: z.enum(MONTOS_GOLPE.map((m) => m.id) as [MontoId, ...MontoId[]]),
  /** De madrugada: una hora rara también es una señal. */
  madrugada: z.boolean(),
});
export type Golpe = z.infer<typeof Golpe>;

/** Identidad de un golpe: sirve para no repetir el mismo intento. */
export const claveGolpe = (g: Golpe) =>
  `${g.victima}|${g.tactica}|${g.destino}|${g.monto}|${g.madrugada ? 'noche' : 'dia'}`;

/** Cuántos golpes distintos permite el catálogo (todas las combinaciones). */
export const COMBINACIONES =
  VICTIMAS_GOLPE.length * TACTICAS_GOLPE.length * DESTINOS_GOLPE.length * MONTOS_GOLPE.length * 2;

/** Cuerpo de `POST /api/transfers` para un golpe, armado en el servidor. */
export function transferenciaDeGolpe(g: Golpe, alias: string) {
  const contexto: ContextoJugada = { ...CONTEXTO_TACTICA[g.tactica] };
  if (g.madrugada) contexto.horario_atipico = true;
  return {
    transaccion: {
      origen: CUENTA_VICTIMA[g.victima],
      destino: g.destino,
      monto: MONTO_DE[g.monto],
      moneda: 'PEN' as const,
    },
    contexto,
    alias,
  };
}
