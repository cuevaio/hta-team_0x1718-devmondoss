import { NextResponse } from 'next/server';
import { Transaccion } from '@/lib/contracts';
import { z } from 'zod';
import { evaluarTransferencia } from '@/lib/pipeline';

/**
 * POST /api/transfers — Puerta A: evaluar una transferencia (blueprint §3).
 *
 * Devuelve el `Caso` completo: decisión, regla aplicada, evidencia, timeline
 * y consumo de IA.
 */
const Cuerpo = z.object({
  transaccion: Transaccion,
  /** Señales que el canal del banco reporta; no se infieren del cliente. */
  contexto: z
    .object({
      dispositivo_nuevo_24h: z.boolean().optional(),
      cambio_sim_o_clave_72h: z.boolean().optional(),
      llamada_activa_o_acceso_remoto: z.boolean().optional(),
      horario_atipico: z.boolean().optional(),
    })
    .optional(),
  /** Respuesta del cliente al Guardián, si el escenario la trae precargada. */
  respuestaCliente: z.string().optional(),
});

export async function POST(req: Request) {
  const parsed = Cuerpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  const { transaccion, contexto, respuestaCliente } = parsed.data;
  const { caso } = await evaluarTransferencia(transaccion, { contexto, respuestaCliente });
  return NextResponse.json(caso, { status: 201 });
}
