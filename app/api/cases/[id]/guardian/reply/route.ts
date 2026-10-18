import { NextResponse } from 'next/server';
import { z } from 'zod';
import { responderGuardian } from '@/lib/pipeline';
import { opcionDiferir } from '@/lib/diferir';

/**
 * POST /api/cases/[id]/guardian/reply — el cliente responde al Guardián.
 *
 * Soporta el modo de varios turnos: si el Guardián sigue preguntando, el
 * `Caso` devuelto trae el nuevo mensaje en el timeline y la UI vuelve a
 * llamar. Cuando cierra, se decide de nuevo y se genera el expediente.
 *
 * El texto del cliente se trata como DATO, nunca como instrucción para un
 * modelo (doc 15, R5).
 */
const Cuerpo = z.object({
  /** Vacío = el cliente no respondió a tiempo. El silencio no es aprobación. */
  texto: z.string(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const parsed = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }

  const caso = await responderGuardian(id, parsed.data.texto, opcionDiferir());
  if (!caso) return NextResponse.json({ error: 'caso no encontrado' }, { status: 404 });

  return NextResponse.json(caso);
}
