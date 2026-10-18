import { NextResponse } from 'next/server';
import { storeCasos } from '@/lib/cases/store';
import { EntradaPartida, partidas } from '@/lib/juego/partidas';
import { exigirToken } from '@/lib/seguridad/token';
import { asegurarJugador, conCookie } from '@/lib/juego/jugador';

/**
 * Partidas del demo jugable (DEMO_JUEGO §6).
 *
 * POST   registra una partida al terminar. `201` | `400` | `409` (caso ya usado).
 * GET    lista las partidas (anónimas: solo alias).
 * DELETE vacía este servidor (operador: exige token si hay `DEMO_TOKEN`). Lo
 *        guardado en Supabase se conserva salvo `?nube=BORRAR-RECORDS`.
 *
 * `POST /api/demo/reset` NO borra las partidas: se hace antes de presentar y
 * se llevaría los datos de validación del evento.
 */
export async function POST(req: Request) {
  await partidas.listo;
  const parsed = EntradaPartida.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  const { id: jugador } = asegurarJugador(req);
  const r = partidas.registrar(parsed.data, (id) => storeCasos.get(id)?.caso ?? null, jugador);
  if ('error' in r) {
    return NextResponse.json({ error: r.error, casos: r.casos }, { status: r.status });
  }
  const { jugador: _j, ...publica } = r;
  void _j;
  return conCookie(NextResponse.json(publica, { status: 201 }), req, jugador);
}

export async function GET() {
  await partidas.listo;
  // Los ids de jugador no salen de la API (lista anónima: solo alias).
  const lista = partidas.todas().map(({ jugador, ...p }) => (void jugador, p));
  return NextResponse.json({ total: partidas.cantidad, partidas: lista });
}

export async function DELETE(req: Request) {
  await partidas.listo;
  const denegado = exigirToken(req);
  if (denegado) return denegado;
  // Los récords en Supabase se conservan; borrarlos exige pedirlo a propósito.
  const nube = new URL(req.url).searchParams.get('nube') === 'BORRAR-RECORDS';
  partidas.limpiar({ nube });
  return NextResponse.json({ ok: true, borradas: true, nube });
}
