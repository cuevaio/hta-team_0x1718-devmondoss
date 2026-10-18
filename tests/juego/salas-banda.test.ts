import { describe, it, expect, vi } from 'vitest';
import type { Caso } from '@/lib/contracts';
import { claveGolpe, COMBINACIONES, transferenciaDeGolpe, type Golpe } from '@/lib/juego/golpes';
import {
  ATAQUE_MS,
  CUENTA_MS,
  ESPERA_GOLPE_MS,
  MAX_GOLPES,
  PUNTOS_DESCUBRIMIENTO,
  PUNTOS_FRENADO,
  PUNTOS_HUECO,
  Salas,
  type Evaluador,
} from '@/lib/juego/salas';

/**
 * EN VIVO · LA BANDA: la sala es el reloj y el juez, y cada golpe lo evalúa el
 * pipeline real. Aquí el pipeline se inyecta (`Evaluador`) para probar las
 * reglas de la sala sin levantar los agentes; que el pipeline de verdad entre
 * por la ruta lo prueba tests/api/salas-banda.test.ts.
 */

const reloj = () => {
  let t = 1_000_000;
  return { ahora: () => t, avanzar: (ms: number) => (t += ms) };
};

const GOLPE: Golpe = { victima: 'rosa', tactica: 'falso_banco', destino: 'M-01', monto: 'todo', madrugada: false };

let n = 0;
/** Caso mínimo con la decisión que pida el test. */
function caso(accion: 'PERMITIR' | 'PAUSAR', llamadas = 0): Caso {
  n++;
  return {
    id: `CASO-${n}`,
    puerta: 'transferencia',
    t: new Date().toISOString(),
    transaccion: { origen: 'C-ROSA', destino: 'M-01', monto: 4800, moneda: 'PEN' },
    nivel0: { senales: [], score: 0 },
    evidencia: [],
    salidas: {},
    decision: { accion, regla: accion === 'PERMITIR' ? 'P3' : 'P5', motivo: 'test', t: new Date().toISOString() },
    timeline: [],
    ia: { llamadas, tokens_entrada: 0, tokens_salida: 0, por_agente: {} },
  } as unknown as Caso;
}

const siempre = (accion: 'PERMITIR' | 'PAUSAR', llamadas = 0): Evaluador => async () => caso(accion, llamadas);

/** Sala de LA BANDA ya en fase de ataque, con Ana (anfitriona) y Beto. */
function salaEnAtaque() {
  const r = reloj();
  const s = new Salas(r.ahora);
  const { codigo, token } = s.crear('Ana', 'pe', 'banda');
  s.accion(codigo, { accion: 'unirse', alias: 'Beto', pais: 'pe' });
  s.accion(codigo, { accion: 'iniciar', token });
  r.avanzar(CUENTA_MS);
  return { r, s, codigo, token };
}

describe('LA BANDA · fases', () => {
  it('espera → cuenta → ataque → fin, con el reloj del servidor', () => {
    const r = reloj();
    const s = new Salas(r.ahora);
    const { codigo, token } = s.crear('Ana', 'pe', 'banda');
    expect(s.vista(codigo)!.fase).toBe('espera');
    expect(s.vista(codigo)!.carta).toBeNull(); // no hay cartas en este modo
    s.accion(codigo, { accion: 'iniciar', token });
    expect(s.vista(codigo)!.fase).toBe('cuenta');
    r.avanzar(CUENTA_MS);
    expect(s.vista(codigo)!.fase).toBe('ataque');
    expect(s.vista(codigo)!.restante_ms).toBe(ATAQUE_MS);
    r.avanzar(ATAQUE_MS - 1);
    expect(s.vista(codigo)!.fase).toBe('ataque');
    r.avanzar(1);
    expect(s.vista(codigo)!.fase).toBe('fin');
  });

  it('no se responden cartas en una sala de LA BANDA', () => {
    const { s, codigo } = salaEnAtaque();
    const r = s.accion(codigo, { accion: 'responder', alias: 'Ana', ronda: 0, dijo_estafa: true });
    expect(r).toEqual({ error: expect.stringContaining('se lanzan golpes'), status: 409 });
  });

  it('un golpe por `accion()` no se evalúa: ese camino es asíncrono', () => {
    const { s, codigo } = salaEnAtaque();
    const r = s.accion(codigo, { accion: 'golpe', alias: 'Ana', golpe: GOLPE });
    expect(r).toEqual({ error: expect.any(String), status: 400 });
  });
});

describe('LA BANDA · golpes', () => {
  it('el servidor arma la transferencia desde el catálogo, no el cliente', async () => {
    const { s, codigo } = salaEnAtaque();
    const evaluar = vi.fn<Evaluador>(async () => caso('PAUSAR'));
    await s.golpe(codigo, { alias: 'Ana', golpe: { ...GOLPE, victima: 'lucia', monto: 'chico', madrugada: true } }, evaluar);
    expect(evaluar).toHaveBeenCalledWith({
      transaccion: { origen: 'C-LUCIA', destino: 'M-01', monto: 300, moneda: 'PEN' },
      contexto: { llamada_activa_o_acceso_remoto: true, horario_atipico: true },
      alias: 'Ana',
    });
  });

  it('frenar da pocos puntos; pasar la capa da muchos y suma el descubrimiento', async () => {
    const { s, codigo } = salaEnAtaque();
    const frenado = await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    if ('error' in frenado) throw new Error(frenado.error);
    expect(frenado.golpe.frenado).toBe(true);
    expect(frenado.golpe.puntos).toBe(PUNTOS_FRENADO);
    expect(frenado.golpe.descubrimiento).toBe(false);

    const { s: s2, codigo: c2, r: r2 } = salaEnAtaque();
    const hueco = await s2.golpe(c2, { alias: 'Ana', golpe: GOLPE }, siempre('PERMITIR'));
    if ('error' in hueco) throw new Error(hueco.error);
    expect(hueco.golpe.frenado).toBe(false);
    expect(hueco.golpe.descubrimiento).toBe(true);
    expect(hueco.golpe.puntos).toBe(PUNTOS_HUECO + PUNTOS_DESCUBRIMIENTO);
    // El segundo hueco con la MISMA táctica ya no es descubrimiento (lo de otro jugador también cuenta).
    r2.avanzar(ESPERA_GOLPE_MS);
    const otro = await s2.golpe(c2, { alias: 'Beto', golpe: { ...GOLPE, monto: 'chico' } }, siempre('PERMITIR'));
    if ('error' in otro) throw new Error(otro.error);
    expect(otro.golpe.descubrimiento).toBe(false);
    expect(otro.golpe.puntos).toBe(PUNTOS_HUECO);
  });

  it('guarda la regla, la acción y el gasto de IA del caso real', async () => {
    const { s, codigo } = salaEnAtaque();
    const r = await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR', 2));
    if ('error' in r) throw new Error(r.error);
    expect(r.golpe).toMatchObject({ regla: 'P5', accion: 'PAUSAR', llamadas_ia: 2, caso: r.caso.id, alias: 'Ana' });
    expect(r.vista.banda).toMatchObject({ golpes: 1, frenados: 1, huecos: 0 });
    expect(r.vista.mio!.banda).toMatchObject({ golpes: 1, huecos: 0, restantes: MAX_GOLPES - 1 });
  });

  it('el mismo golpe no se repite: hay que cambiar algo', async () => {
    const { r, s, codigo } = salaEnAtaque();
    await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    r.avanzar(ESPERA_GOLPE_MS);
    const repetido = await s.golpe(codigo, { alias: 'Ana', golpe: { ...GOLPE } }, siempre('PAUSAR'));
    expect(repetido).toEqual({ error: expect.stringContaining('ya probaste'), status: 409 });
    // Cambiar una sola perilla ya es otro golpe.
    const distinto = await s.golpe(codigo, { alias: 'Ana', golpe: { ...GOLPE, madrugada: true } }, siempre('PAUSAR'));
    expect('error' in distinto).toBe(false);
  });

  it('dos golpes muy seguidos: el segundo espera (429)', async () => {
    const { r, s, codigo } = salaEnAtaque();
    await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    const rapido = await s.golpe(codigo, { alias: 'Ana', golpe: { ...GOLPE, monto: 'chico' } }, siempre('PAUSAR'));
    expect(rapido).toEqual({ error: expect.stringContaining('espera'), status: 429 });
    r.avanzar(ESPERA_GOLPE_MS);
    const ok = await s.golpe(codigo, { alias: 'Ana', golpe: { ...GOLPE, monto: 'chico' } }, siempre('PAUSAR'));
    expect('error' in ok).toBe(false);
  });

  it('la espera es por jugador: la de Ana no frena a Beto', async () => {
    const { s, codigo } = salaEnAtaque();
    await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    const beto = await s.golpe(codigo, { alias: 'Beto', golpe: GOLPE }, siempre('PAUSAR'));
    expect('error' in beto).toBe(false);
  });

  it(`cada jugador tiene ${MAX_GOLPES} golpes`, async () => {
    const { r, s, codigo } = salaEnAtaque();
    const montos = ['chico', 'medio', 'todo'] as const;
    const tacticas = ['falso_banco', 'link_falso', 'falso_familiar', 'app_falsa'] as const;
    for (let i = 0; i < MAX_GOLPES; i++) {
      const g: Golpe = { ...GOLPE, tactica: tacticas[i % 4], monto: montos[i % 3], madrugada: i % 2 === 0 };
      const x = await s.golpe(codigo, { alias: 'Ana', golpe: g }, siempre('PAUSAR'));
      if ('error' in x) throw new Error(`${i}: ${x.error}`);
      r.avanzar(ESPERA_GOLPE_MS);
    }
    const extra = await s.golpe(codigo, { alias: 'Ana', golpe: { ...GOLPE, monto: 'medio', madrugada: true } }, siempre('PAUSAR'));
    expect(extra).toEqual({ error: expect.stringContaining(`${MAX_GOLPES} golpes`), status: 409 });
  });

  it('fuera de la fase de ataque no se puede golpear', async () => {
    const r = reloj();
    const s = new Salas(r.ahora);
    const { codigo, token } = s.crear('Ana', 'pe', 'banda');
    const antes = await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    expect(antes).toEqual({ error: expect.stringContaining('todavía no empezó'), status: 409 });
    s.accion(codigo, { accion: 'iniciar', token });
    r.avanzar(CUENTA_MS + ATAQUE_MS);
    const despues = await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    expect(despues).toEqual({ error: expect.stringContaining('terminó'), status: 409 });
  });

  it('quien no se unió no golpea, y una sala de cartas no acepta golpes', async () => {
    const { s, codigo } = salaEnAtaque();
    const colado = await s.golpe(codigo, { alias: 'Zoe', golpe: GOLPE }, siempre('PAUSAR'));
    expect(colado).toEqual({ error: expect.stringContaining('únete'), status: 403 });

    const r = reloj();
    const s2 = new Salas(r.ahora);
    const { codigo: cartas } = s2.crear('Ana', 'pe', 'real_o_estafa');
    const mal = await s2.golpe(cartas, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    expect(mal).toEqual({ error: expect.stringContaining('no es de LA BANDA'), status: 409 });

    const inexistente = await s2.golpe('ZZZZ', { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    expect(inexistente).toEqual({ error: expect.any(String), status: 404 });
  });

  it('si el pipeline falla, el golpe no se cobra y se puede reintentar', async () => {
    const { r, s, codigo } = salaEnAtaque();
    const falla: Evaluador = async () => {
      throw new Error('agentes caídos');
    };
    const malo = await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, falla);
    expect(malo).toEqual({ error: expect.any(String), status: 503 });
    expect(s.vista(codigo, 'Ana')!.mio!.banda).toMatchObject({ golpes: 0, restantes: MAX_GOLPES });
    r.avanzar(ESPERA_GOLPE_MS);
    const ok = await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PAUSAR'));
    expect('error' in ok).toBe(false); // la misma combinación quedó libre
  });

  it('la vista de la sala resume lo de todos, para el proyector', async () => {
    const { r, s, codigo } = salaEnAtaque();
    await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PERMITIR'));
    await s.golpe(codigo, { alias: 'Beto', golpe: { ...GOLPE, tactica: 'link_falso' } }, siempre('PAUSAR'));
    r.avanzar(ESPERA_GOLPE_MS);
    await s.golpe(codigo, { alias: 'Beto', golpe: { ...GOLPE, tactica: 'link_falso', monto: 'chico' } }, siempre('PAUSAR'));
    const v = s.vista(codigo, 'Beto')!;
    expect(v.banda).toMatchObject({ golpes: 3, frenados: 2, huecos: 1 });
    expect(v.banda!.ultimos[0].alias).toBe('Beto'); // el más nuevo primero
    expect(v.banda!.por_tactica).toEqual([
      { tactica: 'link_falso', intentos: 2, huecos: 0 },
      { tactica: 'falso_banco', intentos: 1, huecos: 1 },
    ]);
    // El ranking lo ordena el puntaje: Ana encontró el hueco.
    expect(v.jugadores[0].alias).toBe('Ana');
    expect(v.mio!.banda!.mios).toHaveLength(2);
  });

  it('reiniciar borra golpes, puntajes y descubrimientos', async () => {
    const { s, codigo, token, r } = salaEnAtaque();
    await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PERMITIR'));
    r.avanzar(ATAQUE_MS);
    s.accion(codigo, { accion: 'reiniciar', token });
    const v = s.vista(codigo, 'Ana')!;
    expect(v.fase).toBe('espera');
    expect(v.banda).toMatchObject({ golpes: 0, huecos: 0 });
    expect(v.jugadores.every((j) => j.puntaje === 0)).toBe(true);
    s.accion(codigo, { accion: 'iniciar', token });
    r.avanzar(CUENTA_MS);
    // El mismo golpe vuelve a estar disponible y a valer descubrimiento.
    const otra = await s.golpe(codigo, { alias: 'Ana', golpe: GOLPE }, siempre('PERMITIR'));
    if ('error' in otra) throw new Error(otra.error);
    expect(otra.golpe.descubrimiento).toBe(true);
  });
});

describe('catálogo de golpes', () => {
  it('el monto cambia lo que ven las reglas (3× el promedio de 90 días)', () => {
    // Jorge promedia 380: 1200 ya es atípico para él, pero no para Rosa (420 → 1260).
    expect(transferenciaDeGolpe({ ...GOLPE, victima: 'jorge', monto: 'medio' }, 'A').transaccion.monto).toBe(1200);
    expect(transferenciaDeGolpe({ ...GOLPE, victima: 'rosa', monto: 'medio' }, 'A').transaccion.monto).toBe(1200);
  });

  it('cada perilla cambia la identidad del golpe', () => {
    const base = claveGolpe(GOLPE);
    expect(claveGolpe({ ...GOLPE, victima: 'jorge' })).not.toBe(base);
    expect(claveGolpe({ ...GOLPE, tactica: 'app_falsa' })).not.toBe(base);
    expect(claveGolpe({ ...GOLPE, destino: 'M-02' })).not.toBe(base);
    expect(claveGolpe({ ...GOLPE, monto: 'chico' })).not.toBe(base);
    expect(claveGolpe({ ...GOLPE, madrugada: true })).not.toBe(base);
    expect(claveGolpe({ ...GOLPE })).toBe(base);
  });

  it(`hay ${COMBINACIONES} golpes distintos: ${MAX_GOLPES} por jugador no agotan el catálogo`, () => {
    expect(COMBINACIONES).toBe(270);
    expect(COMBINACIONES).toBeGreaterThan(MAX_GOLPES);
  });
});
