import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST as crearSala } from '@/app/api/juego/salas/route';
import { POST as accionar } from '@/app/api/juego/salas/[codigo]/route';
import { GET as feed } from '@/app/api/cases/route';
import { storeCasos } from '@/lib/cases/store';
import { memoria, crearVeredicto } from '@/lib/memory/store';
import { repo } from '@/lib/data/repo';
import { ATAQUE_MS, CUENTA_MS, MAX_GOLPES, type ResultadoGolpe, type VistaSala } from '@/lib/juego/salas';
import type { Golpe } from '@/lib/juego/golpes';
import type { ResumenCaso } from '@/lib/cases/resumen';

/**
 * EN VIVO · LA BANDA por la ruta: un golpe tiene que pasar por el **pipeline
 * real** y terminar como un caso del monitor, con el alias del jugador. Esto
 * es lo que se proyecta en el evento, así que vale probarlo de punta a punta.
 *
 * Se finge solo el reloj (`toFake: ['Date']`) para saltar la cuenta de 3 s sin
 * tocar los `setTimeout` del pipeline.
 */

/**
 * Cada jugador es su celular: el navegador manda la cookie `ter_jugador` en
 * cada pedido (lib/juego/jugador.ts). Aquí, una cookie fija por apodo.
 */
const celular = (alias: string) => {
  const h = createHash('sha256').update(alias.toLowerCase()).digest('hex').toUpperCase();
  return `ter_jugador=J-${h.slice(0, 9)}-${h.slice(9, 21)}`;
};

const post = (codigo: string, cuerpo: unknown) => {
  const alias = (cuerpo as { alias?: string }).alias;
  return accionar(
    new Request(`http://test/api/juego/salas/${codigo}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(alias ? { cookie: celular(alias) } : {}) },
      body: JSON.stringify(cuerpo),
    }),
    { params: Promise.resolve({ codigo }) },
  );
};

const GOLPE: Golpe = { victima: 'rosa', tactica: 'falso_banco', destino: 'M-01', monto: 'todo', madrugada: false };

const avanzar = (ms: number) => vi.setSystemTime(Date.now() + ms);

/** Crea una sala de LA BANDA, la arranca y salta a la fase de ataque. */
async function salaEnAtaque(alias = 'Ana') {
  const c = await crearSala(
    new Request('http://test/api/juego/salas', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: celular(alias) },
      body: JSON.stringify({ alias, pais: 'pe', juego: 'banda' }),
    }),
  );
  expect(c.status).toBe(201);
  const { codigo, token } = (await c.json()) as { codigo: string; token: string };
  await post(codigo, { accion: 'iniciar', token });
  avanzar(CUENTA_MS);
  return { codigo, token };
}

const golpear = async (codigo: string, alias: string, golpe: Golpe) => {
  const r = await post(codigo, { accion: 'golpe', alias, golpe });
  return { status: r.status, body: (await r.json()) as ResultadoGolpe & { error?: string } };
};

const cases = async () => {
  const r = await feed(new Request('http://test/api/cases'));
  return (await r.json()) as { total: number; casos: ResumenCaso[] };
};

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('POST /api/juego/salas/[codigo] — golpe', () => {
  it('el golpe pasa por el pipeline y queda como caso del monitor con el alias', async () => {
    const { codigo } = await salaEnAtaque();
    const { status, body } = await golpear(codigo, 'Ana', GOLPE);
    expect(status).toBe(200);
    expect(body.caso.decision).toBeTruthy();
    expect(body.golpe.caso).toBe(body.caso.id);

    const lista = await cases();
    expect(lista.total).toBe(1);
    expect(lista.casos[0]).toMatchObject({ id: body.caso.id, alias: 'Ana', origen: 'C-ROSA', destino: 'M-01' });
  });

  it('el falso banco con todo el dinero a una cuenta de paso NO pasa', async () => {
    const { codigo } = await salaEnAtaque();
    const { body } = await golpear(codigo, 'Ana', GOLPE);
    expect(body.golpe.frenado).toBe(true);
    expect(body.caso.decision!.accion).not.toBe('PERMITIR');
    expect(body.golpe.puntos).toBe(100);
  });

  it('con la cuenta ya confirmada como mula, la Memoria frena sin gastar IA (P1)', async () => {
    memoria.confirm(
      'M-02',
      crearVeredicto({ cuenta: 'M-02', veredicto: 'mula_confirmada', validado_por: 'analista_test', expediente: 'X', hoy: repo.ahora() }),
    );
    const { codigo } = await salaEnAtaque();
    const { body } = await golpear(codigo, 'Ana', { ...GOLPE, destino: 'M-02', tactica: 'falso_familiar', monto: 'chico' });
    expect(body.golpe).toMatchObject({ frenado: true, regla: 'P1', llamadas_ia: 0 });
  });

  it('una cuenta, víctima, táctica o monto inventados se rechazan (400) y no llegan al pipeline', async () => {
    const { codigo } = await salaEnAtaque();
    for (const golpe of [
      { ...GOLPE, destino: 'C-ROSA' },
      { ...GOLPE, monto: 999999 },
      { ...GOLPE, victima: 'pepe' },
      { ...GOLPE, tactica: 'inventada' },
    ]) {
      const r = await post(codigo, { accion: 'golpe', alias: 'Ana', golpe });
      expect(r.status).toBe(400);
    }
    expect((await cases()).total).toBe(0);
  });

  it('fuera de la fase de ataque devuelve 409, y sin unirse 403', async () => {
    const { codigo, token } = await salaEnAtaque();
    const colado = await golpear(codigo, 'Zoe', GOLPE);
    expect(colado.status).toBe(403);
    avanzar(ATAQUE_MS);
    const tarde = await golpear(codigo, 'Ana', GOLPE);
    expect(tarde.status).toBe(409);
    // Y antes de empezar, tampoco.
    await post(codigo, { accion: 'reiniciar', token });
    const antes = await golpear(codigo, 'Ana', GOLPE);
    expect(antes.status).toBe(409);
  });

  it('golpes muy seguidos del mismo jugador: 429 (el pipeline es real)', async () => {
    const { codigo } = await salaEnAtaque();
    expect((await golpear(codigo, 'Ana', GOLPE)).status).toBe(200);
    const rapido = await golpear(codigo, 'Ana', { ...GOLPE, monto: 'chico' });
    expect(rapido.status).toBe(429);
  });

  it('la vista trae los últimos golpes de la sala (lo que proyecta el monitor)', async () => {
    const { codigo } = await salaEnAtaque();
    await post(codigo, { accion: 'unirse', alias: 'Beto', pais: 'cl' });
    await golpear(codigo, 'Ana', GOLPE);
    await golpear(codigo, 'Beto', { ...GOLPE, tactica: 'falso_familiar', monto: 'chico' });
    const r = await post(codigo, { accion: 'unirse', alias: 'Beto', pais: 'cl' });
    const v = (await r.json()) as VistaSala;
    expect(v.banda!.golpes).toBe(2);
    expect(v.banda!.ultimos.map((g) => g.alias)).toEqual(['Beto', 'Ana']);
    expect(v.mio!.banda!.restantes).toBe(MAX_GOLPES - 1);
  });
});
