import { NextResponse } from 'next/server';
import { z } from 'zod';
import { estadoCargaAgentes, modoAgentes } from '@/lib/agents';
import { ola } from '@/lib/juego/ola';
import { exigirToken } from '@/lib/seguridad/token';

/**
 * Carga del sistema, para el monitor y la «ola de ataques» del demo.
 *
 * GET  estado: cola del modelo (en curso, en cola, saturadas, circuito,
 *      latencia, con IA vs. modo degradado en el último minuto), el proceso
 *      (memoria, retardo del event loop) y la ola en curso.
 * POST `{ accion: 'lanzar', n, por_segundo }` o `{ accion: 'parar' }`. Es del
 *      operador: exige token si hay `DEMO_TOKEN`. `202` | `409` (ya hay una ola).
 *
 * Dueño: Tony_dev (demo jugable).
 */

// Retardo del event loop: cuánto se atrasa un timer de 500 ms (indica saturación del proceso).
const g = globalThis as unknown as { __lagDemo?: { ms: number } };
if (!g.__lagDemo) {
  g.__lagDemo = { ms: 0 };
  let esperado = Date.now() + 500;
  setInterval(() => {
    const ahora = Date.now();
    g.__lagDemo!.ms = Math.max(0, ahora - esperado);
    esperado = ahora + 500;
  }, 500).unref();
}

const Accion = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('lanzar'), n: z.number().int().min(1).max(1000), por_segundo: z.number().min(1).max(100) }),
  z.object({ accion: z.literal('parar') }),
]);

export async function GET() {
  const m = process.memoryUsage();
  return NextResponse.json({
    agentes: modoAgentes(),
    modelo: estadoCargaAgentes(),
    proceso: {
      memoria_mb: Math.round(m.rss / 1048576),
      heap_mb: Math.round(m.heapUsed / 1048576),
      lag_ms: g.__lagDemo!.ms,
      activo_s: Math.round(process.uptime()),
    },
    ola: ola.estado(),
  });
}

export async function POST(req: Request) {
  const denegado = exigirToken(req);
  if (denegado) return denegado;
  const parsed = Accion.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'cuerpo inválido', detalle: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.accion === 'parar') {
    ola.parar();
    return NextResponse.json({ ok: true, ola: ola.estado() });
  }
  if (!ola.lanzar(parsed.data.n, parsed.data.por_segundo)) {
    return NextResponse.json({ error: 'ya hay una ola en curso', ola: ola.estado() }, { status: 409 });
  }
  return NextResponse.json({ ok: true, ola: ola.estado() }, { status: 202 });
}
