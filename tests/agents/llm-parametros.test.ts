import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  ErrorLlm,
  MIN_TOKENS_CON_THINKING,
  aceptaThinkingDesactivado,
  parametrosMensaje,
  type LlmCaller,
  type SolicitudLlm,
} from '@/lib/agents/llm';
import { AgentError, crearRunAgent, esReintentable } from '@/lib/agents/runtime';

/**
 * El camino hacia Claude nunca corrió contra la API real (no hay key). Estos
 * tests fijan lo que la documentación del modelo exige, para que el primer
 * contacto con la API no falle en vivo.
 */

const req = (modelo: string, maxTokens = 700): SolicitudLlm => ({
  modelo,
  system: 'sys',
  user: '<datos>{}</datos>',
  schema: z.object({ ok: z.boolean() }),
  maxTokens,
  timeoutMs: 1000,
});

describe('parametrosMensaje — thinking por modelo', () => {
  it('Haiku (Coordinador, Guardián, Detective): thinking desactivado y el tope original', () => {
    const p = parametrosMensaje(req('claude-haiku-5-5', 120));
    expect(p.thinking).toEqual({ type: 'disabled' });
    expect(p.max_tokens).toBe(120);
  });

  it('Opus 5.5 (Auditor): NO manda thinking disabled — la API responde 400', () => {
    const p = parametrosMensaje(req('claude-opus-5-5'));
    expect('thinking' in p).toBe(false);
  });

  it('Opus 5.5: max_tokens alcanza para pensar y responder', () => {
    expect(parametrosMensaje(req('claude-opus-5-5', 700)).max_tokens).toBeGreaterThanOrEqual(MIN_TOKENS_CON_THINKING);
  });

  it('Sonnet 5.5 también rechaza disabled: se omite', () => {
    expect(aceptaThinkingDesactivado('claude-sonnet-5-5')).toBe(false);
  });

  it('siempre: structured outputs, effort low, system cacheable, sin prefill', () => {
    const p = parametrosMensaje(req('claude-opus-5-5'));
    expect(p.output_config.effort).toBe('low');
    expect(p.output_config.format).toBeDefined();
    expect(p.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(p.messages).toHaveLength(1);
    expect(p.messages[0].role).toBe('user');
  });
});

describe('esReintentable', () => {
  it.each([408, 409, 429, 500, 529])('%i → sí', (status) => {
    expect(esReintentable({ status })).toBe(true);
  });
  it.each([400, 401, 403, 404, 413, 422])('%i → no', (status) => {
    expect(esReintentable({ status })).toBe(false);
  });
  it('red o timeout (sin status) → sí', () => {
    expect(esReintentable(new Error('ECONNRESET'))).toBe(true);
  });
  it('rechazo del modelo → no', () => {
    expect(esReintentable(new ErrorLlm('refusal', false))).toBe(false);
  });
});

describe('runAgent — no gasta un segundo intento en lo que no se arregla solo', () => {
  const schema = z.object({ ok: z.boolean() });
  const opciones = { nivel: 'capaz' as const, maxLlamadas: 2, timeoutMs: 1000 };
  const correr = (caller: LlmCaller) =>
    crearRunAgent({ caller, modelos: { rapido: 'claude-haiku-5-5', capaz: 'claude-opus-5-5' } })(
      'auditor',
      {},
      schema,
      opciones,
    );

  it('400 → AgentError con 1 sola llamada', async () => {
    const caller: LlmCaller = async () => {
      throw Object.assign(new Error('invalid_request_error'), { status: 400 });
    };
    const e = await correr(caller).catch((x) => x);
    expect(e).toBeInstanceOf(AgentError);
    expect(e.uso.llamadas).toBe(1);
  });

  it('529 (sobrecarga) → reintenta una vez y se recupera', async () => {
    let n = 0;
    const caller: LlmCaller = async () => {
      if (n++ === 0) throw Object.assign(new Error('overloaded'), { status: 529 });
      return { salida: { ok: true }, tokens: 10 };
    };
    const r = await correr(caller);
    expect(r.salida).toEqual({ ok: true });
    expect(r.uso.llamadas).toBe(2);
  });
});
