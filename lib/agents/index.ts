import type { AgentsApi } from '@/lib/contracts';
import { auditor } from './auditor';
import { coordinador } from './coordinador';
import { detective, type OpcionesDetective } from './detective';
import { guardianTurno } from './guardian';
import { crearLlmAnthropic } from './llm';
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
export function crearAgentes(deps: DepsAgentes, opciones: OpcionesDetective = {}): AgentsApi {
  return {
    coordinador: (caso, ctx) => coordinador(caso, ctx),
    detective: (caso, ctx) => detective(caso, ctx, deps, opciones),
    guardianTurno: (caso, ctx, mensaje) => guardianTurno(caso, ctx, deps, mensaje),
    auditor: (caso, ctx) => auditor(caso, ctx, deps),
  };
}

export type ModoAgentes = 'claude' | 'simulado';

/** Qué modo usaría `obtenerAgentes` con este entorno (útil para /api/health). */
export function modoAgentes(env: NodeJS.ProcessEnv = process.env): ModoAgentes {
  const key = env.ANTHROPIC_API_KEY;
  const hayKey = !!key && !key.startsWith('sk-ant-...');
  return env.AGENTS_MOCK === '1' || !hayKey ? 'simulado' : 'claude';
}

/**
 * Punto de entrada que usa el pipeline de Ale:
 *   - `simulado` (AGENTS_MOCK=1 o sin API key): agentes REALES + tools reales,
 *     con un LLM simulado determinista. Corre de punta a punta sin red.
 *   - `claude`: agentes reales con Claude (requiere ANTHROPIC_API_KEY).
 */
export function obtenerAgentes(env: NodeJS.ProcessEnv = process.env): AgentsApi {
  if (modoAgentes(env) === 'simulado') return crearAgentes({ runAgent: runAgentSimulado });
  const runAgent = crearRunAgent({ caller: crearLlmAnthropic(env.ANTHROPIC_API_KEY), modelos: modelosDesdeEnv(env) });
  return crearAgentes({ runAgent });
}
