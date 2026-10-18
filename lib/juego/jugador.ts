import type { NextResponse } from 'next/server';
import { idUnico } from '@/lib/persistencia/id';

/**
 * Identidad del jugador: un id único por celular, en una cookie que dura más
 * de un año. El ranking, las salas y las partidas identifican por este id, no
 * por el apodo: dos «ANA» son dos jugadores con dos récords, y quien vuelve
 * sigue siendo el mismo (su récord lo espera, como en un arcade).
 *
 * No es una cuenta ni un dato personal: es un número al azar. No es secreto
 * (la cookie no es httpOnly: el juego la lee para su progreso local), y para
 * un juego de evento basta. Si alguien la borra, empieza como jugador nuevo.
 *
 * Dueño: Tony_dev (demo jugable).
 */

export const COOKIE_JUGADOR = 'ter_jugador';
/** Los navegadores no guardan cookies por más de 400 días. */
const DURACION_S = 400 * 24 * 60 * 60;
const FORMATO = /^J-[0-9A-Z]{9}-[0-9A-F]{12}$/;

export const esIdJugador = (v: unknown): v is string => typeof v === 'string' && FORMATO.test(v);

/** El id del jugador que viene en la cookie (o null si no hay o está malformado). */
export function jugadorDe(req: Request): string | null {
  const cookies = req.headers.get('cookie') ?? '';
  for (const parte of cookies.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE_JUGADOR) {
      const valor = decodeURIComponent(v.join('='));
      return esIdJugador(valor) ? valor : null;
    }
  }
  return null;
}

/** El id del jugador, o uno nuevo si no tiene (hay que devolverlo con `conCookie`). */
export function asegurarJugador(req: Request): { id: string; nuevo: boolean } {
  const id = jugadorDe(req);
  return id ? { id, nuevo: false } : { id: idUnico('J'), nuevo: true };
}

/** Pone (o renueva) la cookie del jugador en la respuesta. */
export function conCookie<T extends NextResponse>(res: T, req: Request, id: string): T {
  res.cookies.set(COOKIE_JUGADOR, id, {
    maxAge: DURACION_S,
    path: '/',
    sameSite: 'lax',
    secure: new URL(req.url).protocol === 'https:',
    httpOnly: false,
  });
  return res;
}
