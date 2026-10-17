import { describe, it, expect, beforeEach } from 'vitest';
import { POST as verdict } from '@/app/api/cases/[id]/verdict/route';
import { evaluarAlerta } from '@/lib/pipeline';
import { memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';

/**
 * POST /api/cases/[id]/verdict — el único camino hacia la Memoria (R10).
 *
 * Se llama al route handler directamente, sin levantar un servidor.
 */

const llamar = (id: string, cuerpo: unknown) =>
  verdict(
    new Request(`http://test/api/cases/${id}/verdict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    }),
    { params: Promise.resolve({ id }) },
  );

let casoId = '';

beforeEach(async () => {
  storeCasos.limpiar();
  memoria.limpiar();
  casoId = (await evaluarAlerta('M-01', 'fan-in con reenvío inmediato')).caso.id;
});

describe('verdict — solo un humano identificado escribe en la Memoria', () => {
  it('confirma la mula con un analista identificado', async () => {
    const r = await llamar(casoId, { veredicto: 'mula_confirmada', validado_por: 'analista_01' });
    expect(r.status).toBe(200);
    expect(memoria.esMulaConfirmada('M-01', new Date('2026-10-17'))).toBe(true);
  });

  it.each([
    ['sin validado_por', { veredicto: 'mula_confirmada' }],
    ['validado_por vacío', { veredicto: 'mula_confirmada', validado_por: '' }],
    // Antes devolvía 500: zod aceptaba los espacios y la Memoria lanzaba.
    ['validado_por solo espacios', { veredicto: 'mula_confirmada', validado_por: '   ' }],
    ['veredicto desconocido', { veredicto: 'quizas', validado_por: 'analista_01' }],
    ['JSON roto', '{nope'],
  ])('%s → 400 y nada entra a la Memoria', async (_, cuerpo) => {
    const r = await llamar(casoId, cuerpo);
    expect(r.status).toBe(400);
    expect(memoria.cantidad).toBe(0);
  });

  it('caso inexistente → 404', async () => {
    const r = await llamar('CASO-9999', { veredicto: 'mula_confirmada', validado_por: 'analista_01' });
    expect(r.status).toBe(404);
  });

  it('descartar NO deja la cuenta marcada como mula (CU-02)', async () => {
    const r = await llamar(casoId, { veredicto: 'descartada', validado_por: 'analista_01' });
    expect(r.status).toBe(200);
    expect(memoria.esMulaConfirmada('M-01', new Date('2026-10-17'))).toBe(false);
  });
});
