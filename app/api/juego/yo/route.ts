import { NextResponse } from 'next/server';
import { asegurarJugador, conCookie } from '@/lib/juego/jugador';

/**
 * GET /api/juego/yo — el id de jugador de este celular. Si no tiene, se le
 * asigna uno (cookie de 400 días). El juego lo pide al arrancar.
 *
 * Dueño: Tony_dev (demo jugable).
 */
export async function GET(req: Request) {
  const { id, nuevo } = asegurarJugador(req);
  return conCookie(NextResponse.json({ jugador: id, nuevo }), req, id);
}
