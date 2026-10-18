import { NextResponse } from 'next/server';
import { CrearSala, salas } from '@/lib/juego/salas';
import { asegurarJugador, conCookie } from '@/lib/juego/jugador';

/**
 * Salas EN VIVO del juego (multijugador).
 *
 * POST crea una sala: `{ alias, pais, juego }` → `201 { codigo, token }`. El
 *      token es de quien la crea (para empezar y reiniciar); no se muestra.
 * GET  salas activas, para el monitor (sin tokens).
 */
export async function POST(req: Request) {
  const parsed = CrearSala.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  const { alias, pais, juego } = parsed.data;
  const { id: jugador } = asegurarJugador(req);
  return conCookie(NextResponse.json(salas.crear(alias, pais, juego, jugador), { status: 201 }), req, jugador);
}

export async function GET() {
  return NextResponse.json({ salas: salas.activas() });
}
