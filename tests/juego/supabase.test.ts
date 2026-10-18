import { beforeEach, describe, expect, it, vi } from 'vitest';

const filas = vi.hoisted(() => ({ guardadas: [] as unknown[], previas: [] as unknown[], borrados: 0 }));

vi.mock('@/lib/persistencia/supabase', () => ({
  supabaseActivo: () => true,
  cargarFilas: async () => filas.previas,
  guardarFila: async (_t: string, f: unknown) => void filas.guardadas.push(f),
  borrarFilas: async () => {
    filas.borrados++;
  },
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
    expect(j.id).toMatch(/^ARCADE-[0-9A-Z]{9}-[0-9A-F]{12}$/);
    expect(j.id).not.toBe('ARCADE-00001');
    await Promise.resolve();
    expect(filas.guardadas).toHaveLength(1);
  });

  it('los récords son para siempre: limpiar no toca Supabase salvo a propósito', async () => {
    filas.borrados = 0;
    const r = new RegistroArcade(undefined, true);
    await r.listo;
    r.limpiar();
    expect(filas.borrados).toBe(0);
    r.limpiar({ nube: true });
    expect(filas.borrados).toBe(1);
  });

  it('sincroniza lo que guardó otro servidor sin perder lo propio', async () => {
    filas.previas = [];
    const r = new RegistroArcade(undefined, true);
    await r.listo;
    r.registrar({ modo: 'sigue_el_dinero', alias: 'propia', pais: 'pe', puntaje: 1, recuperado_pct: 0, falsos_positivos: 0, mulas: 0, segundos: 1 });
    filas.previas = [
      { id: 'ARCADE-OTRO-1', t: '2026-10-18T00:00:00Z', modo: 'sigue_el_dinero', alias: 'de-otro-servidor', pais: 'mx', puntaje: 9, recuperado_pct: 0, falsos_positivos: 0, mulas: 0, segundos: 1 },
    ];
    await r.sincronizar(0);
    expect(r.todas().map((j) => j.alias).sort()).toEqual(['de-otro-servidor', 'propia']);
  });
});
