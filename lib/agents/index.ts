import type { AgentsApi } from '@/lib/contracts';
import { auditor } from './auditor';
import { coordinador } from './coordinador';
import { detective } from './detective';
import { guardianTurno } from './guardian';
import { crearLlmAnthropic } from './llm';
import { calentarOllama, crearLlmOllama } from './llm-ollama';
import { configLimitadorDesdeEnv, limitar, type EstadoCarga } from './limitador';
import type { LlmCaller } from './llm';
import { crearRunAgent, modelosDesdeEnv } from './runtime';
import { runAgentSimulado } from './llm-simulado';
import type { DepsAgentes } from './util';

export { crearAgentesMock, detectarEscenario } from './mocks';
export { runAgentSimulado } from './llm-simulado';
export { AgentError, crearRunAgent } from './runtime';
export {
  acumularIA,
  auditar,
  continuarGuardian,
  debeAuditar,
  investigar,
  usoTotal,
  type ResultadoInvestigacion,
} from './orquestador';

/** Agentes reales sobre un `runAgent` dado (en tests se le pasa uno falso). */
export function crearAgentes(deps: DepsAgentes): AgentsApi {
  return {
    coordinador: (caso, ctx) => coordinador(caso, ctx),
    detective: (caso, ctx) => detective(caso, ctx, deps),
    guardianTurno: (caso, ctx, mensaje) => guardianTurno(caso, ctx, deps, mensaje),
    auditor: (caso, ctx) => auditor(caso, ctx, deps),
  };
}

export type ModoAgentes = 'claude' | 'ollama' | 'simulado';

/**
 * Qué modo usaría `obtenerAgentes` con este entorno (útil para /api/health).
 * Prioridad: `AGENTS_MOCK=1` → simulado; `OLLAMA_MODELO` → ollama (modelo
 * local, sin costo); `ANTHROPIC_API_KEY` → claude; si no, simulado.
 */
export function modoAgentes(env: NodeJS.ProcessEnv = process.env): ModoAgentes {
  if (env.AGENTS_MOCK === '1') return 'simulado';
  if (env.OLLAMA_MODELO?.trim()) return 'ollama';
  const key = env.ANTHROPIC_API_KEY;
  const hayKey = !!key && !key.startsWith('sk-ant-...');
  return hayKey ? 'claude' : 'simulado';
}

/** Modelos de Ollama: `OLLAMA_MODELO` para todo, `OLLAMA_MODELO_CAPAZ` opcional para el Auditor. */
export function modelosOllama(env: NodeJS.ProcessEnv = process.env) {
  const rapido = env.OLLAMA_MODELO!.trim();
  return { rapido, capaz: env.OLLAMA_MODELO_CAPAZ?.trim() || rapido };
}

let calentado = false;

// Un limitador por proceso y por modo: `obtenerAgentes()` se llama en cada
// transferencia, pero la cola y el cortacircuitos tienen que ser compartidos.
const g = globalThis as unknown as { __limitadoresLlm?: Map<string, ReturnType<typeof limitar>> };
const limitadores = (g.__limitadoresLlm ??= new Map());

function callerLimitado(modo: 'ollama' | 'claude', crear: () => LlmCaller, env: NodeJS.ProcessEnv) {
  let l = limitadores.get(modo);
  if (!l) {
    l = limitar(crear(), configLimitadorDesdeEnv(modo, env));
    limitadores.set(modo, l);
  }
  return l.caller;
}

/** Carga del modelo en este proceso (null en modo simulado: no hay modelo). */
export function estadoCargaAgentes(env: NodeJS.ProcessEnv = process.env): (EstadoCarga & { modo: ModoAgentes }) | null {
  const modo = modoAgentes(env);
  if (modo === 'simulado') return null;
  const l = limitadores.get(modo);
  return l ? { modo, ...l.estado() } : { modo, ...limitar(async () => ({ salida: null, tokens: 0 }), configLimitadorDesdeEnv(modo, env)).estado() };
}

/**
 * Punto de entrada que usa el pipeline de Ale:
 *   - `simulado` (AGENTS_MOCK=1 o sin API key): agentes REALES + tools reales,
 *     con un LLM simulado determinista. Corre de punta a punta sin red.
 *   - `ollama`: agentes reales con un modelo local (OLLAMA_MODELO).
 *   - `claude`: agentes reales con Claude (requiere ANTHROPIC_API_KEY).
 */
export function obtenerAgentes(env: NodeJS.ProcessEnv = process.env): AgentsApi {
  const modo = modoAgentes(env);
  if (modo === 'simulado') return crearAgentes({ runAgent: runAgentSimulado });
  if (modo === 'ollama') {
    const modelos = modelosOllama(env);
    if (!calentado) {
      calentado = true;
      void calentarOllama([modelos.rapido, modelos.capaz]);
    }
    return crearAgentes({ runAgent: crearRunAgent({ caller: callerLimitado('ollama', () => crearLlmOllama(), env), modelos }) });
  }
  const runAgent = crearRunAgent({ caller: callerLimitado('claude', () => crearLlmAnthropic(env.ANTHROPIC_API_KEY), env), modelos: modelosDesdeEnv(env) });
  return crearAgentes({ runAgent });
}
