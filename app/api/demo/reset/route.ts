import { NextResponse } from 'next/server';
import { storeCasos } from '@/lib/cases/store';
import { memoria } from '@/lib/memory/store';
import { red } from '@/lib/memory/red';
import { registro } from '@/lib/observability';
import { limpiarMovimientosEnVivo } from '@/lib/pipeline';
import { exigirToken } from '@/lib/seguridad/token';

/** POST /api/demo/reset — reinicia casos, Memoria, red regional (a la semilla), registro y movimientos en vivo. */
export async function POST(req: Request) {
  const denegado = exigirToken(req);
  if (denegado) return denegado;
  storeCasos.limpiar();
  memoria.limpiar();
  red.reiniciar();
  registro.limpiar();
  limpiarMovimientosEnVivo();
  return NextResponse.json({ ok: true, reiniciado: true });
}
