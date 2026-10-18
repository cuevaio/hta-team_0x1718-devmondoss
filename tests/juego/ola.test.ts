import { describe, expect, it } from 'vitest';
import { Ola } from '@/lib/juego/ola';

/** Ola de ataques contra el pipeline real (modo simulado en tests). */
describe('ola de ataques', () => {
  it('lanza N ataques concurrentes, todos terminan y las mulas quedan retenidas', async () => {
    const o = new Ola();
    expect(o.lanzar(30, 100)).toBe(true);
    expect(o.lanzar(5, 10)).toBe(false); // una a la vez
    for (let i = 0; i < 200 && o.estado().activa; i++) await new Promise((r) => setTimeout(r, 50));
    const e = o.estado();
    expect(e.activa).toBe(false);
    expect(e.completados).toBe(30);
    expect(e.errores).toBe(0);
    expect(e.a_mulas + e.legitimos).toBe(30);
    // Los pagos legítimos nunca se bloquean, ni bajo carga.
    expect(e.legitimos_pasaron).toBe(e.legitimos);
    // Con montos chicos a mulas nuevas existe el «hueco» P3 documentado (~62% retenido en
    // promedio). La mezcla es al azar: con 30 ataques se exige solo un piso holgado.
    expect(e.mulas_retenidas / Math.max(1, e.a_mulas)).toBeGreaterThan(0.25);
  }, 20_000);
});
