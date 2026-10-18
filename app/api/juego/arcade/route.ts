import { NextResponse } from 'next/server';
import { EntradaArcade, arcade } from '@/lib/juego/arcade';
import { exigirToken } from '@/lib/seguridad/token';
import { asegurarJugador, conCookie, jugadorDe } from '@/lib/juego/jugador';

/**
 * Modos arcade del juego (¿REAL O ESTAFA?, SIGUE EL DINERO) y la encuesta
 * de un toque.
 *
 * POST   registra una jugada y devuelve su posición en el ranking. `201` | `400`.
 * GET    resumen: jugadores, países, ranking, en qué estafas cae la gente y
 *        la encuesta. `?crudo=1` devuelve además todas las jugadas (anónimas).
 * DELETE vacía este servidor (operador: exige token si hay `DEMO_TOKEN`). Lo
 *        guardado en Supabase se conserva salvo `?nube=BORRAR-RECORDS`.
 *
 * Como las partidas, no se borra con `POST /api/demo/reset`.
 */
export async function POST(req: Request) {
  await arcade.listo;
  const parsed = EntradaArcade.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  // Cada celular es un jugador (cookie): dos con el mismo apodo no comparten récord.
  const { id: jugador } = asegurarJugador(req);
  const posicion = arcade.posicion(parsed.data.modo, parsed.data.puntaje);
  const jugada = arcade.registrar(parsed.data, jugador);
  return conCookie(NextResponse.json({ id: jugada.id, posicion }, { status: 201 }), req, jugador);
}

export async function GET(req: Request) {
  await arcade.listo;
  // Lo de otros servidores sobre el mismo Supabase llega en ≤ 20 s, sin hacer esperar.
  void arcade.sincronizar();
  const crudo = new URL(req.url).searchParams.get('crudo') === '1';
  // Los ids de jugador no salen de la API: solo se marca con `tuyo` lo del que consulta.
  const todas = crudo ? arcade.todas().map(({ jugador, ...resto }) => (void jugador, resto)) : undefined;
  return NextResponse.json({ ...arcade.resumen(10, jugadorDe(req) ?? undefined), ...(todas ? { todas } : {}) });
}

export async function DELETE(req: Request) {
  await arcade.listo;
  const denegado = exigirToken(req);
  if (denegado) return denegado;
  // Los récords en Supabase se conservan; borrarlos exige pedirlo a propósito.
  const nube = new URL(req.url).searchParams.get('nube') === 'BORRAR-RECORDS';
  arcade.limpiar({ nube });
  return NextResponse.json({ ok: true, borradas: true, nube });
}
