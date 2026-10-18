import { describe, expect, it } from 'vitest';
import { Explorador, type ConfigMundo } from '@/components/juego2d/mundo';
import { PAISES } from '@/components/juego2d/paises';
import { envolver } from '@/components/juego2d/pincel';
import { sumarPartida } from '@/components/juego2d/progreso';
import { cuadrosCarta, mazo } from '@/components/juego2d/realOEstafa';

/** Arreglos del playtest: textos que se cortaban, recompensas y el barrio. */

describe('¿REAL O ESTAFA?', () => {
  it('cada pista entra completa en su caja (4 líneas de 19)', () => {
    for (const pais of Object.values(PAISES)) {
      for (const carta of mazo(pais)) expect(envolver(carta.pista, 19).length, `${pais.id}/${carta.id}`).toBeLessThanOrEqual(4);
    }
  });

  it('el tiempo por carta se acorta poco a poco, de 8 s a 4 s', () => {
    expect(cuadrosCarta(0)).toBe(8 * 60);
    expect(cuadrosCarta(5)).toBeLessThan(cuadrosCarta(0));
    expect(cuadrosCarta(100)).toBe(4 * 60);
  });
});

describe('recompensas', () => {
  const vacio = () => ({ total: 0, mejor: {}, estrellas: {}, logros: [] });

  it('5/5 sin errores da al menos una estrella aunque el puntaje sea bajo', () => {
    expect(sumarPartida(vacio(), 'real_o_estafa', 900, []).estrellas).toBe(0);
    expect(sumarPartida(vacio(), 'real_o_estafa', 900, [], 1).estrellas).toBe(1);
  });
});

describe('banderas', () => {
  it('Chile, Ecuador y Venezuela tienen su detalle (no se confunden con Polonia o Colombia)', () => {
    expect(PAISES.cl.bandera.detalle).toBe('chile');
    expect(PAISES.ec.bandera.detalle).toBe('ecuador');
    expect(PAISES.ve.bandera.detalle).toBe('venezuela');
    expect(PAISES.co.bandera.detalle).toBeUndefined();
  });
});

describe('barrio', () => {
  const cfg: ConfigMundo = {
    jugador: 'rosa',
    inicio: { x: 2, y: 5, dir: 'abajo' },
    noche: false,
    objetivo: 'pepe',
    npcs: [{ id: 'pepe', x: 2, y: 14, dir: 'abajo', paleta: 'pepe', nombre: 'DON PEPE', lineas: [] }],
    puertas: {},
  };

  const caminarHasta = (e: Explorador) => {
    for (let i = 0; i < 2000; i++) {
      const ev = e.actualizar();
      if (ev) return ev;
    }
    return null;
  };

  it('tocar la cabeza de Don Pepe (sobre el toldo) lleva hasta él', () => {
    const e = new Explorador(structuredClone(cfg));
    e.irA(2, 13);
    expect(caminarHasta(e)).toEqual({ tipo: 'objetivo', id: 'pepe' });
  });

  it('tocar un puesto sólido acerca al jugador en vez de dejarlo quieto', () => {
    const e = new Explorador(structuredClone(cfg));
    e.irA(0, 12);
    expect(e.quieto).toBe(false);
  });
});
