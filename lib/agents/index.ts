import type { AgentsApi } from '@/lib/contracts';
import { auditor } from './auditor';
import { coordinador } from './coordinador';
import { detective, type OpcionesDetective } from './detective';
import { guardianTurno } from './guardian';
import { crearLlmAnthropic } from './llm';
import { crearAgentesMock } from './mocks';
import { crearRunAgent, modelosDesdeEnv } from './runtime';
import type { DepsAgentes } from './util';

export { crearAgentesMock, detectarEscenario } from './mocks';
export { AgentError, crearRunAgent } from './runtime';

/** Agentes reales sobre un `runAgent` dado (en tests se le pasa uno falso). */
export function crearAgentes(deps: DepsAgentes, opciones: OpcionesDetective = {}): AgentsApi {
  return {
    coordinador: (caso, ctx) => coordinador(caso, ctx),
    detective: (caso, ctx) => detective(caso, ctx, deps, opciones),
    guardianTurno: (caso, ctx, mensaje) => guardianTurno(caso, ctx, deps, mensaje),
    auditor: (caso, ctx) => auditor(caso, ctx, deps),
  };
}

/**
 * Punto de entrada que usa el pipeline de Ale:
 *   AGENTS_MOCK=1 → salidas fijas por escenario (sin key, sin red)
 *   si no         → agentes reales con Claude (requiere ANTHROPIC_API_KEY)
 */
export function obtenerAgentes(env: NodeJS.ProcessEnv = process.env): AgentsApi {
  if (env.AGENTS_MOCK === '1') return crearAgentesMock();
  const runAgent = crearRunAgent({ caller: crearLlmAnthropic(env.ANTHROPIC_API_KEY), modelos: modelosDesdeEnv(env) });
  return crearAgentes({ runAgent });
}
