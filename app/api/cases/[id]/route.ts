import { NextResponse } from 'next/server';
import { storeCasos } from '@/lib/cases/store';

/** GET /api/cases/[id] — estado del caso para polling (blueprint §3). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const vivo = storeCasos.get(id);
  if (!vivo) return NextResponse.json({ error: 'caso no encontrado' }, { status: 404 });
  return NextResponse.json(vivo.caso);
}
