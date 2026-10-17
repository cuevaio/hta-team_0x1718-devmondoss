import semillaJson from './seed.json';
import type { Cliente, Cuenta, Movimiento, Semilla } from './types';

/**
 * Repositorio de datos. Única puerta de acceso a la semilla.
 *
 * Los agentes NUNCA leen de aquí directamente: lo hacen a través de
 * `ToolContext.data` (blueprint §3).
 *
 * Dueño: Ale_dev.
 */

const semilla = semillaJson as Semilla;

/**
 * Ancla temporal. Los datos son sintéticos y fijos, así que "ahora" también
 * debe serlo o las analytics darían resultados distintos cada día.
 */
export function ahora(): Date {
  return new Date(semilla.generado);
}

export function umbralReporte(): number {
  return semilla.umbral_reporte;
}

export function notaDatos(): string {
  return semilla.nota;
}

export function cuentas(): Cuenta[] {
  return semilla.cuentas;
}

export function cuenta(id: string): Cuenta | null {
  return semilla.cuentas.find((c) => c.id === id) ?? null;
}

export function clientes(): Cliente[] {
  return semilla.clientes;
}

export function cliente(id: string): Cliente | null {
  return semilla.clientes.find((c) => c.id === id) ?? null;
}

/** Cliente dueño de una cuenta, si existe. */
export function clientePorCuenta(cuentaId: string): Cliente | null {
  return semilla.clientes.find((c) => c.cuenta === cuentaId) ?? null;
}

export function movimientos(): Movimiento[] {
  return semilla.movimientos;
}

function horasAtras(t: string, ref: Date): number {
  return (ref.getTime() - new Date(t).getTime()) / 3_600_000;
}

/** Movimientos entrantes a una cuenta dentro de una ventana de horas hacia atrás. */
export function entrantes(cuentaId: string, horas: number, ref: Date = ahora()): Movimiento[] {
  return semilla.movimientos.filter((m) => {
    if (m.destino !== cuentaId) return false;
    const h = horasAtras(m.t, ref);
    return h >= 0 && h <= horas;
  });
}

/** Movimientos salientes de una cuenta dentro de una ventana de horas hacia atrás. */
export function salientes(cuentaId: string, horas: number, ref: Date = ahora()): Movimiento[] {
  return semilla.movimientos.filter((m) => {
    if (m.origen !== cuentaId) return false;
    const h = horasAtras(m.t, ref);
    return h >= 0 && h <= horas;
  });
}

/** Todo el historial saliente, sin ventana. */
export function historialSalientes(cuentaId: string): Movimiento[] {
  return semilla.movimientos.filter((m) => m.origen === cuentaId);
}

/** ¿El origen ya transfirió antes a ese destino? Base de "beneficiario nuevo". */
export function yaTransfirio(origen: string, destino: string, ref: Date = ahora()): boolean {
  return semilla.movimientos.some(
    (m) => m.origen === origen && m.destino === destino && new Date(m.t) <= ref,
  );
}

export const repo = {
  ahora,
  umbralReporte,
  notaDatos,
  cuentas,
  cuenta,
  clientes,
  cliente,
  clientePorCuenta,
  movimientos,
  entrantes,
  salientes,
  historialSalientes,
  yaTransfirio,
};

export type Repo = typeof repo;
