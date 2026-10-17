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
      }
    }
    uso.ms = Date.now() - t0;
    throw new AgentError(`${nombre}: sin salida válida (${ultimoError})`, uso);
  };
}
