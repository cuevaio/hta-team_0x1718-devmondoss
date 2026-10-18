import { NextResponse } from 'next/server';
import { partidas } from '@/lib/juego/partidas';
import { resumenPartidas } from '@/lib/juego/resumen';

/** GET /api/juego/resumen — la tabla de validación de DEMO_JUEGO §6. */
export async function GET() {
  return NextResponse.json(resumenPartidas(partidas.todas()));
}
