import type { Evidencia, ToolContext } from '@/lib/contracts';
import type { Fuente } from '@/lib/contracts/analytics';
import { analytics } from '@/lib/analytics';
import { repo } from '@/lib/data/repo';
import { memoria } from '@/lib/memory/store';
import type { LedgerEvidencia } from '@/lib/evidence/ledger';

/**
 * Construye el `ToolContext` que reciben los agentes de Tony (blueprint §3).
 *
 * Se arma POR CASO, porque el ledger de evidencia es por caso: así los ids
 * `E-xx` de un caso no se mezclan con los de otro.
 *
 * Cada analytic se envuelve como `Tool`: calcula, registra la evidencia con la
 * `fuente` del contrato y devuelve `{ data, evidencia }`. El agente recibe el
 * `data` (un `Resultado*` de `lib/contracts/analytics.ts`) y el id ya emitido,
 * así **nunca necesita inventar un id**.
 *
 * Dueño: Ale_dev.
 */

export interface BuzonMensajes {
  /** Lo que el Guardián envió al cliente. El demo lo imprime. */
  enviados: Array<{ cliente: string; texto: string; t: string }>;
  /** Respuestas que el cliente tiene en cola. Las carga el escenario o la API. */
  respuestas: Map<string, string[]>;
}

export function nuevoBuzon(): BuzonMensajes {
  return { enviados: [], respuestas: new Map() };
}

/** Deja una respuesta en cola para que `esperar()` la encuentre. */
export function encolarRespuesta(buzon: BuzonMensajes, cliente: string, texto: string): void {
  const cola = buzon.respuestas.get(cliente) ?? [];
  cola.push(texto);
  buzon.respuestas.set(cliente, cola);
}

export function construirToolContext(
  ledger: LedgerEvidencia,
  buzon: BuzonMensajes,
): ToolContext {
  /** Envuelve una analytic: calcula → registra evidencia → devuelve {data, evidencia}. */
  const tool =
    <A extends unknown[], D>(fuente: Fuente, fn: (...args: A) => D) =>
    async (...args: A) => {
      const data = fn(...args);
      return { data, evidencia: [ledger.registrar(fuente, data)] };
    };

  /** Igual, pero sin emitir evidencia: es contexto operativo, no un hallazgo. */
  const sinEvidencia =
    <A extends unknown[], D>(fn: (...args: A) => D) =>
    async (...args: A) => ({ data: fn(...args), evidencia: [] as Evidencia[] });

  return {
    data: {
      cuenta: repo.cuenta,
      cliente: repo.cliente,
      clientePorCuenta: repo.clientePorCuenta,
      entrantes: repo.entrantes,
      salientes: repo.salientes,
      umbralReporte: repo.umbralReporte,
      ahora: repo.ahora,
    },

    analytics: {
      // Hallazgos: emiten evidencia con las `fuente` de AGENT_PLAYBOOKS §6.
      perfil_cuenta: tool('perfil_cuenta', analytics.perfilCuenta),
      fan_in: tool('fan_in', analytics.fanIn),
      reenvio_rapido: tool('reenvio_rapido', analytics.reenvioRapido),
      estructuracion: tool('estructuracion', analytics.estructuracion),
      ciclos: tool('ciclos', analytics.ciclos),
      listas_riesgo: tool('listas_riesgo', analytics.listasRiesgo),
      // Contexto operativo, no hallazgo: no está en FUENTES.
      cadena_reenvio: sinEvidencia(analytics.cadenaReenvio),
      disponibilidad: sinEvidencia(analytics.disponibilidad),
      canales_seguros: sinEvidencia(analytics.canalesSeguros),
      tipologias_marcadas: sinEvidencia(analytics.tipologiasMarcadas),
    },

    // Solo lectura: escribir en la Memoria requiere un analista (doc 15, R10).
    memoria: {
      get: (cuenta: string) => memoria.get(cuenta, repo.ahora()),
    },

    // Única vía para obtener un id de evidencia válido.
    evidencia: {
      registrar: (fuente: string, dato: unknown) => ledger.registrar(fuente, dato),
    },

    mensajes: {
      async enviar(cliente: string, texto: string) {
        buzon.enviados.push({ cliente, texto, t: new Date().toISOString() });
      },
      async esperar(cliente: string) {
        const cola = buzon.respuestas.get(cliente);
        // Sin respuesta en cola = silencio. El silencio NO es aprobación.
        if (!cola || cola.length === 0) return null;
        return cola.shift() ?? null;
      },
    },
  };
}
