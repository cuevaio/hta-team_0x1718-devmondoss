import { z } from 'zod';
import { ErrorLlm, type LlmCaller, type SolicitudLlm } from './llm';

/**
 * LLM local con Ollama (INFRA_Y_ORQUESTACION §6). Mismo contrato que el de
 * Anthropic (`LlmCaller`): los agentes, el runtime y sus fallbacks no cambian.
 *
 *   - Salida con **esquema JSON** (`format`), generado desde el esquema zod
 *     del agente. El runtime lo vuelve a validar y reintenta una vez.
 *   - `temperature: 0`: lo que se busca es consistencia, no creatividad.
 *   - `keep_alive`: el modelo se queda cargado; la primera carga (varios
 *     segundos) se adelanta con `calentarOllama` al arrancar el servidor.
 *   - Modelos con razonamiento (gpt-oss, qwen3…): `OLLAMA_THINK` controla
 *     cuánto piensan (`low`/`medium`/`high`, o `false`). El tope de tokens
 *     sube para que el razonamiento no corte el JSON.
 *
 * Ollama queda en localhost: NO se expone a internet (su API también permite
 * bajar y borrar modelos). Lo que se publica es la app, con el túnel.
 */

export interface ConfigOllama {
  url: string;
  /** `false` o un nivel; sin definir, se deja al modelo. */
  think?: boolean | 'low' | 'medium' | 'high';
  keepAlive: string;
}

export function configOllamaDesdeEnv(env: NodeJS.ProcessEnv = process.env): ConfigOllama {
  const t = env.OLLAMA_THINK?.trim().toLowerCase();
  const think = t === undefined || t === '' ? undefined : t === 'false' || t === '0' ? false : t === 'true' ? true : (t as ConfigOllama['think']);
  return {
    url: (env.OLLAMA_URL?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
    think,
    keepAlive: env.OLLAMA_KEEP_ALIVE?.trim() || '60m',
  };
}

/** Tokens mínimos cuando el modelo razona antes de responder. */
export const MIN_TOKENS_RAZONANDO = 2_000;

/** Cuerpo de `/api/chat`, separado para testearlo sin red. */
export function cuerpoOllama(req: SolicitudLlm, cfg: ConfigOllama) {
  const razona = cfg.think !== undefined && cfg.think !== false;
  return {
    model: req.modelo,
    stream: false,
    keep_alive: cfg.keepAlive,
    format: z.toJSONSchema(req.schema, { target: 'draft-7' }),
    ...(cfg.think !== undefined ? { think: cfg.think } : {}),
    options: { temperature: 0, num_predict: razona ? Math.max(req.maxTokens, MIN_TOKENS_RAZONANDO) : req.maxTokens },
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: `${req.user}\n\nResponde SOLO con un objeto JSON que cumpla el esquema.` },
    ],
  };
}

type RespuestaChat = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
};

export function crearLlmOllama(cfg: ConfigOllama = configOllamaDesdeEnv()): LlmCaller {
  return async (req) => {
    let res: Response;
    try {
      res = await fetch(`${cfg.url}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpoOllama(req, cfg)),
        signal: AbortSignal.timeout(req.timeoutMs),
      });
    } catch (e) {
      // Ollama apagado o timeout: reintentable (el runtime decide).
      throw new ErrorLlm(`Ollama no respondió: ${e instanceof Error ? e.message : String(e)}`, true);
    }
    const body = (await res.json().catch(() => null)) as RespuestaChat | null;
    if (!res.ok) {
      // 404 = el modelo no está descargado: reintentar no sirve.
      throw Object.assign(new ErrorLlm(`Ollama ${res.status}: ${body?.error ?? 'error'}`, res.status >= 500 || res.status === 429), { status: res.status });
    }
    const tokens = (body?.prompt_eval_count ?? 0) + (body?.eval_count ?? 0);
    const texto = body?.message?.content ?? '';
    let salida: unknown = undefined;
    try {
      salida = JSON.parse(texto);
    } catch {
      // Salida no JSON: el runtime la marca inválida y reintenta con la nota.
    }
    return { salida, tokens };
  };
}

/**
 * Carga los modelos en memoria antes de la primera transferencia (la primera
 * carga puede tardar más que el timeout del Guardián). No falla nunca.
 */
export async function calentarOllama(modelos: string[], cfg: ConfigOllama = configOllamaDesdeEnv()): Promise<string[]> {
  const listos: string[] = [];
  for (const model of [...new Set(modelos)]) {
    try {
      const r = await fetch(`${cfg.url}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: '', keep_alive: cfg.keepAlive }),
        signal: AbortSignal.timeout(120_000),
      });
      if (r.ok) listos.push(model);
    } catch {
      // si no carga, la primera llamada lo hará (o caerá al fallback)
    }
  }
  return listos;
}
