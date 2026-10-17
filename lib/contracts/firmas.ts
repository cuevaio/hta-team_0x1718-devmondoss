import type { z } from 'zod';
import type { Caso } from './index';
import type {
  DecisionAccion,
  Evidencia,
  Nivel0,
  ReglaPolicy,
  Transaccion,
} from './caso';
import type {
  NombreAgente,
  SalidaAuditor,
  SalidaCoordinador,
  SalidaDetective,
  SalidaGuardian,
} from './agentes';
import type { Veredicto } from './memoria';

/**
 * Firmas acordadas entre Tony_dev y Ale_dev.
 *
 * Fuente: docs/work/00_WORK_BLUEPRINT.md §3
 *
 * Esto es lo único que NO se cambia sin avisar (commit con `CONTRACT:`).
 * Cada uno implementa su lado contra estos tipos y nadie queda esperando al otro.
 *
 * Reparto vigente (re-split):
 *   Ale  implementa: evaluateRules, decide, Memoria, Tool/analytics, ToolContext, runPipeline
 *   Tony implementa: runAgent, AgentsApi (los 4 agentes + mocks)
 */

// ─────────────────────────────────────────────────────────────
// Implementa Ale_dev — plataforma determinista
// ─────────────────────────────────────────────────────────────

/** Contexto de la cuenta y el dispositivo en el momento de la operación. */
export interface ContextoOperacion {
  beneficiario_nuevo: boolean;
  monto_vs_promedio_90d: number;
  dispositivo_nuevo_24h: boolean;
  cambio_sim_o_clave_72h: boolean;
  llamada_activa_o_acceso_remoto: boolean;
  horario_atipico: boolean;
  beneficiario_habitual: boolean;
}

export type EvaluateRules = (tx: Transaccion, ctx: ContextoOperacion) => Nivel0;

export type Decide = (caso: Caso) => {
  accion: DecisionAccion;
  regla: ReglaPolicy;
};

export interface Memoria {
  get(cuenta: string): Veredicto | null;
  confirm(cuenta: string, veredicto: Veredicto): void;
}

/** Toda tool devuelve su dato y la evidencia con ids ya asignados. */
export type Tool<Args extends unknown[] = unknown[], Data = unknown> = (
  ...args: Args
) => Promise<{ data: Data; evidencia: Evidencia[] }>;

// ─────────────────────────────────────────────────────────────
// Implementa Tony_dev — agentes (todo lo que llama a un LLM)
// ─────────────────────────────────────────────────────────────

/**
 * Niveles de modelo del runtime.
 *
 * Decisión de stack (docs/context/tony_dev/AGENTS_RUNTIME_NOTES.md):
 *   rapido → claude-haiku-5-5   (Coordinador, Guardián, Detective)
 *   capaz  → claude-opus-5-5    (Auditor; corre solo en casos pausados)
 */
export type NivelModelo = 'rapido' | 'capaz';

export interface OpcionesAgente {
  nivel: NivelModelo;
  maxLlamadas: number;
  timeoutMs: number;
}

export interface UsoAgente {
  llamadas: number;
  tokens: number;
  ms: number;
}

/**
 * `runAgent` valida la salida contra el esquema; si falla, reintenta una vez
 * y si vuelve a fallar entra en modo seguro (19 §3).
 */
export type RunAgent = <S extends z.ZodType>(
  nombre: NombreAgente,
  input: unknown,
  schema: S,
  opciones: OpcionesAgente,
) => Promise<{ salida: z.infer<S>; uso: UsoAgente }>;

/** Entrada de la Puerta B: una alerta AML ya existente, sin cliente al otro lado. */
export interface AlertaAML {
  cuenta: string;
  motivo: string;
}

export type RunPipeline = (entrada: Transaccion | AlertaAML) => Promise<Caso>;

// ─────────────────────────────────────────────────────────────
// Presupuesto por caso (19 §7, R13)
// ─────────────────────────────────────────────────────────────

/** Máximo de llamadas de IA por caso. Nunca se dispara el costo. */
export const MAX_LLAMADAS_POR_CASO = 10;

/** Límites por agente, del doc 19 §3. */
export const LIMITES_AGENTE = {
  coordinador: { maxLlamadas: 1 },
  guardian: { maxLlamadas: 3 },
  detective: { maxLlamadas: 6 },
  auditor: { maxLlamadas: 2 },
} as const;

// ─────────────────────────────────────────────────────────────
// Frontera entre los dos bloques
// ─────────────────────────────────────────────────────────────

/**
 * Lo que Ale expone a los agentes de Tony. Los agentes NUNCA leen datos
 * por otra vía ni inventan ids de evidencia.
 */
export interface ToolContext {
  /** Cuenta/historial. Ale define el detalle de los datos en lib/data/repo.ts. */
  data: Record<string, (...args: never[]) => unknown>;
  /** Funciones deterministas: fanIn, reenvioRapido, estructuracion, ciclos, listasRiesgo, disponibilidad, canalesSeguros. */
  analytics: Record<string, Tool>;
  /** Solo lectura para los agentes. */
  memoria: Pick<Memoria, 'get'>;
  /** Asigna ids E-xx. */
  evidencia: { registrar(fuente: string, dato: unknown): Evidencia };
  /** Canal simulado con el cliente (Guardián). */
  mensajes: {
    enviar(cliente: string, texto: string): Promise<void>;
    esperar(cliente: string, ms: number): Promise<string | null>;
  };
}

/**
 * CONTRACT: el Guardián conversa varios turnos (máx. 3), así que cada turno
 * devuelve el mensaje a enviar y, solo al terminar, la salida final.
 */
export interface TurnoGuardian {
  /** Texto de la siguiente pregunta (del banco cerrado). Ausente al terminar. */
  mensaje?: string;
  terminado: boolean;
  /** Presente solo cuando `terminado` es true. */
  salida?: SalidaGuardian;
}

export interface AgentResult<T> {
  salida: T;
  uso: UsoAgente;
}

/**
 * Lo que Tony expone a Ale. Con AGENTS_MOCK=1 devuelve salidas fijas por escenario.
 */
export interface AgentsApi {
  coordinador(caso: Caso, ctx: ToolContext): Promise<AgentResult<SalidaCoordinador>>;
  detective(caso: Caso, ctx: ToolContext): Promise<AgentResult<SalidaDetective>>;
  guardianTurno(
    caso: Caso,
    ctx: ToolContext,
    mensajeCliente?: string,
  ): Promise<AgentResult<TurnoGuardian>>;
  auditor(caso: Caso, ctx: ToolContext): Promise<AgentResult<SalidaAuditor>>;
}
