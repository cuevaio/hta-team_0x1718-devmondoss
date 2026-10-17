import { NextResponse } from 'next/server';
import { storeCasos } from '@/lib/cases/store';
import { memoria } from '@/lib/memory/store';

/** POST /api/demo/reset — reinicia casos y Memoria para repetir el demo. */
export async function POST() {
  storeCasos.limpiar();
  memoria.limpiar();
  return NextResponse.json({ ok: true, reiniciado: true });
}
