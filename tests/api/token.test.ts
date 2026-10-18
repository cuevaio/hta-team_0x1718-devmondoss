import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as reset } from '@/app/api/demo/reset/route';
import { POST as verdict } from '@/app/api/cases/[id]/verdict/route';
import { POST as transfers } from '@/app/api/transfers/route';
import { evaluarAlerta } from '@/lib/pipeline';
import { memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';
import { exigirToken, tokenValido } from '@/lib/seguridad/token';

/**
 * Token del operador (INFRA §5): con DEMO_TOKEN, reiniciar el demo y confirmar
 * una mula exigen `x-demo-token`. Sin la variable, nada cambia.
 */

const previo = process.env.DEMO_TOKEN;

const pedido = (url: string, cuerpo?: unknown, token?: string) =>
  new Request(`http://test${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { 'x-demo-token': token }),
    },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });

const VEREDICTO = { veredicto: 'mula_confirmada', validado_por: 'analista_01' };
let casoId = '';

beforeEach(async () => {
  storeCasos.limpiar();
  memoria.limpiar();
  casoId = (await evaluarAlerta('M-01', 'x')).caso.id;
});

afterEach(() => {
  if (previo === undefined) delete process.env.DEMO_TOKEN;
  else process.env.DEMO_TOKEN = previo;
});

const confirmar = (token?: string) =>
  verdict(pedido(`/api/cases/${casoId}/verdict`, VEREDICTO, token), {
    params: Promise.resolve({ id: casoId }),
  });

describe('sin DEMO_TOKEN (laptop en localhost, tests, consola)', () => {
  it('reset y verdict funcionan sin cabecera', async () => {
    delete process.env.DEMO_TOKEN;
    expect((await confirmar()).status).toBe(200);
    expect((await reset(pedido('/api/demo/reset'))).status).toBe(200);
  });

  it('una variable vacía o de espacios cuenta como no configurada', () => {
    expect(exigirToken(pedido('/x'), { NODE_ENV: 'test', DEMO_TOKEN: '   ' })).toBeNull();
  });
});

describe('con DEMO_TOKEN', () => {
  beforeEach(() => {
    process.env.DEMO_TOKEN = 'secreto-del-operador';
  });

  it.each([
    ['sin cabecera', undefined],
    ['token incorrecto', 'otro'],
    ['token vacío', ''],
  ])('verdict %s → 401 y nada entra a la Memoria', async (_, token) => {
    expect((await confirmar(token)).status).toBe(401);
    expect(memoria.cantidad).toBe(0);
  });

  it('verdict con el token correcto entra a la Memoria', async () => {
    expect((await confirmar('secreto-del-operador')).status).toBe(200);
    expect(memoria.cantidad).toBe(1);
  });

  it('reset sin token → 401 y los casos siguen ahí', async () => {
    expect((await reset(pedido('/api/demo/reset'))).status).toBe(401);
    expect(storeCasos.cantidad).toBe(1);
  });

  it('reset con token → 200', async () => {
    expect((await reset(pedido('/api/demo/reset', undefined, 'secreto-del-operador'))).status).toBe(200);
    expect(storeCasos.cantidad).toBe(0);
  });

  it('sin token no se revela si un caso existe: 401 antes que 404', async () => {
    const r = await verdict(pedido('/api/cases/CASO-9999/verdict', VEREDICTO), {
      params: Promise.resolve({ id: 'CASO-9999' }),
    });
    expect(r.status).toBe(401);
  });

  it('los jugadores siguen pudiendo transferir: solo se protege lo del operador', async () => {
    const r = await transfers(
      pedido('/api/transfers', { transaccion: { origen: 'C-JORGE', destino: 'B-PEPE', monto: 2000, moneda: 'PEN' } }),
    );
    expect(r.status).toBe(201);
  });
});

describe('tokenValido', () => {
  it('compara exacto, incluido el largo', () => {
    expect(tokenValido('abc', 'abc')).toBe(true);
    expect(tokenValido('abcd', 'abc')).toBe(false);
    expect(tokenValido('ab', 'abc')).toBe(false);
    expect(tokenValido(null, 'abc')).toBe(false);
  });
});
