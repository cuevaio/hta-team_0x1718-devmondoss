/**
 * Simulación para tests y evals: ToolContext en memoria a partir de hallazgos,
 * runAgent falso y constructor de casos. Sirve también como REFERENCIA de lo
 * que el ToolContext real de Ale tiene que cumplir (ver lib/agents/README.md).
 *
 * No se usa en producción.
 */
import type { z } from 'zod';
import type { Caso, Evidencia, RunAgent, ToolContext, UsoAgente, Veredicto } from '@/lib/contracts';
import type { Cliente } from '@/lib/data/types';
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
  /** Canales del cliente (forma de `analytics.canales_seguros` de Ale). */
  canal?: { seguros?: string[]; comprometidos?: string[]; alcanzable?: boolean };
  /** Respuestas encoladas en el buzón (modo una-llamada del pipeline). */
  respuestas?: string[];
  sinTools?: boolean;
}

/**
 * ToolContext en memoria con la forma tipada de `lib/contracts/firmas.ts`.
 * Una tool sin hallazgo configurado (o con `sinTools`) falla: el agente la trata
 * como no disponible, igual que si la tool real se cayera.
 */
export function crearCtx(op: OpcionesCtx = {}) {
  const ledger = crearLedger();
  const llamadas: string[] = [];
  const enviados: string[] = [];
  const cola = [...(op.respuestas ?? [])];
  const h = op.hallazgos ?? {};

  const tool =
    <D>(fuente: string, data: D | undefined, conEvidencia = true) =>
    async () => {
      llamadas.push(fuente);
      if (op.sinTools || data === undefined) throw new Error(`tool ${fuente} no disponible`);
      return { data, evidencia: conEvidencia ? [ledger.registrar(fuente, data)] : [] };
    };

  const canal = {
    seguros: op.canal?.seguros ?? ['app', 'sms'],
    comprometidos: op.canal?.comprometidos ?? [],
  };

  const ctx: ToolContext = {
    data: {
      cuenta: () => null,
      cliente: () => null,
      clientePorCuenta: (c: string) => ({ id: c }) as unknown as Cliente,
      entrantes: () => [],
      salientes: () => [],
      umbralReporte: () => 10_000,
      ahora: () => new Date(),
    },
    analytics: {
      perfil_cuenta: tool('perfil_cuenta', h.perfil),
      listas_riesgo: tool('listas_riesgo', h.listas),
      fan_in: tool('fan_in', h.fan_in),
      reenvio_rapido: tool('reenvio_rapido', h.reenvio),
      estructuracion: tool('estructuracion', h.estructuracion),
      ciclos: tool('ciclos', h.ciclos ?? { cuenta: 'X', ciclo: null, marcado: false }),
      cadena_reenvio: tool('cadena_reenvio', h.reenvio?.destinos ?? [], false),
      tipologias_marcadas: tool('tipologias_marcadas', [], false),
      canales_seguros: tool('canales_seguros', { cliente: 'cliente', ...canal }, false),
      disponibilidad: tool(
        'disponibilidad',
        { cliente: 'cliente', alcanzable: op.canal?.alcanzable ?? true, canales_disponibles: canal.seguros },
        false,
      ),
    } as unknown as ToolContext['analytics'],
    memoria: { get: (c: string) => op.memoria?.[c] ?? null },
    evidencia: ledger,
    mensajes: {
      enviar: async (_c, texto) => {
        enviados.push(texto);
      },
      esperar: async () => cola.shift() ?? null,
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
