import { NextResponse } from 'next/server';
import { LISTA_PRUEBAS, correrSuite } from '@/lib/demo/suite';
import { modoAgentes, modelosOllama } from '@/lib/agents';
import { exigirToken } from '@/lib/seguridad/token';

/**
 * Suite en vivo del backend (lib/demo/suite.ts), para el panel `/demo`.
 *
 * GET  la lista de pruebas y con qué agentes correrían. Público.
 * POST corre la suite y entrega un resultado por línea (NDJSON) apenas
 *      termina cada prueba. Exige token de operador si hay `DEMO_TOKEN`: toca
 *      la Memoria (la guarda y la repone) y una sola corrida a la vez (409).
 */
export const dynamic = 'force-dynamic';

const g = globalThis as unknown as { __suiteCorriendo?: boolean };

function agentes() {
  const modo = modoAgentes();
  return { modo, modelo: modo === 'ollama' ? modelosOllama().rapido : null };
}

export async function GET() {
  return NextResponse.json({ pruebas: LISTA_PRUEBAS, agentes: agentes() });
}

export async function POST(req: Request) {
  const denegado = exigirToken(req);
  if (denegado) return denegado;
  if (g.__suiteCorriendo) return NextResponse.json({ error: 'la suite ya está corriendo' }, { status: 409 });
  g.__suiteCorriendo = true;

  const codificar = new TextEncoder();
  const flujo = new ReadableStream<Uint8Array>({
    async start(control) {
      try {
        for await (const r of correrSuite()) control.enqueue(codificar.encode(JSON.stringify(r) + '\n'));
      } finally {
        g.__suiteCorriendo = false;
        control.close();
      }
    },
  });
  return new Response(flujo, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
