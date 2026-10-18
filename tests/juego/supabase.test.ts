import { beforeEach, describe, expect, it, vi } from 'vitest';

const filas = vi.hoisted(() => ({ guardadas: [] as unknown[], previas: [] as unknown[] }));

vi.mock('@/lib/persistencia/supabase', () => ({
  supabaseActivo: () => true,
  cargarFilas: async () => filas.previas,
  guardarFila: async (_t: string, f: unknown) => void filas.guardadas.push(f),
  borrarFilas: async () => undefined,
}));

import { RegistroArcade } from '@/lib/juego/arcade';

describe('arcade con Supabase', () => {
  beforeEach(() => {
    filas.guardadas = [];
    filas.previas = [];
  });

  it('carga lo guardado y escribe cada jugada nueva', async () => {
    filas.previas = [
      { id: 'ARCADE-00001', t: '2026-10-18T00:00:00Z', modo: 'sigue_el_dinero', alias: 'ana', pais: 'pe', puntaje: 50, recuperado_pct: 50, falsos_positivos: 0, mulas: 1, segundos: 30 },
    ];
    const r = new RegistroArcade(undefined, true);
    await r.listo;
    expect(r.cantidad).toBe(1);

    const j = r.registrar({ modo: 'sigue_el_dinero', alias: 'beto', pais: 'co', puntaje: 80, recuperado_pct: 80, falsos_positivos: 0, mulas: 2, segundos: 20 });
    expect(j.id).toBe('ARCADE-00002');
    await Promise.resolve();
    expect(filas.guardadas).toHaveLength(1);
  });
});
