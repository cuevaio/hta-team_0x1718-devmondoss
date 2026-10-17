import type { z } from 'zod';
import type { Evidencia, RunAgent, ToolContext, UsoAgente } from '@/lib/contracts';

export interface DepsAgentes {
  runAgent: RunAgent;
}

export const USO_CERO: UsoAgente = { llamadas: 0, tokens: 0, ms: 0 };

export function sumarUso(...usos: UsoAgente[]): UsoAgente {
  return usos.reduce(
    (a, u) => ({ llamadas: a.llamadas + u.llamadas, tokens: a.tokens + u.tokens, ms: a.ms + u.ms }),
    USO_CERO,
  );
}

export interface LlamadaTool<T> {
  data: T;
  evidencia: Evidencia[];
}

/**
 * Llama `ctx.analytics[fuente](cuenta)` y valida el `data` con su esquema.
 * Devuelve `null` si la tool no existe, falla o devuelve una forma inesperada:
 * el agente sigue con lo que tenga (un fallo de tool nunca tumba el caso).
 */
export async function llamarTool<S extends z.ZodType>(
  ctx: ToolContext,
  fuente: string,
  arg: string,
  schema: S,
): Promise<LlamadaTool<z.infer<S>> | null> {
  const tool = ctx.analytics?.[fuente];
  if (typeof tool !== 'function') return null;
  try {
    const r = (await tool(arg)) as { data: unknown; evidencia?: Evidencia[] };
    const parsed = schema.safeParse(r.data);
    if (!parsed.success) return null;
    return { data: parsed.data, evidencia: r.evidencia ?? [] };
  } catch {
    return null;
  }
}

/** Evidencia que ya está en el caso, por fuente; evita volver a llamar la misma tool. */
export function evidenciaDelCaso<S extends z.ZodType>(
  evidencia: Evidencia[],
  fuente: string,
  schema: S,
  cuenta?: string,
): LlamadaTool<z.infer<S>> | null {
  for (const e of evidencia) {
    if (e.fuente !== fuente) continue;
    const p = schema.safeParse(e.dato);
    if (!p.success) continue;
    if (cuenta && (p.data as { cuenta?: string }).cuenta !== cuenta) continue;
    return { data: p.data, evidencia: [e] };
  }
  return null;
}
