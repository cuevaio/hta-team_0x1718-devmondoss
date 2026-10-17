import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluarAlerta } from '@/lib/pipeline';

/**
 * POST /api/alerts — Puerta B: alerta AML (blueprint §3).
 *
 * No pasa por el Guardián: no hay cliente al otro lado. Produce expediente
 * igual (CU-02, criterio de aceptación).
 */
const Cuerpo = z.object({
  cuenta: z.string().min(1),
  motivo: z.string().min(1).default('monitoreo transaccional'),
});

export async function POST(req: Request) {
  const parsed = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  const { caso } = await evaluarAlerta(parsed.data.cuenta, parsed.data.motivo);
  return NextResponse.json(caso, { status: 201 });
}
