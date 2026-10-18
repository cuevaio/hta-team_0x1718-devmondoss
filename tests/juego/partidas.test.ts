import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST as registrar, GET as listar, DELETE as borrar } from '@/app/api/juego/partidas/route';
import { GET as resumen } from '@/app/api/juego/resumen/route';
import { POST as reset } from '@/app/api/demo/reset/route';
import { evaluarTransferencia } from '@/lib/pipeline';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';
import { repo } from '@/lib/data/repo';
import { RegistroPartidas, partidas } from '@/lib/juego/partidas';
import { resumenPartidas } from '@/lib/juego/resumen';

/** Partidas del demo jugable y su resumen (DEMO_JUEGO §6). */

const json = (url: string, method: string, cuerpo?: unknown, token?: string) =>
  new Request(`http://test${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { 'x-demo-token': token } : {}) },
    ...(cuerpo === undefined ? {} : { body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) }),
  });

const tx = (origen: string, destino: string, monto: number) => ({ origen, destino, monto, moneda: 'PEN' as const });

/** Un intento real de atacante: «falso banco» contra Rosa → frenado. */
const intentoFrenado = async () =>
  (
    await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí, me está guiando un asesor del banco',
    })
  ).caso.id;

/** «El hueco honesto»: monto chico a una cuenta nueva, sin señales → pasa (P3). */
const intentoLogrado = async () => (await evaluarTransferencia(tx('C-JORGE', 'M-02', 300))).caso.id;

const victima = (casos: string[], extra: Record<string, unknown> = {}) => ({
  rol: 'victima',
  alias: 'Ana',
  ronda_a: { cayo: true, frustracion: 4 },
  ronda_b: { casos, pausa_molesto: 'un_poco' },
  activaria: 'si',
  ...extra,
});

const previoToken = process.env.DEMO_TOKEN;

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
  partidas.limpiar();
  delete process.env.DEMO_TOKEN;
});

afterEach(() => {
  if (previoToken === undefined) delete process.env.DEMO_TOKEN;
  else process.env.DEMO_TOKEN = previoToken;
});

describe('POST /api/juego/partidas', () => {
  it('registra un atacante y copia los hechos de sus casos', async () => {
    const frenado = await intentoFrenado();
    const logrado = await intentoLogrado();
    const r = await registrar(
      json('/api/juego/partidas', 'POST', {
        rol: 'atacante',
        alias: 'Zorro',
        intentos: [
          { caso: frenado, tactica: 'falso_banco' },
          { caso: logrado, tactica: 'falso_familiar' },
        ],
        idea: 'probaría con montos aún más chicos',
      }),
    );
    expect(r.status).toBe(201);
    const p = await r.json();
    expect(p.hechos).toEqual([
      { caso: frenado, creado: expect.any(String), accion: 'ESCALAR', regla: 'P4', monto: 4800, destino: 'M-01', tactica: 'falso_banco' },
      { caso: logrado, creado: expect.any(String), accion: 'PERMITIR', regla: 'P3', monto: 300, destino: 'M-02', tactica: 'falso_familiar' },
    ]);
  });

  it('un caso que no existe → 400: no se pueden inventar resultados', async () => {
    const r = await registrar(json('/api/juego/partidas', 'POST', victima(['CASO-9999'])));
    expect(r.status).toBe(400);
    expect((await r.json()).casos).toEqual(['CASO-9999']);
    expect(partidas.cantidad).toBe(0);
  });

  it('un caso ya usado en otra partida → 409: no se cuenta dos veces', async () => {
    const id = await intentoFrenado();
    expect((await registrar(json('/api/juego/partidas', 'POST', victima([id])))).status).toBe(201);
    const r = await registrar(json('/api/juego/partidas', 'POST', victima([id], { alias: 'Otra' })));
    expect(r.status).toBe(409);
    expect(partidas.cantidad).toBe(1);
  });

  it('el mismo caso dos veces en una partida → 400', async () => {
    const id = await intentoFrenado();
    const r = await registrar(json('/api/juego/partidas', 'POST', victima([id, id])));
    expect(r.status).toBe(400);
  });

  it.each([
    ['alias con correo', victima([], { alias: 'ana@x.pe' })],
    ['alias con teléfono', victima([], { alias: '987654321' })],
    ['frustración fuera de escala', victima([], { ronda_a: { cayo: true, frustracion: 6 } })],
    ['respuesta no prevista', victima([], { activaria: 'tal_vez' })],
    ['rol desconocido', { rol: 'jurado', alias: 'X' }],
    ['JSON roto', '{nope'],
  ])('%s → 400', async (_, cuerpo) => {
    expect((await registrar(json('/api/juego/partidas', 'POST', cuerpo))).status).toBe(400);
  });

  it('el texto libre del atacante tampoco acepta datos de contacto', async () => {
    const id = await intentoLogrado();
    const r = await registrar(
      json('/api/juego/partidas', 'POST', {
        rol: 'atacante',
        alias: 'Zorro',
        intentos: [{ caso: id, tactica: 'falso_familiar' }],
        idea: 'escríbeme a zorro@correo.pe',
      }),
    );
    expect(r.status).toBe(400);
  });

  it('más de 5 intentos → 400 (§4)', async () => {
    const intentos = [];
    for (let i = 0; i < 6; i++) intentos.push({ caso: await intentoLogrado(), tactica: 'falso_familiar' });
    const r = await registrar(json('/api/juego/partidas', 'POST', { rol: 'atacante', alias: 'Z', intentos }));
    expect(r.status).toBe(400);
  });
});

describe('las partidas sobreviven al reset del demo', () => {
  it('reset borra los casos, pero no los datos de validación del evento', async () => {
    const id = await intentoFrenado();
    await registrar(json('/api/juego/partidas', 'POST', victima([id])));
    await reset(json('/api/demo/reset', 'POST'));
    expect(storeCasos.cantidad).toBe(0);
    const r = await (await resumen()).json();
    expect(r.victima.n).toBe(1);
    expect(r.victima.e3_perdieron_ronda_b.n).toBe(0);
  });

  it('DELETE las borra; con DEMO_TOKEN exige el token', async () => {
    const id = await intentoFrenado();
    await registrar(json('/api/juego/partidas', 'POST', victima([id])));
    process.env.DEMO_TOKEN = 'op';
    expect((await borrar(json('/api/juego/partidas', 'DELETE'))).status).toBe(401);
    expect(partidas.cantidad).toBe(1);
    expect((await borrar(json('/api/juego/partidas', 'DELETE', undefined, 'op'))).status).toBe(200);
    expect(partidas.cantidad).toBe(0);
  });

  it('con PARTIDAS_ARCHIVO, sobreviven también a un reinicio del proceso', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'afs-partidas-'));
    try {
      const archivo = join(dir, 'partidas.json');
      const id = await intentoFrenado();
      const a = new RegistroPartidas(archivo);
      a.registrar(victima([id]) as never, (x) => storeCasos.get(x)?.caso ?? null);
      expect(new RegistroPartidas(archivo).cantidad).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('GET /api/juego/resumen — la tabla de §6', () => {
  it('sin partidas: n = 0 y cocientes null, no 0', async () => {
    const r = await (await resumen()).json();
    expect(r.victima.n).toBe(0);
    expect(r.victima.h3_cayeron_ronda_a.pct).toBeNull();
    expect(r.victima.h5_activaria.pct_si).toBeNull();
    expect(r.victima.frustracion_ronda_a.mediana).toBeNull();
    expect(r.limites.length).toBeGreaterThan(0);
  });

  it('calcula lo mismo que la cuenta a mano', async () => {
    const f1 = await intentoFrenado();
    const l1 = await intentoLogrado();
    // Dos víctimas: una perdió en B (su caso pasó), la otra no.
    await registrar(json('/api/juego/partidas', 'POST', victima([f1], { alias: 'V1' })));
    await registrar(
      json('/api/juego/partidas', 'POST', victima([l1], {
        alias: 'V2',
        ronda_a: { cayo: false, frustracion: 2 },
        activaria: 'no_se',
      })),
    );

    const r = await (await resumen()).json();
    expect(r.victima.n).toBe(2);
    expect(r.victima.h3_cayeron_ronda_a).toEqual({ n: 1, pct: 0.5 });
    expect(r.victima.e3_perdieron_ronda_b).toEqual({ n: 1, pct: 0.5 });
    expect(r.victima.frustracion_ronda_a.mediana).toBe(3);
    expect(r.victima.frustracion_ronda_a.distribucion).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 0 });
    expect(r.victima.h5_activaria).toEqual({ si: 1, no: 0, no_se: 1, pct_si: 0.5 });
  });

  it('atacante: soles robados solo de lo PERMITIDO, y H8 cuenta lo frenado por la Memoria', async () => {
    memoria.confirm(
      'M-01',
      crearVeredicto({ cuenta: 'M-01', veredicto: 'mula_confirmada', validado_por: 'jurado', expediente: 'X', hoy: repo.ahora() }),
    );
    const p1 = (await evaluarTransferencia(tx('C-JORGE', 'M-01', 2200))).caso.id;
    const ok = await intentoLogrado();
    const r = resumenPartidas([
      partidas.registrar(
        { rol: 'atacante', alias: 'Zorro', intentos: [{ caso: p1, tactica: 'falso_familiar' }, { caso: ok, tactica: 'falso_familiar' }] },
        (x) => storeCasos.get(x)?.caso ?? null,
      ) as never,
    ]);
    expect(r.atacante).toMatchObject({
      intentos: 2,
      frenados: 1,
      logrados: 1,
      soles_intentados: 2500,
      soles_robados: 300,
      h8_frenados_por_memoria: 1,
    });
    expect(r.atacante.por_tactica.falso_familiar).toEqual({ intentos: 2, logrados: 1 });
    expect(r.atacante.por_tactica.falso_banco).toEqual({ intentos: 0, logrados: 0 });
  });

  it('GET /api/juego/partidas lista solo alias, sin datos personales', async () => {
    const id = await intentoFrenado();
    await registrar(json('/api/juego/partidas', 'POST', victima([id])));
    const { total, partidas: lista } = await (await listar()).json();
    expect(total).toBe(1);
    expect(lista[0].alias).toBe('Ana');
  });
});

describe('ids de caso que se reciclan (reset del demo y reinicio del proceso)', () => {
  /**
   * Encontrado jugando el videojuego en Chrome: el reset reinicia los ids
   * (`CASO-0001`), pero las partidas sobreviven a propósito. Todo caso nuevo
   * chocaba con el id de una partida vieja → 409 en una partida legítima, y el
   * juego igual decía «tu partida ya aparece en el monitor».
   */
  it('después de un reset, el nuevo CASO-0001 NO se confunde con el viejo', async () => {
    const viejo = await intentoFrenado();
    expect((await registrar(json('/api/juego/partidas', 'POST', victima([viejo])))).status).toBe(201);

    await reset(json('/api/demo/reset', 'POST')); // los ids vuelven a CASO-0001
    const nuevo = await intentoFrenado();
    expect(nuevo).toBe(viejo); // mismo id, otro caso

    const r = await registrar(json('/api/juego/partidas', 'POST', victima([nuevo], { alias: 'Otra' })));
    expect(r.status).toBe(201);
    expect(partidas.cantidad).toBe(2);
  });

  it('pero el MISMO caso sigue sin poder contarse dos veces', async () => {
    const id = await intentoFrenado();
    expect((await registrar(json('/api/juego/partidas', 'POST', victima([id])))).status).toBe(201);
    expect((await registrar(json('/api/juego/partidas', 'POST', victima([id], { alias: 'Otra' })))).status).toBe(409);
  });
});
