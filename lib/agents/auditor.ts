import type { AgentResult, Caso, SalidaAuditor, ToolContext } from '@/lib/contracts';
import { afirmacionesCandidatas, auditorDeterministico, ensamblarAuditor } from './decisiones/auditor';
import { AuditorLLM } from './esquemas';
import { USO_CERO, type DepsAgentes } from './util';

/** 📋 Auditor: el código arma las afirmaciones; el LLM solo elige y redacta. */
export async function auditor(
  caso: Caso,
  _ctx: ToolContext,
  deps: DepsAgentes,
): Promise<AgentResult<SalidaAuditor>> {
  const candidatas = afirmacionesCandidatas(caso.evidencia);
  const riesgoDetective = caso.salidas.detective?.riesgo_destino;

  // Sin afirmaciones verificables no hay nada que redactar
  if (candidatas.length === 0) {
    return { salida: auditorDeterministico(candidatas, riesgoDetective), uso: USO_CERO };
  }

  try {
    const r = await deps.runAgent(
      'auditor',
      {
        puerta: caso.puerta,
        afirmaciones: candidatas.map((c, i) => ({ i, texto: c.texto })),
        riesgo_detective: riesgoDetective ?? null,
        estado_guardian: caso.salidas.guardian?.estado_usuario ?? null,
        decision: caso.decision ? { accion: caso.decision.accion, regla: caso.decision.regla } : null,
      },
      AuditorLLM,
      { nivel: 'capaz', maxLlamadas: 2, timeoutMs: 25_000 },
    );
    return {
      salida: ensamblarAuditor(r.salida, candidatas, {
        evidencia: caso.evidencia,
        riesgoDetective,
        estadoGuardian: caso.salidas.guardian?.estado_usuario,
      }),
      uso: r.uso,
    };
  } catch (err) {
    return {
      salida: auditorDeterministico(candidatas, riesgoDetective),
      uso: (err as { uso?: typeof USO_CERO }).uso ?? USO_CERO,
    };
  }
}
