import { NextResponse } from 'next/server';
import { storeCasos } from '@/lib/cases/store';
import { EntradaPartida, partidas } from '@/lib/juego/partidas';
import { exigirToken } from '@/lib/seguridad/token';

/**
 * Partidas del demo jugable (DEMO_JUEGO §6).
 *
 * POST   registra una partida al terminar. `201` | `400` | `409` (caso ya usado).
 * GET    lista las partidas (anónimas: solo alias).
 * DELETE borra todas. Es del operador: exige token si hay `DEMO_TOKEN`.
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
  const r = partidas.registrar(parsed.data, (id) => storeCasos.get(id)?.caso ?? null);
  if ('error' in r) {
    return NextResponse.json({ error: r.error, casos: r.casos }, { status: r.status });
  }
  return NextResponse.json(r, { status: 201 });
}

export async function GET() {
  await partidas.listo;
  return NextResponse.json({ total: partidas.cantidad, partidas: partidas.todas() });
}

export async function DELETE(req: Request) {
  await partidas.listo;
  const denegado = exigirToken(req);
  if (denegado) return denegado;
  partidas.limpiar();
  return NextResponse.json({ ok: true, borradas: true });
}
