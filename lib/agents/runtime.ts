import type { z } from 'zod';
import type { RunAgent, UsoAgente } from '@/lib/contracts';
import type { LlmCaller } from './llm';
import { MAX_TOKENS, SYSTEM, envolverBriefing } from './prompts';

/**
 * runAgent: una llamada acotada al LLM con salida validada.
 *   - structured outputs + validación zod propia
 *   - 1 reintento si la salida no valida (cuenta contra `maxLlamadas`)
 *   - lanza `AgentError` si no hay salida válida: cada adaptador cae a su
 *     fallback determinista (modo seguro), nunca se queda sin respuesta
 */

export class AgentError extends Error {
  constructor(
    message: string,
    readonly uso: UsoAgente,
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export interface ConfigRuntime {
  caller: LlmCaller;
  modelos: { rapido: string; capaz: string };
}

export function modelosDesdeEnv(env: NodeJS.ProcessEnv = process.env): ConfigRuntime['modelos'] {
  return {
    rapido: env.MODELO_RAPIDO ?? 'claude-haiku-5-5',
    capaz: env.MODELO_CAPAZ ?? 'claude-opus-5-5',
  };
}

/**
 * ¿Vale la pena reintentar? Sí: red, timeout, 408/409/429 y 5xx (incluido el
 * 529 de sobrecarga). No: 400/401/403/404/413/422 —una petición inválida o
 * una key mala dan lo mismo la segunda vez— ni un rechazo del modelo.
 */
export function esReintentable(err: unknown): boolean {
  if ((err as { reintentable?: boolean }).reintentable === false) return false;
  const status = (err as { status?: number }).status;
  if (typeof status !== 'number') return true; // red o timeout
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function crearRunAgent(cfg: ConfigRuntime): RunAgent {
  return async function runAgent<S extends z.ZodType>(
    nombre: Parameters<RunAgent>[0],
    input: unknown,
    schema: S,
    opciones: Parameters<RunAgent>[3],
  ) {
    const uso: UsoAgente = { llamadas: 0, tokens: 0, ms: 0 };
    const t0 = Date.now();
    const intentos = Math.max(1, Math.min(2, opciones.maxLlamadas));
    let nota = '';
    let ultimoError = 'sin intentos';

    for (let i = 0; i < intentos; i++) {
      uso.llamadas += 1;
      try {
        const r = await cfg.caller({
          modelo: cfg.modelos[opciones.nivel],
          system: SYSTEM[nombre],
          user: envolverBriefing(input) + nota,
          schema,
          maxTokens: MAX_TOKENS[nombre],
          timeoutMs: opciones.timeoutMs,
        });
        uso.tokens += r.tokens;
        const parsed = schema.safeParse(r.salida);
        if (parsed.success) {
          uso.ms = Date.now() - t0;
          return { salida: parsed.data as z.infer<S>, uso };
        }
        ultimoError = parsed.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        nota = '\nTu salida anterior no cumplió el esquema. Responde solo con el JSON pedido.';
      } catch (err) {
        ultimoError = err instanceof Error ? err.message : String(err);
        if (!esReintentable(err)) break; // directo al fallback: no gastar otro intento
      }
    }
    uso.ms = Date.now() - t0;
    throw new AgentError(`${nombre}: sin salida válida (${ultimoError})`, uso);
  };
}
