import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { olvidarTokenOperador, tokenOperador } from '@/components/demo-dashboard';

/**
 * El operador abre la consola con `/?token=…`. El token se guarda en la
 * pestaña y se QUITA de la URL, para que no quede a la vista en el proyector.
 *
 * Se simula `window` (los tests corren en Node).
 */

function simularVentana(href: string) {
  const almacen = new Map<string, string>();
  const ventana = {
    location: { href },
    sessionStorage: {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
    },
    history: {
      replaceState: (_: unknown, __: string, url: string) => {
        ventana.location.href = url;
      },
    },
  };
  (globalThis as { window?: unknown }).window = ventana;
  return ventana;
}

beforeEach(() => {
  delete (globalThis as { window?: unknown }).window;
  olvidarTokenOperador();
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('tokenOperador', () => {
  it('sin token en la URL ni guardado: null (el demo en localhost no cambia)', () => {
    simularVentana('http://localhost:3000/');
    expect(tokenOperador()).toBeNull();
  });

  it('toma el token de la URL, lo guarda y lo quita de la URL', () => {
    const v = simularVentana('http://localhost:3000/?token=secreto&otra=1');
    expect(tokenOperador()).toBe('secreto');
    expect(v.location.href).toBe('http://localhost:3000/?otra=1');
    expect(v.location.href).not.toContain('secreto');
  });

  it('en las llamadas siguientes lo lee de la pestaña', () => {
    const v = simularVentana('http://localhost:3000/?token=secreto');
    tokenOperador();
    v.location.href = 'http://localhost:3000/';
    expect(tokenOperador()).toBe('secreto');
  });

  it('con el almacenamiento bloqueado, igual lo quita de la URL y lo usa', () => {
    const v = simularVentana('http://localhost:3000/?token=secreto');
    v.sessionStorage.setItem = () => {
      throw new Error('bloqueado');
    };
    v.sessionStorage.getItem = () => {
      throw new Error('bloqueado');
    };
    expect(tokenOperador()).toBe('secreto');
    expect(v.location.href).not.toContain('secreto');
  });
});
