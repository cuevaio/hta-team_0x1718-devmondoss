import { NextResponse } from 'next/server';
import { repo } from '@/lib/data/repo';
import { modoAgentes } from '@/lib/agents';

/** GET /api/health — salud del servicio (blueprint §3). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    servicio: 'adaptive-financial-security',
    t: new Date().toISOString(),
    /** `claude` si hay ANTHROPIC_API_KEY real; `simulado` en caso contrario. */
    agentes: modoAgentes(),
    datos: {
      cuentas: repo.cuentas().length,
      clientes: repo.clientes().length,
      movimientos: repo.movimientos().length,
      nota: repo.notaDatos(),
    },
  });
}
