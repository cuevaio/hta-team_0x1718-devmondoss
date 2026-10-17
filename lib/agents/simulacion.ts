/**
 * Simulación para tests y evals: ToolContext en memoria a partir de hallazgos,
 * runAgent falso y constructor de casos. Sirve también como REFERENCIA de lo
 * que el ToolContext real de Ale tiene que cumplir (ver lib/agents/README.md).
 *
 * No se usa en producción.
 */
import type { z } from 'zod';
import type { Caso, Evidencia, RunAgent, ToolContext, UsoAgente, Veredicto } from '@/lib/contracts';
import { AgentError } from './runtime';
import type { Hallazgos } from './decisiones/detective';

/** Ledger falso: asigna ids E-xx como lo hará `lib/evidence/ledger.ts` de Ale. */
export function crearLedger() {
  const todas: Evidencia[] = [];
  return {
    todas,
    registrar(fuente: string, dato: unknown): Evidencia {
      const e = { id: `E-${String(todas.length + 1).padStart(2, '0')}`, fuente, dato };
      todas.push(e);
      return e;
    },
  };
}

export interface OpcionesCtx {
  hallazgos?: Hallazgos;
  memoria?: Record<string, Veredicto>;
  canal?: { canal_comprometido: boolean; canal_habitual?: string; canal_seguro?: string | null };
  sinTools?: boolean;
}

export function crearCtx(op: OpcionesCtx = {}) {
  const ledger = crearLedger();
  const llamadas: string[] = [];
  const enviados: string[] = [];
  const h = op.hallazgos ?? {};

  const tool = (fuente: string, data: unknown) => async () => {
    llamadas.push(fuente);
    return { data, evidencia: [ledger.registrar(fuente, data)] };
  };

  const analytics: ToolContext['analytics'] = {};
  if (!op.sinTools) {
    if (h.perfil) analytics.perfil_cuenta = tool('perfil_cuenta', h.perfil);
    if (h.listas) analytics.listas_riesgo = tool('listas_riesgo', h.listas);
    if (h.fan_in) analytics.fan_in = tool('fan_in', h.fan_in);
    if (h.reenvio) analytics.reenvio_rapido = tool('reenvio_rapido', h.reenvio);
    if (h.estructuracion) analytics.estructuracion = tool('estructuracion', h.estructuracion);
    analytics.ciclos = tool('ciclos', h.ciclos ?? { cuenta: 'X', ciclo: null, marcado: false });
    analytics.canales = tool('canales', {
      cliente: 'cliente',
      canal_comprometido: op.canal?.canal_comprometido ?? false,
      canal_habitual: op.canal?.canal_habitual ?? 'app',
      canal_seguro: op.canal?.canal_seguro ?? null,
    });
  }

  const ctx: ToolContext = {
    data: {},
    analytics,
    memoria: { get: (c: string) => op.memoria?.[c] ?? null },
    evidencia: ledger,
    mensajes: {
      enviar: async (_c, texto) => {
        enviados.push(texto);
      },
      esperar: async () => null,
    },
  };
  return { ctx, ledger, llamadas, enviados };
}

export function casoDe(o: {
  origen?: string;
  destino: string;
  senales?: string[];
  score?: number;
  puerta?: 'transferencia' | 'alerta_aml';
  atajo?: 'P1' | 'P2';
  evidencia?: Evidencia[];
  salidas?: Caso['salidas'];
  monto?: number;
}): Caso {
  return {
    id: 'CASO-0001',
    puerta: o.puerta ?? 'transferencia',
    transaccion: { origen: o.origen ?? 'rosa', destino: o.destino, monto: o.monto ?? 4800, moneda: 'PEN' },
    nivel0: { senales: o.senales ?? [], score: o.score ?? 0, ...(o.atajo ? { atajo: o.atajo } : {}) },
    evidencia: o.evidencia ?? [],
    salidas: o.salidas ?? {},
    timeline: [],
    ia: { llamadas: 0, tokens: 0, costo_estimado: 0 },
  };
}

export const USO: UsoAgente = { llamadas: 1, tokens: 100, ms: 10 };

/** runAgent falso: responde con lo que se le configure y registra las llamadas. */
export function crearRunAgentFalso(respuestas: Partial<Record<string, unknown>> = {}, falla = false) {
  const calls: { nombre: string; input: unknown }[] = [];
  const runAgent = (async (nombre: string, input: unknown, schema: z.ZodType) => {
    calls.push({ nombre, input });
    if (falla || !(nombre in respuestas)) throw new AgentError(`${nombre}: falla simulada`, USO);
    return { salida: schema.parse(respuestas[nombre]), uso: USO };
  }) as unknown as RunAgent;
  return { runAgent, calls };
}
