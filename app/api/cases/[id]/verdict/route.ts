import { NextResponse } from 'next/server';
import { z } from 'zod';
import { storeCasos } from '@/lib/cases/store';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { repo } from '@/lib/data/repo';

/**
 * POST /api/cases/[id]/verdict — el analista confirma o descarta la mula.
 *
 * Es el único camino hacia la Memoria: sin un humano aquí, nada entra
 * (doc 15, R10). Si descarta, la cuenta NO queda marcada como mula (CU-02).
 */
const Cuerpo = z.object({
  veredicto: z.enum(['mula_confirmada', 'descartada']),
  validado_por: z.string().min(1, 'se requiere el analista que valida'),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const vivo = storeCasos.get(id);
  if (!vivo) return NextResponse.json({ error: 'caso no encontrado' }, { status: 404 });

  const parsed = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }

  const cuenta = vivo.caso.transaccion.destino;
  const veredicto = crearVeredicto({
    cuenta,
    veredicto: parsed.data.veredicto,
    validado_por: parsed.data.validado_por,
    expediente: vivo.caso.id,
    hoy: repo.ahora(),
  });

  memoria.confirm(cuenta, veredicto);
  storeCasos.registrarEvento(id, 'analista', 'veredicto', veredicto);

  return NextResponse.json({ caso: vivo.caso.id, veredicto });
}
