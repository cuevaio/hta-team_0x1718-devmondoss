import { NextResponse } from 'next/server';
import { z } from 'zod';
import { storeCasos } from '@/lib/cases/store';
import { resumenCaso } from '@/lib/cases/resumen';

/**
 * GET /api/cases — casos recientes, del más nuevo al más viejo.
 *
 * Es el feed en vivo del monitor (DEMO_JUEGO §5). Devuelve un resumen por
 * caso; el detalle completo está en `GET /api/cases/[id]`.
 *
 * `?limite=N` (1–100, por defecto 50).
 */
const Query = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'query inválida', detalle: parsed.error.issues }, { status: 400 });
  }
  const todos = storeCasos.todos();
  const casos = todos
    .slice(-parsed.data.limite)
    .reverse()
    .map((c) => resumenCaso(c, storeCasos.aliasDe(c.id)));
  return NextResponse.json({ total: todos.length, casos });
}
