import { describe, it, expect } from 'vitest';
import { entornoServidor, leerOpciones } from '../../scripts/servidor';

/** La lógica de `npm run servidor` que decide sobre la seguridad del demo. */

const BASE: NodeJS.ProcessEnv = { NODE_ENV: 'test' };

describe('leerOpciones', () => {
  it('por defecto: localhost:3000, con build, sin modos', () => {
    expect(leerOpciones([])).toEqual({ puerto: 3000, red: false, tunel: false, juego: false, persistir: false, build: true });
  });

  it('lee los flags', () => {
    expect(leerOpciones(['--red', '--juego', '--puerto', '4000', '--sin-build'])).toMatchObject({
      puerto: 4000, red: true, juego: true, build: false,
    });
  });

  it.each(['0', '70000', 'abc'])('rechaza --puerto %s', (p) => {
    expect(() => leerOpciones(['--puerto', p])).toThrow(/puerto/);
  });
});

describe('entornoServidor', () => {
  it('en localhost no exige token', () => {
    const { env, expuesto } = entornoServidor(leerOpciones([]), BASE);
    expect(expuesto).toBe(false);
    expect(env.DEMO_TOKEN).toBeUndefined();
  });

  it.each([['--red'], ['--tunel']])('expuesto con %s: genera un token si no hay', (flag) => {
    const { env, expuesto, tokenGenerado } = entornoServidor(leerOpciones([flag]), BASE);
    expect(expuesto).toBe(true);
    expect(tokenGenerado).toBe(true);
    expect(env.DEMO_TOKEN!.length).toBeGreaterThanOrEqual(16);
  });

  it('respeta el token que ya trae el entorno', () => {
    const { env, tokenGenerado } = entornoServidor(leerOpciones(['--tunel']), { ...BASE, DEMO_TOKEN: 'mio' });
    expect(env.DEMO_TOKEN).toBe('mio');
    expect(tokenGenerado).toBe(false);
  });

  it('dos arranques generan tokens distintos', () => {
    const a = entornoServidor(leerOpciones(['--red']), BASE).env.DEMO_TOKEN;
    const b = entornoServidor(leerOpciones(['--red']), BASE).env.DEMO_TOKEN;
    expect(a).not.toBe(b);
  });

  it('--juego activa los movimientos en vivo; --persistir apunta a .datos/', () => {
    const { env } = entornoServidor(leerOpciones(['--juego', '--persistir']), BASE);
    expect(env.MOVIMIENTOS_EN_VIVO).toBe('1');
    // Separador de ruta de cualquier sistema: `/` o `\`.
    expect(env.MEMORIA_ARCHIVO).toMatch(/\.datos[/\\]memoria\.json$/);
    expect(env.PARTIDAS_ARCHIVO).toMatch(/\.datos[/\\]partidas\.json$/);
  });

  it('no modifica el entorno que recibe', () => {
    const base = { ...BASE };
    entornoServidor(leerOpciones(['--red', '--juego']), base);
    expect(base).toEqual(BASE);
  });
});

describe('puertoLibre', () => {
  it('detecta un puerto ocupado (un servidor anterior que quedó abierto)', async () => {
    const { createServer } = await import('node:net');
    const { puertoLibre } = await import('../../scripts/servidor');
    const ocupado = createServer().listen(0, '127.0.0.1');
    await new Promise((r) => ocupado.once('listening', r));
    const puerto = (ocupado.address() as { port: number }).port;
    try {
      expect(await puertoLibre(puerto, '127.0.0.1')).toBe(false);
    } finally {
      await new Promise((r) => ocupado.close(r));
    }
    expect(await puertoLibre(puerto, '127.0.0.1')).toBe(true);
  });
});

describe('procesoVivo (vigilante contra huérfanos)', () => {
  it('este proceso está vivo; un pid que no existe, no', async () => {
    const { procesoVivo } = await import('../../scripts/servidor');
    expect(procesoVivo(process.pid)).toBe(true);
    expect(procesoVivo(2 ** 22 + 12345)).toBe(false);
  });
});
