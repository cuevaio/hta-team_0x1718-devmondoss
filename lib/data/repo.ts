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
 * Movimientos en vivo: transferencias del juego que SÍ movieron dinero.
 *
 * Es una capa encima de la semilla, que nunca se modifica. Solo se llena con
 * `MOVIMIENTOS_EN_VIVO=1` (modo juego, DEMO_JUEGO §9): así el fan-in de una
 * mula crece con los jugadores y se «quema» en vivo. Sin la variable, el
 * comportamiento es exactamente el de la semilla (demo, tests, frontend).
 *
 * `POST /api/demo/reset` la vacía y vuelve a la semilla.
 */
const enVivo: Movimiento[] = [];

export function movimientosEnVivoActivos(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MOVIMIENTOS_EN_VIVO === '1';
}

/** Registra una transferencia que movió dinero. Ocurre en el instante `ahora()`. */
export function registrarMovimiento(origen: string, destino: string, monto: number): Movimiento {
  const m: Movimiento = {
    id: `VIVO-${String(enVivo.length + 1).padStart(4, '0')}`,
    origen,
    destino,
    monto,
    moneda: 'PEN',
    t: ahora().toISOString(),
  };
  enVivo.push(m);
  return m;
}

export function movimientosEnVivo(): Movimiento[] {
  return [...enVivo];
}

export function limpiarMovimientosEnVivo(): void {
  enVivo.length = 0;
}

const todos = (): Movimiento[] =>
  enVivo.length === 0 ? semilla.movimientos : [...semilla.movimientos, ...enVivo];

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

/** País de la cuenta en la red regional. Sin dato, es de este banco: Perú. */
export function paisDe(cuentaId: string): NonNullable<Cuenta['pais']> {
  return cuenta(cuentaId)?.pais ?? 'pe';
}

/** Cliente dueño de una cuenta, si existe. */
export function clientePorCuenta(cuentaId: string): Cliente | null {
  return semilla.clientes.find((c) => c.cuenta === cuentaId) ?? null;
}

export function movimientos(): Movimiento[] {
  return todos();
}

function horasAtras(t: string, ref: Date): number {
  return (ref.getTime() - new Date(t).getTime()) / 3_600_000;
}

/** Movimientos entrantes a una cuenta dentro de una ventana de horas hacia atrás. */
export function entrantes(cuentaId: string, horas: number, ref: Date = ahora()): Movimiento[] {
  return todos().filter((m) => {
    if (m.destino !== cuentaId) return false;
    const h = horasAtras(m.t, ref);
    return h >= 0 && h <= horas;
  });
}

/** Movimientos salientes de una cuenta dentro de una ventana de horas hacia atrás. */
export function salientes(cuentaId: string, horas: number, ref: Date = ahora()): Movimiento[] {
  return todos().filter((m) => {
    if (m.origen !== cuentaId) return false;
    const h = horasAtras(m.t, ref);
    return h >= 0 && h <= horas;
  });
}

/** Todo el historial saliente, sin ventana. */
export function historialSalientes(cuentaId: string): Movimiento[] {
  return todos().filter((m) => m.origen === cuentaId);
}

/** ¿El origen ya transfirió antes a ese destino? Base de "beneficiario nuevo". */
export function yaTransfirio(origen: string, destino: string, ref: Date = ahora()): boolean {
  return todos().some(
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
  paisDe,
  movimientos,
  entrantes,
  salientes,
  historialSalientes,
  yaTransfirio,
  registrarMovimiento,
  movimientosEnVivo,
  limpiarMovimientosEnVivo,
};

export type Repo = typeof repo;
