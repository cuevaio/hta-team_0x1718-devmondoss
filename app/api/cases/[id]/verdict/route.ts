import { NextResponse } from 'next/server';
import { z } from 'zod';
import { storeCasos } from '@/lib/cases/store';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { repo } from '@/lib/data/repo';
import { exigirToken } from '@/lib/seguridad/token';

/**
 * POST /api/cases/[id]/verdict — el analista confirma o descarta la mula.
 *
 * Es el único camino hacia la Memoria: sin un humano aquí, nada entra
 * (doc 15, R10). Si descarta, la cuenta NO queda marcada como mula (CU-02).
 */
const Cuerpo = z.object({
  veredicto: z.enum(['mula_confirmada', 'descartada']),
  // trim: un nombre hecho de espacios no identifica a ningún humano (R10).
  validado_por: z.string().trim().min(1, 'se requiere el analista que valida'),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Primero el token: sin él no se revela si el caso existe.
  const denegado = exigirToken(req);
  if (denegado) return denegado;
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

  try {
    memoria.confirm(cuenta, veredicto);
  } catch (error) {
    // La Memoria tiene sus propias guardas (R10). Si rechaza, es un error del
    // cliente de la API, no del servidor, y nada entró a la Memoria.
    return NextResponse.json(
      { error: 'veredicto rechazado', detalle: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
  storeCasos.registrarEvento(id, 'analista', 'veredicto', veredicto);

  return NextResponse.json({ caso: vivo.caso.id, veredicto });
}
