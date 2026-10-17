import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AgentError, crearRunAgent } from '@/lib/agents/runtime';
import type { LlmCaller, SolicitudLlm } from '@/lib/agents/llm';
import { DetectiveLLM } from '@/lib/agents/esquemas';

const OK = { riesgo_destino: 'bajo', hipotesis: 'ok', evidencia: ['E-01'] };
const MODELOS = { rapido: 'modelo-rapido', capaz: 'modelo-capaz' };
const op = { nivel: 'rapido' as const, maxLlamadas: 2, timeoutMs: 1000 };

function caller(salidas: unknown[]) {
  const reqs: SolicitudLlm[] = [];
  let i = 0;
  const fn: LlmCaller = async (req) => {
    reqs.push(req);
    const s = salidas[Math.min(i++, salidas.length - 1)];
    if (s instanceof Error) throw s;
    return { salida: s, tokens: 50 };
  };
  return { fn, reqs };
}

describe('runAgent', () => {
  it('devuelve la salida validada y cuenta tokens y llamadas', async () => {
    const { fn, reqs } = caller([OK]);
    const r = await crearRunAgent({ caller: fn, modelos: MODELOS })('detective', { a: 1 }, DetectiveLLM, op);
    expect(r.salida).toEqual(OK);
    expect(r.uso).toMatchObject({ llamadas: 1, tokens: 50 });
    expect(reqs[0].modelo).toBe('modelo-rapido');
    expect(reqs[0].user).toContain('<datos>');
    expect(reqs[0].maxTokens).toBe(400);
  });
  it('usa el modelo del nivel `capaz` para el Auditor', async () => {
    const { fn, reqs } = caller([{ ok: true }]);
    await crearRunAgent({ caller: fn, modelos: MODELOS })('auditor', {}, z.object({ ok: z.boolean() }), { ...op, nivel: 'capaz' });
    expect(reqs[0].modelo).toBe('modelo-capaz');
    expect(reqs[0].maxTokens).toBe(700);
  });
  it('salida inválida → 1 reintento con aviso, y se recupera', async () => {
    const { fn, reqs } = caller([{ riesgo_destino: 'alto' }, OK]);
    const r = await crearRunAgent({ caller: fn, modelos: MODELOS })('detective', {}, DetectiveLLM, op);
    expect(r.uso.llamadas).toBe(2);
    expect(reqs[1].user).toContain('no cumplió el esquema');
  });
  it('dos salidas inválidas → AgentError con el uso consumido', async () => {
    const { fn } = caller([{ x: 1 }]);
    const run = crearRunAgent({ caller: fn, modelos: MODELOS });
    await expect(run('detective', {}, DetectiveLLM, op)).rejects.toMatchObject({ name: 'AgentError', uso: { llamadas: 2 } });
  });
  it('maxLlamadas: 1 no reintenta', async () => {
    const { fn, reqs } = caller([{ x: 1 }]);
    await expect(crearRunAgent({ caller: fn, modelos: MODELOS })('detective', {}, DetectiveLLM, { ...op, maxLlamadas: 1 })).rejects.toBeInstanceOf(AgentError);
    expect(reqs).toHaveLength(1);
  });
  it('un error de red también termina en AgentError (para que el adaptador use su fallback)', async () => {
    const { fn } = caller([new Error('timeout')]);
    await expect(crearRunAgent({ caller: fn, modelos: MODELOS })('guardian', {}, DetectiveLLM, op)).rejects.toThrow(/timeout/);
  });
});
