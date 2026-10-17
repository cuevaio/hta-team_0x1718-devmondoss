import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

/**
 * Frontera con el proveedor de LLM. Todo lo demás depende de `LlmCaller`, así
 * que en tests se inyecta uno falso y no se gasta un token.
 *
 * Restricciones de la API: docs/context/tony_dev/AGENTS_RUNTIME_NOTES.md
 *   - structured outputs (`output_config.format`), nunca tool use forzado ni prefill
 *   - `effort: low` y sin thinking: el razonamiento ya está en el playbook
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

export function crearLlmAnthropic(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY): LlmCaller {
  if (!apiKey || apiKey.startsWith('sk-ant-...')) {
    throw new Error('Falta ANTHROPIC_API_KEY (o usa AGENTS_MOCK=1)');
  }
  const client = new Anthropic({ apiKey });

  return async (req) => {
    const msg = await client.messages.parse(
      {
        model: req.modelo,
        max_tokens: req.maxTokens,
        thinking: { type: 'disabled' },
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: req.user }],
        output_config: { effort: 'low', format: zodOutputFormat(req.schema) },
      },
      { timeout: req.timeoutMs },
    );
    return {
      salida: msg.parsed_output,
      tokens: msg.usage.input_tokens + msg.usage.output_tokens,
    };
  };
}
