/**
 * Modelo de datos semilla.
 *
 * TODO lo que hay aquí es sintético. No hay datos reales de ninguna persona
 * ni institución. Ver `nota` en seed.json.
 *
 * Dueño: Ale_dev (blueprint §4).
 */

/**
 * CONTRACT: los valores son los de `TipoCuenta` en `lib/contracts/analytics.ts`
 * (AGENT_PLAYBOOKS §6). `desconocido` cubre las cuentas de tránsito, cuyo
 * titular real no conocemos.
 */
export type TipoCuenta = 'persona' | 'comercio' | 'desconocido';

export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  /** Fecha de apertura, ISO corta. Una cuenta recién abierta es señal débil. */
  abierta: string;
  /**
   * País de la cuenta en la red regional (mismos valores que `Pais` en
   * lib/contracts/memoria.ts). Ausente = Perú, el país de este banco.
   */
  pais?: 'pe' | 'co' | 'bo' | 'br';
  /** Banco de la cuenta, si no es este. Sintético. */
  banco?: string;
}

export interface Movimiento {
  id: string;
  origen: string;
  destino: string;
  monto: number;
  moneda: 'PEN';
  /** ISO 8601 completo. Las analytics dependen de esto. */
  t: string;
}

/** Canal de contacto con el cliente. */
export type Canal = 'app' | 'sms' | 'llamada' | 'email' | 'presencial';

/**
 * Estado del cliente en el momento de la operación.
 *
 * ⚠️ R1 (doc 15): aquí NO hay edad, discapacidad, nivel de ingreso ni ningún
 * atributo demográfico. No se infieren ni se usan como señal de riesgo.
 * Lo que se modela es la CAPACIDAD DE RESPUESTA y la CONFIABILIDAD DEL CANAL,
 * que es una propiedad de la situación, no de la persona.
 */
export interface Cliente {
  id: string;
  nombre: string;
  cuenta: string;
  /** Promedio de monto de los últimos 90 días. Base de la señal de monto atípico. */
  promedio_90d: number;
  /** Beneficiarios ya usados antes (pagos recurrentes incluidos). */
  beneficiarios_habituales: string[];
  dispositivo_habitual: string;
  /** Canales que el cliente declaró usables. Preferencia explícita, no diagnóstico. */
  canales_disponibles: Canal[];
  /** Canales marcados como comprometidos (dispositivo robado, SIM swap). */
  canales_comprometidos: Canal[];
  /** ¿Puede responder ahora? Estado de la situación, no de la persona. */
  alcanzable: boolean;
}

export interface Semilla {
  generado: string;
  nota: string;
  /** Umbral de reporte para la tipología de estructuración. Valor a validar en normativa. */
  umbral_reporte: number;
  cuentas: Cuenta[];
  clientes: Cliente[];
  movimientos: Movimiento[];
  /**
   * Veredictos que OTROS bancos ya publicaron en la red regional (sintéticos).
   * Forma de `VeredictoRed` (lib/contracts/memoria.ts); se valida al cargar.
   */
  red_regional?: unknown[];
}
