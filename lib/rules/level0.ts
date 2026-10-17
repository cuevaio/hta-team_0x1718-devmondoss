import type { ContextoOperacion, Nivel0, Transaccion } from '@/lib/contracts';
import type { SenalNivel0 } from '@/lib/contracts/analytics';

/**
 * Reglas nivel 0 — sin IA.
 *
 * Fuente: doc 19 §2. Los puntajes son EXACTAMENTE los de la tabla.
 *
 * ⚠️ R1 (doc 15) — sesgo: las 6 señales son todas propiedades de la OPERACIÓN
 * (beneficiario, monto, dispositivo, canal, horario). Ninguna es un atributo
 * de la persona. Está prohibido agregar aquí edad, discapacidad, nivel de
 * ingreso, ubicación precisa o cualquier proxy de esos. Hay un test que lo
 * verifica: `tests/rules/sin-sesgo.test.ts`.
 *
 * Dueño: Ale_dev.
 */

/**
 * Tabla de puntajes del doc 19 §2.
 *
 * CONTRACT: los ids son los de `SENALES_NIVEL0` en `lib/contracts/analytics.ts`
 * (fijados por AGENT_PLAYBOOKS §6). El tipo `Senal = SenalNivel0` hace que el
 * compilador falle si esta tabla se desvía del contrato.
 */
export const PUNTAJES: Record<SenalNivel0, number> = {
  beneficiario_nuevo: 2,
  monto_atipico: 2,
  dispositivo_nuevo: 2,
  cambio_sim_o_clave: 2,
  llamada_activa: 3,
  horario_atipico: 1,
};

export type Senal = SenalNivel0;

/** Múltiplo del promedio de 90 días a partir del cual el monto es atípico. */
export const MULTIPLO_MONTO_ATIPICO = 3;

export type NivelRiesgo = 'bajo' | 'medio' | 'alto';

/** Umbrales de la segunda tabla del doc 19 §2. */
export function nivelDeScore(score: number): NivelRiesgo {
  if (score <= 2) return 'bajo';
  if (score <= 4) return 'medio';
  return 'alto';
}

/** Con score alto se pausa antes de llamar a cualquier agente → TTPA ≈ 0. */
export function requierePausaPreventiva(score: number): boolean {
  return nivelDeScore(score) === 'alto';
}

/**
 * Evalúa las señales y devuelve score + atajos deterministas.
 *
 * Los dos atajos del doc 19 §2 se evalúan ANTES de puntuar:
 *  - destino en Memoria como mula confirmada → P1
 *  - beneficiario habitual sin señales de compromiso → P2
 *
 * El atajo no reemplaza el score: se devuelven ambos, y es el Policy Engine
 * quien decide. Así la decisión queda en un solo lugar auditable.
 */
export function evaluateRules(_tx: Transaccion, ctx: ContextoOperacion): Nivel0 {
  const senales: Senal[] = [];

  if (ctx.beneficiario_nuevo) senales.push('beneficiario_nuevo');
  if (ctx.monto_vs_promedio_90d > MULTIPLO_MONTO_ATIPICO) senales.push('monto_atipico');
  if (ctx.dispositivo_nuevo_24h) senales.push('dispositivo_nuevo');
  if (ctx.cambio_sim_o_clave_72h) senales.push('cambio_sim_o_clave');
  if (ctx.llamada_activa_o_acceso_remoto) senales.push('llamada_activa');
  if (ctx.horario_atipico) senales.push('horario_atipico');

  const score = senales.reduce((s, señal) => s + PUNTAJES[señal], 0);

  return { senales, score, atajo: atajoDe(ctx) };
}

/**
 * Señales que indican que la cuenta podría estar comprometida.
 * Si hay alguna, el atajo P2 (beneficiario habitual) NO aplica: un atacante
 * con el dispositivo también puede pagarle al beneficiario habitual.
 */
function hayCompromiso(ctx: ContextoOperacion): boolean {
  return (
    ctx.dispositivo_nuevo_24h ||
    ctx.cambio_sim_o_clave_72h ||
    ctx.llamada_activa_o_acceso_remoto
  );
}

function atajoDe(ctx: ContextoOperacion): 'P2' | undefined {
  // P1 lo decide el pipeline consultando la Memoria, no estas reglas.
  if (ctx.beneficiario_habitual && !hayCompromiso(ctx)) return 'P2';
  return undefined;
}
