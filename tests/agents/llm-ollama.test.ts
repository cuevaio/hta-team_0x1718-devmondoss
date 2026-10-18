import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { modoAgentes, modelosOllama } from '@/lib/agents';
import { GuardianLLM } from '@/lib/agents/esquemas';
import { cabecerasOllama, configOllamaDesdeEnv, crearLlmOllama, cuerpoOllama, MIN_TOKENS_RAZONANDO } from '@/lib/agents/llm-ollama';
import { crearRunAgent } from '@/lib/agents/runtime';
import { ErrorLlm } from '@/lib/agents/llm';

/** Modo `ollama`: el modelo local con el mismo contrato que Claude. Sin red: fetch falso. */

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;
const req = { modelo: 'qwen3.5:9b', system: 'sys', user: '<datos>{}</datos>', schema: GuardianLLM, maxTokens: 120, timeoutMs: 1000 };

afterEach(() => vi.unstubAllGlobals());

describe('modo de agentes', () => {
  it('OLLAMA_MODELO activa el modo local; AGENTS_MOCK sigue mandando', () => {
    expect(modoAgentes(env({ OLLAMA_MODELO: 'qwen3.5:9b' }))).toBe('ollama');
    expect(modoAgentes(env({ OLLAMA_MODELO: 'qwen3.5:9b', ANTHROPIC_API_KEY: 'sk-ant-real' }))).toBe('ollama');
    expect(modoAgentes(env({ OLLAMA_MODELO: 'qwen3.5:9b', AGENTS_MOCK: '1' }))).toBe('simulado');
    expect(modoAgentes(env({ OLLAMA_MODELO: '  ' }))).toBe('simulado');
  });

  it('un modelo para todo, o uno capaz aparte para el Auditor', () => {
    expect(modelosOllama(env({ OLLAMA_MODELO: 'a' }))).toEqual({ rapido: 'a', capaz: 'a' });
    expect(modelosOllama(env({ OLLAMA_MODELO: 'a', OLLAMA_MODELO_CAPAZ: 'b' }))).toEqual({ rapido: 'a', capaz: 'b' });
  });
});

describe('cuerpo de /api/chat', () => {
  it('pide JSON con el esquema del agente, temperatura 0 y el modelo cargado', () => {
    const c = cuerpoOllama(req, configOllamaDesdeEnv(env({})));
    expect(c.model).toBe('qwen3.5:9b');
    expect(c.stream).toBe(false);
    expect(c.keep_alive).toBe('60m');
    expect(c.options).toEqual({ temperature: 0, num_predict: 120 });
    expect((c.format as { properties: Record<string, unknown> }).properties).toHaveProperty('respuesta');
    expect(c).not.toHaveProperty('think');
  });

  it('con razonamiento, sube el tope de tokens para no cortar el JSON', () => {
    const c = cuerpoOllama(req, configOllamaDesdeEnv(env({ OLLAMA_THINK: 'low' })));
    expect(c.think).toBe('low');
    expect(c.options.num_predict).toBe(MIN_TOKENS_RAZONANDO);
    expect(cuerpoOllama(req, configOllamaDesdeEnv(env({ OLLAMA_THINK: 'false' }))).think).toBe(false);
  });

  it('con OLLAMA_TOKEN manda la clave del puente; sin él, nada', () => {
    expect(cabecerasOllama(configOllamaDesdeEnv(env({ OLLAMA_TOKEN: 'abc' })))).toEqual({ 'content-type': 'application/json', 'x-puente-token': 'abc' });
    expect(cabecerasOllama(configOllamaDesdeEnv(env({})))).toEqual({ 'content-type': 'application/json' });
  });

  it('OLLAMA_URL sin barra final', () => {
    expect(configOllamaDesdeEnv(env({ OLLAMA_URL: 'http://otra:11434/' })).url).toBe('http://otra:11434');
  });
});

describe('caller', () => {
  it('devuelve la salida parseada y los tokens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: { content: '{"respuesta":"si","senales_extra":[]}' }, prompt_eval_count: 300, eval_count: 20 }))));
    const r = await crearLlmOllama(configOllamaDesdeEnv(env({})))(req);
    expect(r).toEqual({ salida: { respuesta: 'si', senales_extra: [] }, tokens: 320 });
  });

  it('modelo no descargado (404): error NO reintentable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 404 })));
    const e = await crearLlmOllama(configOllamaDesdeEnv(env({})))(req).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorLlm);
    expect((e as ErrorLlm).reintentable).toBe(false);
  });

  it('salida que no es JSON: el runtime reintenta una vez y luego cae al fallback', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: { content: 'hola, no soy JSON' } })));
    vi.stubGlobal('fetch', fetch);
    const runAgent = crearRunAgent({ caller: crearLlmOllama(configOllamaDesdeEnv(env({}))), modelos: { rapido: 'm', capaz: 'm' } });
    await expect(runAgent('guardian', {}, z.object({ respuesta: z.string() }), { nivel: 'rapido', maxLlamadas: 2, timeoutMs: 1000 })).rejects.toThrow(/sin salida válida/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Ollama apagado: error reintentable (red)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed');
    }));
    const e = await crearLlmOllama(configOllamaDesdeEnv(env({})))(req).catch((x: unknown) => x);
    expect((e as ErrorLlm).reintentable).toBe(true);
  });
});
