import { NextResponse } from 'next/server';
import { estadisticas } from '@/lib/pipeline';

/** GET /api/stats — embudo y contador de IA (blueprint §3). */
export async function GET() {
  return NextResponse.json(estadisticas());
}
