import { describe, it, expect } from 'vitest';
import {
  fanIn,
  reenvioRapido,
  estructuracion,
  ciclos,
  cadenaReenvio,
  tipologiasMarcadas,
  disponibilidad,
  canalesSeguros,
  UMBRALES,
} from '@/lib/analytics';
import { esMulaProbable } from '@/lib/contracts';
import { repo } from '@/lib/data/repo';

/**
 * El test central del proyecto: distinguir una mula (M-01) de un negocio
 * legítimo de alto volumen (Bodega Don Pepe).
 *
 * Si estos tests pasan por la razón equivocada, CU-05 falla en el demo y
 * bloqueamos clientes reales. Por eso se verifica también el dato crudo,
 * no solo la marca booleana.
 */

describe('M-01 — cuenta mula', () => {
  it('fan_in: 14 remitentes distintos en 48h', () => {
    const r = fanIn('M-01');
    expect(r.remitentes_nuevos).toBe(14);
    expect(r.marcado).toBe(true);
  });

  it('reenvio_rapido: ~91% de lo recibido sale en menos de 2h', () => {
    const r = reenvioRapido('M-01');
    expect(r.porcentaje_reenviado).toBeGreaterThan(0.85);
    expect(r.porcentaje_reenviado).toBeLessThan(0.95);
    expect(r.marcado).toBe(true);
  });

  it('estructuracion: 3 operaciones entre 90% y 100% del umbral', () => {
    const r = estructuracion('M-01');
    expect(r.operaciones_cercanas_umbral).toBe(3);
    expect(r.marcado).toBe(true);
  });

  it('la cadena de reenvío llega a 2 saltos: M-01 → M-02 → M-03', () => {
    expect(cadenaReenvio('M-01', 2)).toEqual(['M-01', 'M-02', 'M-03']);
  });

  it('las tipologías marcadas incluyen el par que define una mula', () => {
    const t = tipologiasMarcadas('M-01');
    expect(t).toContain('fan_in');
    expect(t).toContain('reenvio_rapido');
    expect(esMulaProbable(t)).toBe(true);
  });
});

describe('Bodega Don Pepe — negocio legítimo (CU-05)', () => {
  it('tiene fan_in alto: no es una señal que la distinga', () => {
    expect(fanIn('B-PEPE').marcado).toBe(true);
  });

  it('fan_in NO puede distinguir mula de comercio: ambos lo marcan', () => {
    // Corazón del control de falsos positivos: si la decisión dependiera de
    // fan_in, la bodega legítima sería tratada igual que la mula.
    expect(fanIn('B-PEPE').marcado).toBe(true);
    expect(fanIn('M-01').marcado).toBe(true);
    expect(fanIn('B-PEPE').remitentes_nuevos).toBeGreaterThanOrEqual(
      UMBRALES.fan_in_remitentes_nuevos,
    );
  });

  it('NO reenvía rápido: es lo único que la separa de una mula', () => {
    const r = reenvioRapido('B-PEPE');
    expect(r.porcentaje_reenviado).toBeLessThan(0.1);
    expect(r.marcado).toBe(false);
  });

  it('no estructura', () => {
    expect(estructuracion('B-PEPE').marcado).toBe(false);
  });

  it('NO es mula probable, aunque tenga fan-in', () => {
    const t = tipologiasMarcadas('B-PEPE');
    expect(t).toContain('fan_in');
    expect(t).not.toContain('reenvio_rapido');
    expect(esMulaProbable(t)).toBe(false);
  });
});

describe('Robustez de las analytics', () => {
  it('una cuenta sin movimientos no marca nada y no revienta', () => {
    const inexistente = 'C-NO-EXISTE';
    expect(fanIn(inexistente).remitentes_nuevos).toBe(0);
    expect(fanIn(inexistente).marcado).toBe(false);
    expect(reenvioRapido(inexistente).porcentaje_reenviado).toBe(0);
    expect(reenvioRapido(inexistente).marcado).toBe(false);
    expect(tipologiasMarcadas(inexistente)).toEqual([]);
  });

  it('reenvio_rapido no divide por cero cuando no recibió nada', () => {
    const r = reenvioRapido('C-VIC-01');
    expect(Number.isFinite(r.porcentaje_reenviado)).toBe(true);
  });

  it('ciclos no entra en bucle infinito con la cadena M-01 → M-02 → M-03', () => {
    expect(() => ciclos('M-01')).not.toThrow();
    expect(typeof ciclos('M-01').marcado).toBe('boolean');
  });

  it('la ventana de fan_in realmente acota: 2h ve menos que 48h', () => {
    expect(fanIn('M-01', 2).remitentes_nuevos).toBeLessThan(
      fanIn('M-01', 48).remitentes_nuevos,
    );
  });
});

describe('Lado cliente — disponibilidad y canales', () => {
  it('Rosa está alcanzable y tiene canales limpios', () => {
    const d = disponibilidad('rosa');
    expect(d.alcanzable).toBe(true);
    expect(d.canales_disponibles.length).toBeGreaterThan(0);
  });

  it('Lucía no está alcanzable y su app está comprometida (CU-04)', () => {
    const d = disponibilidad('lucia');
    expect(d.alcanzable).toBe(false);
    expect(d.canales_disponibles).not.toContain('app');
  });

  it('canalesSeguros nunca devuelve un canal comprometido — resuelve FM3', () => {
    const c = canalesSeguros('lucia');
    expect(c.comprometidos).toContain('app');
    for (const canal of c.seguros) {
      expect(c.comprometidos).not.toContain(canal);
    }
  });

  it('un cliente inexistente devuelve vacío en vez de reventar', () => {
    expect(disponibilidad('nadie').canales_disponibles).toEqual([]);
    expect(canalesSeguros('nadie').seguros).toEqual([]);
  });
});

describe('Datos semilla', () => {
  it('están marcados como sintéticos', () => {
    expect(repo.notaDatos()).toMatch(/SINTÉTICOS/i);
  });

  it('tiene los 200 movimientos de la población de fondo', () => {
    expect(repo.movimientos().length).toBe(200);
  });

  it('los movimientos están ordenados cronológicamente', () => {
    const ts = repo.movimientos().map((m) => m.t);
    expect([...ts].sort()).toEqual(ts);
  });

  it('existen los actores de los 5 casos de uso', () => {
    for (const id of ['M-01', 'M-02', 'M-03', 'B-PEPE', 'H-SOL']) {
      expect(repo.cuenta(id), id).not.toBeNull();
    }
    for (const id of ['rosa', 'jorge', 'lucia']) {
      expect(repo.cliente(id), id).not.toBeNull();
    }
  });
});
