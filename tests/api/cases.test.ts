import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listar } from '@/app/api/cases/route';
import { POST as transfers } from '@/app/api/transfers/route';
import { POST as alerts } from '@/app/api/alerts/route';
import { evaluarTransferencia } from '@/lib/pipeline';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';
import { repo } from '@/lib/data/repo';
import { motivoAliasInvalido } from '@/lib/juego/alias';
import type { ResumenCaso } from '@/lib/cases/resumen';

/** GET /api/cases (feed del monitor) y el alias anónimo del jugador. */

const post = (handler: (r: Request) => Promise<Response>, url: string, cuerpo: unknown) =>
  handler(
    new Request(`http://test${url}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }),
  );

const feed = async (query = '') => {
  const r = await listar(new Request(`http://test/api/cases${query}`));
  return { status: r.status, body: (await r.json()) as { total: number; casos: ResumenCaso[] } };
};

const ROSA = {
  transaccion: { origen: 'C-ROSA', destino: 'M-01', monto: 4800, moneda: 'PEN' },
  contexto: { llamada_activa_o_acceso_remoto: true },
  respuestaCliente: 'sí, me está guiando un asesor del banco',
};

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
});

describe('GET /api/cases — feed del monitor', () => {
  it('vacío al empezar', async () => {
    const { status, body } = await feed();
    expect(status).toBe(200);
    expect(body).toEqual({ total: 0, casos: [] });
  });

  it('del más nuevo al más viejo, con decisión y regla', async () => {
    await post(transfers, '/api/transfers', ROSA);
    await post(transfers, '/api/transfers', {
      transaccion: { origen: 'C-JORGE', destino: 'B-PEPE', monto: 2000, moneda: 'PEN' },
    });
    const { body } = await feed();
    expect(body.total).toBe(2);
    expect(body.casos.map((c) => c.id)).toEqual(['CASO-0002', 'CASO-0001']);
    expect(body.casos[1]).toMatchObject({
      decision: { accion: 'ESCALAR', regla: 'P4' },
      pausa_preventiva: true,
      resuelto_por_memoria: false,
    });
    expect(body.casos[0].decision).toEqual({ accion: 'PERMITIR', regla: 'P8' });
  });

  it('los agentes aparecen en el orden real del pipeline', async () => {
    await post(transfers, '/api/transfers', ROSA);
    const { body } = await feed();
    const a = body.casos[0].actores;
    expect(a[0]).toBe('coordinador');
    expect(a.at(-1)).toBe('auditor');
    expect(a).toEqual(expect.arrayContaining(['detective', 'guardian']));
  });

  it('Jorge sobre una mula confirmada: Memoria y ningún agente (el atajo del monitor)', async () => {
    memoria.confirm(
      'M-01',
      crearVeredicto({ cuenta: 'M-01', veredicto: 'mula_confirmada', validado_por: 'a1', expediente: 'X', hoy: repo.ahora() }),
    );
    await evaluarTransferencia({ origen: 'C-JORGE', destino: 'M-01', monto: 2200, moneda: 'PEN' });
    const [c] = (await feed()).body.casos;
    expect(c).toMatchObject({ resuelto_por_memoria: true, llamadas_ia: 0, actores: ['memoria'] });
  });

  it('marca el caso que espera la respuesta del cliente', async () => {
    await post(transfers, '/api/transfers', { transaccion: ROSA.transaccion, contexto: ROSA.contexto });
    expect((await feed()).body.casos[0].esperando_cliente).toBe(true);
  });

  it('respeta ?limite=', async () => {
    for (let i = 0; i < 3; i++) {
      await evaluarTransferencia({ origen: 'C-LUCIA', destino: 'H-SOL', monto: 650, moneda: 'PEN' });
    }
    const { body } = await feed('?limite=2');
    expect(body.total).toBe(3);
    expect(body.casos.map((c) => c.id)).toEqual(['CASO-0003', 'CASO-0002']);
  });

  it.each(['?limite=0', '?limite=101', '?limite=abc'])('query inválida %s → 400', async (q) => {
    expect((await feed(q)).status).toBe(400);
  });
});

describe('alias del jugador', () => {
  it('se asocia al crear el caso y aparece en el feed', async () => {
    await post(transfers, '/api/transfers', { ...ROSA, alias: '  Zorro  ' });
    await post(alerts, '/api/alerts', { cuenta: 'M-01', alias: 'Ana' });
    const { body } = await feed();
    expect(body.casos.map((c) => c.alias)).toEqual(['Ana', 'Zorro']);
  });

  it('sin alias, el feed lo muestra como null (el demo de consola no cambia)', async () => {
    await post(transfers, '/api/transfers', ROSA);
    expect((await feed()).body.casos[0].alias).toBeNull();
  });

  it.each([
    ['un correo', 'ana@correo.pe'],
    ['un teléfono', '987 654 321'],
    ['un enlace', 'www.algo.pe'],
    ['vacío', '   '],
    ['demasiado largo', 'x'.repeat(25)],
  ])('rechaza %s con 400 y no abre el caso', async (_, alias) => {
    const r = await post(transfers, '/api/transfers', { ...ROSA, alias });
    expect(r.status).toBe(400);
    expect(storeCasos.cantidad).toBe(0);
  });

  it('acepta alias con algunos números', () => {
    expect(motivoAliasInvalido('Zorro2026')).toBeNull();
  });

  it('el reset borra los alias', async () => {
    await post(transfers, '/api/transfers', { ...ROSA, alias: 'Zorro' });
    storeCasos.limpiar();
    await post(transfers, '/api/transfers', ROSA);
    expect((await feed()).body.casos[0].alias).toBeNull();
  });
});
