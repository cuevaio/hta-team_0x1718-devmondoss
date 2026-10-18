import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

/**
 * Frontera con el proveedor de LLM. Todo lo demás depende de `LlmCaller`, así
 * que en tests se inyecta uno falso y no se gasta un token.
 *
 * Restricciones de la API: docs/context/tony_dev/AGENTS_RUNTIME_NOTES.md
 *   - structured outputs (`output_config.format`), nunca tool use forzado ni prefill
 *   - `effort: low`: el razonamiento ya está en el playbook
 *   - thinking: SOLO Haiku acepta `{type: 'disabled'}`. Opus 5.5 (el Auditor)
 *     y Sonnet 5.5 lo rechazan con 400 en toda llamada: ahí se omite y el
 *     thinking es adaptativo, controlado por `effort`.
 */

export interface SolicitudLlm {
  modelo: string;
  /** Parte estática (esqueleto del prompt): va con cache_control. */
  system: string;
  /** Briefing variable, ya dentro de `<datos>…</datos>`. */
  user: string;
  schema: z.ZodType;
  maxTokens: number;
  timeoutMs: number;
}

export interface RespuestaLlm {
  /** Objeto ya parseado por el SDK; el runtime lo vuelve a validar. */
  salida: unknown;
  tokens: number;
}

export type LlmCaller = (req: SolicitudLlm) => Promise<RespuestaLlm>;

/**
 * Error del proveedor que NO vale la pena reintentar (rechazo de seguridad,
 * petición inválida): el runtime pasa directo al fallback en vez de gastar
 * otra llamada y otro timeout.
 */
export class ErrorLlm extends Error {
  constructor(
    message: string,
    readonly reintentable: boolean,
  ) {
    super(message);
    this.name = 'ErrorLlm';
  }
}

/** ¿El modelo acepta `thinking: {type: 'disabled'}`? Solo la familia Haiku. */
export function aceptaThinkingDesactivado(modelo: string): boolean {
  return /^claude-haiku-/.test(modelo);
}

/**
 * Con thinking activo, `max_tokens` es el tope de thinking + respuesta. El
 * tope de 700 del Auditor alcanzaba para el JSON, no para pensar antes: se
 * cortaba y la salida llegaba vacía.
 */
export const MIN_TOKENS_CON_THINKING = 4_000;

/** Parámetros de `messages.parse`, separados para poder testearlos sin red. */
export function parametrosMensaje(req: SolicitudLlm) {
  const sinThinking = aceptaThinkingDesactivado(req.modelo);
  return {
    model: req.modelo,
    max_tokens: sinThinking ? req.maxTokens : Math.max(req.maxTokens, MIN_TOKENS_CON_THINKING),
    ...(sinThinking ? { thinking: { type: 'disabled' as const } } : {}),
    system: [{ type: 'text' as const, text: req.system, cache_control: { type: 'ephemeral' as const } }],
    messages: [{ role: 'user' as const, content: req.user }],
    output_config: { effort: 'low' as const, format: zodOutputFormat(req.schema) },
  };
}

export function crearLlmAnthropic(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY): LlmCaller {
  if (!apiKey || apiKey.startsWith('sk-ant-...')) {
    throw new Error('Falta ANTHROPIC_API_KEY (o usa AGENTS_MOCK=1)');
  }
  // maxRetries: 0 — el runtime ya reintenta una vez. Con el valor por defecto
  // (2) los reintentos se multiplicaban: 2 intentos × 3 envíos × timeout, hasta
  // ~150 s colgado por agente con el Wi-Fi de un evento.
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return async (req) => {
    const msg = await client.messages.parse(parametrosMensaje(req), { timeout: req.timeoutMs });
    const tokens = msg.usage.input_tokens + msg.usage.output_tokens;
    if (msg.stop_reason === 'refusal') {
      throw new ErrorLlm('el modelo rechazó la solicitud (refusal)', false);
    }
    return { salida: msg.parsed_output, tokens };
  };
}
