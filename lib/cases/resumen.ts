import type { Caso } from '@/lib/contracts';
import { ttpaDe } from '@/lib/observability';

/**
 * Resumen de un caso para el feed del monitor (`GET /api/cases`,
 * DEMO_JUEGO §5): lo que se lee a 5 metros, sin el detalle completo.
 *
 * El detalle (evidencia, expediente, timeline) sigue en `GET /api/cases/[id]`.
 *
 * Dueño: Ale_dev.
 */

const AGENTES = ['memoria', 'coordinador', 'guardian', 'detective', 'auditor'] as const;
export type ActorResumen = (typeof AGENTES)[number];

export function resumenCaso(caso: Caso, alias: string | null = null) {
  const eventos = caso.timeline.map((e) => e.evento);
  // Orden real de aparición en el timeline: es el que el monitor «enciende».
  const actores: ActorResumen[] = [];
  for (const e of caso.timeline) {
    const a = e.actor as ActorResumen;
    if (AGENTES.includes(a) && !actores.includes(a)) actores.push(a);
  }

  return {
    id: caso.id,
    puerta: caso.puerta,
    alias,
    t: caso.timeline[0]?.t ?? null,
    origen: caso.transaccion.origen,
    destino: caso.transaccion.destino,
    monto: caso.transaccion.monto,
    score: caso.nivel0.score,
    senales: caso.nivel0.senales,
    decision: caso.decision ? { accion: caso.decision.accion, regla: caso.decision.regla } : null,
    pausa_preventiva: eventos.includes('pausa_preventiva'),
    resuelto_por_memoria: caso.decision?.regla === 'P1',
    /** El Guardián hizo una pregunta y el cliente todavía no respondió. */
    esperando_cliente: eventos.includes('turno_pendiente') && !caso.salidas.guardian,
    llamadas_ia: caso.ia.llamadas,
    ttpa_ms: ttpaDe(caso),
    actores,
  };
}

export type ResumenCaso = ReturnType<typeof resumenCaso>;
