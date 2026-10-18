import { describe, it, expect, beforeEach } from 'vitest';
import { correrSuite, type ResultadoPrueba } from '@/lib/demo/suite';
import { storeCasos } from '@/lib/cases/store';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { repo } from '@/lib/data/repo';
import { GET, POST } from '@/app/api/demo/suite/route';

/** La suite en vivo de `/demo` tiene que pasar entera y no dejarle rastro al juego. */

const correr = async () => {
  const r: ResultadoPrueba[] = [];
  for await (const x of correrSuite({ NODE_ENV: 'test', AGENTS_MOCK: '1' })) r.push(x);
  return r;
};

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
});

describe('suite en vivo (/demo)', () => {
  it('todas las pruebas pasan con sus chequeos', async () => {
    const r = await correr();
    const fallas = r.flatMap((p) => (p.error ? [`${p.id}: ${p.error}`] : p.chequeos.filter((c) => !c.ok).map((c) => `${p.id}: ${c.texto} (${c.valor})`)));
    expect(fallas).toEqual([]);
    expect(r.every((p) => p.ok)).toBe(true);
    expect(r.map((p) => p.id)).toEqual(['rosa', 'inyeccion', 'silencio', 'bodega', 'suplantacion', 'hotel', 'alerta', 'memoria', 'red', 'caida', 'matriz']);
  });

  it('la matriz evalúa 750 ataques sin violar ningún invariante, y no los deja en el store', async () => {
    const r = await correr();
    const m = r.find((p) => p.id === 'matriz')!.matriz!;
    expect(m.combinaciones).toBe(750);
    expect(m.invariantes.map((i) => i.violaciones)).toEqual([0, 0, 0, 0, 0]);
    // Quedan solo los casos de las demás pruebas.
    expect(storeCasos.cantidad).toBe(r.reduce((n, p) => n + p.casos.length, 0));
  });

  it('la Memoria queda como estaba: M-01 no queda confirmada para el juego', async () => {
    memoria.confirm('M-03', crearVeredicto({ cuenta: 'M-03', veredicto: 'mula_confirmada', validado_por: 'analista_x', expediente: 'X', hoy: repo.ahora() }));
    await correr();
    expect(memoria.esMulaConfirmada('M-01', repo.ahora())).toBe(false);
    expect(memoria.esMulaConfirmada('M-03', repo.ahora())).toBe(true);
  });

  it('la ruta no pide token aunque el servidor tenga DEMO_TOKEN', async () => {
    const previo = process.env.DEMO_TOKEN;
    process.env.DEMO_TOKEN = 'secreto-de-prueba';
    try {
      const res = await POST();
      expect(res.status).toBe(200);
      await res.text();
    } finally {
      if (previo === undefined) delete process.env.DEMO_TOKEN;
      else process.env.DEMO_TOKEN = previo;
    }
  });

  it('la ruta lista las pruebas y entrega un resultado por línea', async () => {
    const lista = (await (await GET()).json()) as { pruebas: unknown[] };
    expect(lista.pruebas).toHaveLength(11);
    const res = await POST();
    const lineas = (await res.text()).trim().split('\n').map((l) => JSON.parse(l) as ResultadoPrueba);
    expect(lineas).toHaveLength(11);
    expect(lineas.every((l) => l.ok)).toBe(true);
  });
});
