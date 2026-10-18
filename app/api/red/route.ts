import { NextResponse } from 'next/server';
import { BANCO_PROPIO, red } from '@/lib/memory/red';

/**
 * GET /api/red — la red regional de veredictos: qué mulas confirmaron los
 * bancos de la red, quién las confirmó y con qué hechos de la cuenta.
 *
 * Solo lectura. Publicar es efecto de `POST /api/cases/[id]/verdict` (un
 * analista confirma); no hay forma de escribir aquí directamente (R10).
 */
export async function GET() {
  const veredictos = red.todos();
  return NextResponse.json({
    banco_propio: BANCO_PROPIO,
    total: veredictos.length,
    paises: [...new Set(veredictos.map((r) => r.veredicto.emisor.pais))],
    veredictos,
  });
}
