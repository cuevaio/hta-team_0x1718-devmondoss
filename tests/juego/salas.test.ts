import { describe, it, expect } from 'vitest';
import { CUENTA_MS, RESPONDER_MS, REVELAR_MS, RONDAS, Salas, type VistaSala } from '@/lib/juego/salas';
import { CARTAS_POP, CARTAS_ROE } from '@/lib/juego/cartas';
import { mazo } from '@/components/juego2d/realOEstafa';
import { TICKETS } from '@/components/juego2d/pausaOPasa';
import { PAISES } from '@/components/juego2d/paises';
import { POST as crear } from '@/app/api/juego/salas/route';
import { POST as accionar, GET as ver } from '@/app/api/juego/salas/[codigo]/route';

/** Salas EN VIVO: el reloj del servidor manda y el servidor califica. */

const reloj = () => {
  let t = 1_000_000;
  return { ahora: () => t, avanzar: (ms: number) => (t += ms) };
};
const esVista = (v: unknown): v is VistaSala => typeof v === 'object' && v !== null && 'fase' in v;

describe('Salas', () => {
  it('espera → cuenta → responder → revelar → … → fin, con el reloj del servidor', () => {
    const r = reloj();
    const s = new Salas(r.ahora);
    const { codigo, token } = s.crear('Ana', 'pe', 'real_o_estafa');
    expect(codigo).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(s.vista(codigo)!.fase).toBe('espera');
    s.accion(codigo, { accion: 'iniciar', token });
    expect(s.vista(codigo)!.fase).toBe('cuenta');
    r.avanzar(CUENTA_MS);
    const v = s.vista(codigo)!;
    expect(v.fase).toBe('responder');
    expect(v.ronda).toBe(0);
    expect(v.carta).not.toBeNull();
    expect(v.verdad).toBeNull(); // no se filtra la respuesta antes de tiempo
    r.avanzar(RESPONDER_MS);
    expect(s.vista(codigo)!.fase).toBe('revelar');
    r.avanzar(REVELAR_MS);
    expect(s.vista(codigo)!.ronda).toBe(1);
    r.avanzar((RESPONDER_MS + REVELAR_MS) * RONDAS);
    expect(s.vista(codigo)!.fase).toBe('fin');
  });

  it('califica en el servidor: acertar rápido vale más, y no se responde dos veces', () => {
    const r = reloj();
    const s = new Salas(r.ahora);
    const { codigo, token } = s.crear('Ana', 'pe', 'real_o_estafa');
    s.accion(codigo, { accion: 'unirse', alias: 'Beto', pais: 'mx' });
    s.accion(codigo, { accion: 'iniciar', token });
    r.avanzar(CUENTA_MS + 1000);
    const carta = CARTAS_ROE.find((c) => c.id === s.vista(codigo)!.carta)!;
    const ana = s.accion(codigo, { accion: 'responder', alias: 'Ana', ronda: 0, dijo_estafa: carta.estafa });
    r.avanzar(6000);
    const beto = s.accion(codigo, { accion: 'responder', alias: 'Beto', ronda: 0, dijo_estafa: carta.estafa });
    expect(esVista(ana) && esVista(beto)).toBe(true);
    if (!esVista(ana) || !esVista(beto)) return;
    expect(ana.mio!.ultima!.correcto).toBe(true);
    expect(ana.mio!.ultima!.puntos).toBeGreaterThan(beto.mio!.ultima!.puntos);
    expect(s.accion(codigo, { accion: 'responder', alias: 'Ana', ronda: 0, dijo_estafa: true })).toMatchObject({ status: 409 });
    r.avanzar(RESPONDER_MS - 7000); // fin de la ventana de respuesta de la ronda 0
    const rev = s.vista(codigo, 'Ana')!;
    expect(rev.fase).toBe('revelar');
    expect(rev.verdad).toBe(carta.estafa);
    expect(rev.reparto).toEqual({ estafa: carta.estafa ? 2 : 0, real: carta.estafa ? 0 : 2, sin_responder: 0 });
    expect(rev.jugadores[0].alias).toBe('Ana');
    // Fuera de tiempo: rechazado
    expect(s.accion(codigo, { accion: 'responder', alias: 'Beto', ronda: 0, dijo_estafa: true })).toMatchObject({ status: 409 });
  });

  it('solo el anfitrión empieza y reinicia; reiniciar borra puntajes', () => {
    const r = reloj();
    const s = new Salas(r.ahora);
    const { codigo, token } = s.crear('Ana', 'pe', 'pausa_o_pasa');
    expect(s.accion(codigo, { accion: 'iniciar', token: 'x'.repeat(24) })).toMatchObject({ status: 403 });
    s.accion(codigo, { accion: 'iniciar', token });
    r.avanzar(CUENTA_MS);
    const c = CARTAS_POP.find((x) => x.id === s.vista(codigo)!.carta)!;
    s.accion(codigo, { accion: 'responder', alias: 'Ana', ronda: 0, dijo_estafa: c.estafa });
    expect(s.vista(codigo, 'Ana')!.mio!.puntaje).toBeGreaterThan(0);
    s.accion(codigo, { accion: 'reiniciar', token });
    const v = s.vista(codigo, 'Ana')!;
    expect(v.fase).toBe('espera');
    expect(v.mio!.puntaje).toBe(0);
  });

  it('las salas viejas se limpian solas', () => {
    const r = reloj();
    const s = new Salas(r.ahora);
    const { codigo } = s.crear('Ana', 'pe', 'real_o_estafa');
    r.avanzar(3 * 60 * 60 * 1000);
    s.crear('Beto', 'pe', 'real_o_estafa');
    expect(s.vista(codigo)).toBeNull();
  });
});

describe('API de salas', () => {
  const post = (url: string, cuerpo: unknown) =>
    new Request(`http://test${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  const ctx = (codigo: string) => ({ params: Promise.resolve({ codigo }) });

  it('crea, une y consulta; rechaza alias de contacto', async () => {
    const r = await crear(post('/api/juego/salas', { alias: 'Ana', pais: 'pe', juego: 'real_o_estafa' }));
    expect(r.status).toBe(201);
    const { codigo, token } = await r.json();
    expect(typeof token).toBe('string');
    const u = await accionar(post(`/api/juego/salas/${codigo}`, { accion: 'unirse', alias: 'Beto', pais: 'co' }), ctx(codigo.toLowerCase()));
    expect(u.status).toBe(200);
    const v = await (await ver(new Request(`http://test/api/juego/salas/${codigo}?alias=Beto`), ctx(codigo))).json();
    expect(v.jugadores).toHaveLength(2);
    expect(v.mio.posicion).toBeGreaterThan(0);
    expect(JSON.stringify(v)).not.toContain(token);
    expect((await crear(post('/api/juego/salas', { alias: 'a@b.com', pais: 'pe', juego: 'real_o_estafa' }))).status).toBe(400);
    expect((await ver(new Request('http://test/x'), ctx('ZZZZ'))).status).toBe(404);
  });
});

describe('La verdad del servidor coincide con las cartas del juego', () => {
  it('¿REAL O ESTAFA?', () => {
    for (const pais of Object.values(PAISES)) {
      const cliente = mazo(pais).map((c) => ({ id: c.id, categoria: c.categoria, estafa: c.estafa }));
      expect(cliente).toEqual(CARTAS_ROE);
    }
  });
  it('¿PAUSA O PASA?', () => {
    expect(TICKETS.map((t) => ({ id: t.id, categoria: t.agente, estafa: t.riesgosa }))).toEqual(CARTAS_POP);
  });
});
