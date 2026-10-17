import { NextResponse } from 'next/server';
import { storeCasos } from '@/lib/cases/store';
import { memoria } from '@/lib/memory/store';
import { registro } from '@/lib/observability';

/** POST /api/demo/reset — reinicia casos, Memoria y registro para repetir el demo. */
export async function POST() {
  storeCasos.limpiar();
  memoria.limpiar();
  registro.limpiar();
  return NextResponse.json({ ok: true, reiniciado: true });
}
