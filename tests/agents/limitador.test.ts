import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { limitar, SaturacionLlm, type ConfigLimitador } from '@/lib/agents/limitador';
import type { LlmCaller } from '@/lib/agents/llm';
import { ErrorLlm } from '@/lib/agents/llm';

/** Resistencia a la saturación del modelo: cola acotada y cortacircuitos. */

const cfg: ConfigLimitador = { concurrencia: 1, colaMax: 1, esperaMaxMs: 50, umbralFallas: 2, ventanaMs: 10_000, pausaMs: 1_000 };
const req = { modelo: 'm', system: '', user: '', schema: z.object({}), maxTokens: 10, timeoutMs: 2_000 };

/** Caller falso que tarda `ms` y luego responde (o falla). */
const lento = (ms: number, falla = false): LlmCaller => async () => {
  await new Promise((r) => setTimeout(r, ms));
  if (falla) throw new ErrorLlm('timeout', true);
  return { salida: {}, tokens: 1 };
};

describe('limitador del modelo', () => {
  it('atiende de a N y encola el resto', async () => {
    const l = limitar(lento(20), { ...cfg, colaMax: 5, esperaMaxMs: 1_000 });
    await Promise.all([l.caller(req), l.caller(req), l.caller(req)]);
    expect(l.estado().atendidas).toBe(3);
    expect(l.estado().en_curso).toBe(0);
  });

  it('cola llena o sin turno a tiempo: rechaza YA como saturado (no reintentable)', async () => {
    const l = limitar(lento(200), cfg);
    const resultados = await Promise.allSettled([l.caller(req), l.caller(req), l.caller(req)]);
    const rechazos = resultados.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason);
    expect(rechazos.length).toBe(2); // uno por cola llena y otro por no tener turno en 50 ms
    for (const e of rechazos) {
      expect(e).toBeInstanceOf(SaturacionLlm);
      expect((e as ErrorLlm).reintentable).toBe(false);
    }
    expect(l.estado().saturadas).toBe(2);
    expect(l.estado().ultimo_minuto.degradadas).toBe(2);
  });

  it('cortacircuitos: tras varias fallas deja de llamar al modelo y luego prueba de nuevo', async () => {
    let t = 0;
    let llamadas = 0;
    let fallar = true;
    const caller: LlmCaller = async () => {
      llamadas++;
      if (fallar) throw new ErrorLlm('timeout', true);
      return { salida: {}, tokens: 1 };
    };
    const l = limitar(caller, { ...cfg, colaMax: 5 }, () => t);
    await l.caller(req).catch(() => undefined);
    await l.caller(req).catch(() => undefined);
    expect(l.estado().circuito).toBe('abierto');
    await expect(l.caller(req)).rejects.toThrow(/circuito abierto/);
    expect(llamadas).toBe(2); // con el circuito abierto ni se intenta
    t += 1_500; // pasa la pausa
    fallar = false;
    await l.caller(req);
    expect(l.estado().circuito).toBe('cerrado');
    expect(llamadas).toBe(3);
  });

  it('una petición inválida (404) no cuenta como falla de carga', async () => {
    const l = limitar(async () => {
      throw new ErrorLlm('modelo no existe', false);
    }, cfg);
    for (let i = 0; i < 3; i++) await l.caller(req).catch(() => undefined);
    expect(l.estado().circuito).toBe('cerrado');
  });
});
