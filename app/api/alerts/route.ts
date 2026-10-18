import { NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluarAlerta } from '@/lib/pipeline';
import { repo } from '@/lib/data/repo';
import { Alias } from '@/lib/juego/alias';

/**
 * POST /api/alerts — Puerta B: alerta AML (blueprint §3).
 *
 * No pasa por el Guardián: no hay cliente al otro lado. Produce expediente
 * igual (CU-02, criterio de aceptación).
 *
 * La alerta la genera el monitoreo del propio banco sobre SUS cuentas: si la
 * cuenta no existe en los datos, es una entrada inválida (404), no un caso.
 * Antes se abría un caso sobre una cuenta sin datos y la falta de datos se
 * leía como "sin patrones", que terminaba en PERMITIR.
 */
const Cuerpo = z.object({
  cuenta: z.string().trim().min(1),
  motivo: z.string().trim().min(1).default('monitoreo transaccional'),
  alias: Alias.optional(),
});

export async function POST(req: Request) {
  const parsed = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  if (!repo.cuenta(parsed.data.cuenta)) {
    return NextResponse.json({ error: 'cuenta no encontrada', cuenta: parsed.data.cuenta }, { status: 404 });
  }
  const { caso } = await evaluarAlerta(parsed.data.cuenta, parsed.data.motivo, {
    alias: parsed.data.alias,
  });
  return NextResponse.json(caso, { status: 201 });
}
