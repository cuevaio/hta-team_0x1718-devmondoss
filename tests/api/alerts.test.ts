import { describe, it, expect, beforeEach } from 'vitest';
import { POST as alerts } from '@/app/api/alerts/route';
import { memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';

/** POST /api/alerts — Puerta B. Se llama al route handler directamente. */

const llamar = (cuerpo: unknown) =>
  alerts(
    new Request('http://test/api/alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    }),
  );

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
});

describe('alerts — Puerta B', () => {
  it('una alerta sobre la mula produce un caso escalado por P5 (CU-02)', async () => {
    const r = await llamar({ cuenta: 'M-01', motivo: 'fan-in con reenvío inmediato' });
    expect(r.status).toBe(201);
    const caso = await r.json();
    expect(caso.decision).toMatchObject({ accion: 'ESCALAR', regla: 'P5' });
    expect(caso.puerta).toBe('alerta_aml');
  });

  it('una cuenta que no existe es 404, no un caso PERMITIDO por falta de datos', async () => {
    const r = await llamar({ cuenta: 'X-99', motivo: 'x' });
    expect(r.status).toBe(404);
    expect(storeCasos.cantidad).toBe(0);
  });

  it.each([
    ['cuenta vacía', { cuenta: '' }],
    ['cuenta solo espacios', { cuenta: '   ' }],
    ['sin cuenta', { motivo: 'x' }],
    ['JSON roto', '{nope'],
  ])('%s → 400 y no se abre caso', async (_, cuerpo) => {
    const r = await llamar(cuerpo);
    expect(r.status).toBe(400);
    expect(storeCasos.cantidad).toBe(0);
  });

  it('el motivo es opcional', async () => {
    const r = await llamar({ cuenta: 'M-01' });
    expect(r.status).toBe(201);
  });
});
