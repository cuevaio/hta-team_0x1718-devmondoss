import { NextResponse } from 'next/server';
import { AccionSala, CodigoSala, salas } from '@/lib/juego/salas';

/**
 * Una sala EN VIVO.
 *
 * GET  estado actual (`?alias=` agrega lo propio: puntaje, posición, última respuesta).
 * POST `{ accion: 'unirse' | 'iniciar' | 'reiniciar' | 'responder', … }`.
 *      `200` vista | `400` | `403` (no eres el anfitrión / no te uniste) |
 *      `404` sala | `409` (ronda cerrada, ya respondiste, ya empezó, llena).
 */
type Ctx = { params: Promise<{ codigo: string }> };

async function codigoDe(ctx: Ctx) {
  const parsed = CodigoSala.safeParse((await ctx.params).codigo);
  return parsed.success ? parsed.data : null;
}

export async function GET(req: Request, ctx: Ctx) {
  const codigo = await codigoDe(ctx);
  if (!codigo) return NextResponse.json({ error: 'código inválido' }, { status: 400 });
  const alias = new URL(req.url).searchParams.get('alias') ?? undefined;
  const vista = salas.vista(codigo, alias);
  if (!vista) return NextResponse.json({ error: 'sala no encontrada' }, { status: 404 });
  return NextResponse.json(vista);
}

export async function POST(req: Request, ctx: Ctx) {
  const codigo = await codigoDe(ctx);
  if (!codigo) return NextResponse.json({ error: 'código inválido' }, { status: 400 });
  const parsed = AccionSala.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  const r = salas.accion(codigo, parsed.data);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
