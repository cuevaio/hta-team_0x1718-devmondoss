import { NextResponse } from 'next/server';
import { z } from 'zod';
import { storeCasos } from '@/lib/cases/store';

/**
 * POST /api/cases/[id]/guardian/reply — el cliente responde al Guardián.
 *
 * El texto del cliente se guarda como DATO en el timeline, nunca como
 * instrucción para un modelo (doc 15, R5).
 */
const Cuerpo = z.object({ texto: z.string() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const vivo = storeCasos.get(id);
  if (!vivo) return NextResponse.json({ error: 'caso no encontrado' }, { status: 404 });

  const parsed = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido' }, { status: 400 });
  }

  storeCasos.registrarEvento(id, 'cliente', 'respuesta_guardian', { texto: parsed.data.texto });
  return NextResponse.json({ ok: true, caso: vivo.caso.id });
}
