import { describe, expect, it } from 'vitest';
import { idUnico } from '@/lib/persistencia/id';
import { RegistroArcade } from '@/lib/juego/arcade';
import { RegistroPartidas } from '@/lib/juego/partidas';

/** Persistencia: ids que no chocan entre servidores que comparten Supabase. */
describe('ids únicos', () => {
  it('no se repiten aunque se generen en el mismo milisegundo', () => {
    const t = Date.now();
    const ids = new Set(Array.from({ length: 5000 }, () => idUnico('ARCADE', t)));
    expect(ids.size).toBe(5000);
  });

  it('se ordenan por tiempo', () => {
    expect(idUnico('X', 1000) < idUnico('X', 2_000_000)).toBe(true);
    expect(idUnico('X', Date.parse('2026-10-18T10:00:00Z')) < idUnico('X', Date.parse('2026-10-18T10:00:01Z'))).toBe(true);
  });

  it('dos servidores que arrancan vacíos ya no generan el mismo id (antes ambos daban ARCADE-00001)', () => {
    const a = new RegistroArcade(undefined, false);
    const b = new RegistroArcade(undefined, false);
    const jugada = { modo: 'sigue_el_dinero' as const, alias: 'Ana', pais: 'pe' as const, puntaje: 1, recuperado_pct: 0, falsos_positivos: 0, mulas: 0, segundos: 1 };
    expect(a.registrar(jugada).id).not.toBe(b.registrar(jugada).id);
    const pa = new RegistroPartidas();
    const pb = new RegistroPartidas();
    expect(pa).toBeDefined();
    expect(pb).toBeDefined();
  });
});
