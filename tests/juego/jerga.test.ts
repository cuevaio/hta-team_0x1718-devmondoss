import { describe, it, expect } from 'vitest';
import { frase, todasLasFrases, type Momento } from '@/components/juego2d/jerga';
import { PAISES, datosEpilogo, dinero } from '@/components/juego2d/paises';
import { PAISES_JUEGO } from '@/lib/juego/arcade';

/** La voz del juego por país: completa, corta y sin groserías. */

const MOMENTOS: Momento[] = [
  'saludo', 'acierto', 'racha', 'fallo', 'cayo', 'desconfiado', 'tiempo', 'ganaste', 'perdiste',
  'lobby', 'muchosCayeron', 'nadieCayo', 'podio', 'mula', 'inocente',
];

// Palabras que no van en un juego de evento abierto (y que en algún país son groserías).
const PROHIBIDAS = /\b(boludo|pelotudo|weón|huevón|huevon|cabrón|cabron|pendejo|verga|mierda|carajo|coño|puta|chingar|chingad|culo|marica|gonorrea|joder|concha)\b/i;

describe('jerga por país', () => {
  it('cada país del juego tiene frases para cada momento', () => {
    for (const pais of PAISES_JUEGO) {
      for (const momento of MOMENTOS) expect(frase(pais, momento).length, `${pais}/${momento}`).toBeGreaterThan(0);
    }
  });

  it('las frases son cortas y los títulos caben grandes', () => {
    for (const { pais, momento, texto } of todasLasFrases()) {
      if (momento === 'ganaste' || momento === 'perdiste') expect(texto.length, `${pais}: ${texto}`).toBeLessThanOrEqual(12);
      else if (momento === 'saludo') expect(texto.length, `${pais}: ${texto}`).toBeLessThanOrEqual(100);
      else expect(texto.length, `${pais}/${momento}: ${texto}`).toBeLessThanOrEqual(63);
    }
  });

  it('sin groserías', () => {
    for (const { pais, texto } of todasLasFrases()) expect(texto, pais).not.toMatch(PROHIBIDAS);
  });

  it('reemplaza {x}', () => {
    expect(frase('pe', 'podio', 'ANA')).toContain('ANA');
  });
});

describe('países', () => {
  it('el cliente tiene todos los países del servidor y viceversa', () => {
    expect(Object.keys(PAISES).sort()).toEqual([...PAISES_JUEGO].sort());
  });

  it('montos creíbles en cada moneda', () => {
    expect(dinero(PAISES.cl, 4800)).toBe('$ 1.200.000');
    expect(dinero(PAISES.bo, 4800)).toBe('Bs 8.900');
    expect(dinero(PAISES.ec, 4800)).toBe('$ 1,300');
  });

  it('el epílogo solo usa datos con fuente', () => {
    for (const pais of Object.values(PAISES)) {
      for (const d of datosEpilogo(pais)) expect(d.fuente.length).toBeGreaterThan(0);
    }
    expect(datosEpilogo(PAISES.otro).length).toBe(datosEpilogo(PAISES.pe).length - 1);
  });
});
