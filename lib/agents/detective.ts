import type { AgentResult, Caso, Evidencia, SalidaDetective, ToolContext } from '@/lib/contracts';
import {
  ResultadoCiclos,
  ResultadoEstructuracion,
  ResultadoFanIn,
  ResultadoListas,
  ResultadoPerfil,
  ResultadoReenvio,
} from '@/lib/contracts';
import {
  ensamblarDetective,
  requiereLLMDetective,
  riesgoBase,
  siguientesTools,
  tipologiasMarcadas,
  type Hallazgos,
  type ToolDetective,
} from './decisiones/detective';
import { DetectiveLLM } from './esquemas';
import { USO_CERO, evidenciaDelCaso, llamarTool, sumarUso, type DepsAgentes } from './util';

const MAX_PASOS = 3; // guarda contra loops: el plan real termina en 2

export interface OpcionesDetective {
  /** Decide si el monto cae en la banda cercana al umbral de reporte (pendiente de definir). */
  montoCercaUmbral?: (monto: number) => boolean;
}

async function ejecutar(
  tool: ToolDetective,
  cuenta: string,
  caso: Caso,
  ctx: ToolContext,
): Promise<{ h: Partial<Hallazgos>; ev: Evidencia[] }> {
  const previo = (fuente: string, schema: Parameters<typeof evidenciaDelCaso>[2]) =>
    evidenciaDelCaso(caso.evidencia, fuente, schema, cuenta);
  switch (tool) {
    case 'perfil_cuenta': {
      const r = previo('perfil_cuenta', ResultadoPerfil) ?? (await llamarTool(ctx, tool, cuenta, ResultadoPerfil));
      return { h: r ? { perfil: r.data as Hallazgos['perfil'] } : {}, ev: r?.evidencia ?? [] };
    }
    case 'listas_riesgo': {
      const r = await llamarTool(ctx, tool, cuenta, ResultadoListas);
      return { h: r ? { listas: r.data } : {}, ev: r?.evidencia ?? [] };
    }
    case 'fan_in': {
      const r = await llamarTool(ctx, tool, cuenta, ResultadoFanIn);
      return { h: r ? { fan_in: r.data } : {}, ev: r?.evidencia ?? [] };
    }
    case 'reenvio_rapido': {
      const r = await llamarTool(ctx, tool, cuenta, ResultadoReenvio);
      return { h: r ? { reenvio: r.data } : {}, ev: r?.evidencia ?? [] };
    }
    case 'estructuracion': {
      const r = await llamarTool(ctx, tool, cuenta, ResultadoEstructuracion);
      return { h: r ? { estructuracion: r.data } : {}, ev: r?.evidencia ?? [] };
    }
    case 'ciclos': {
      const r = await llamarTool(ctx, tool, cuenta, ResultadoCiclos);
      return { h: r ? { ciclos: r.data } : {}, ev: r?.evidencia ?? [] };
    }
  }
}

/** 🔍 Detective: tools por plan fijo, riesgo por tabla, LLM solo en `medio`. */
export async function detective(
  caso: Caso,
  ctx: ToolContext,
  deps: DepsAgentes,
  opciones: OpcionesDetective = {},
): Promise<AgentResult<SalidaDetective>> {
  const cuenta = caso.transaccion.destino;
  const montoCercaUmbral = opciones.montoCercaUmbral?.(caso.transaccion.monto) ?? false;

  let h: Hallazgos = {};
  const evidencia: Evidencia[] = [];
  const intentadas = new Set<ToolDetective>();

  for (let paso = 0; paso < MAX_PASOS; paso++) {
    const tools = siguientesTools(h, { montoCercaUmbral }).filter((t) => !intentadas.has(t));
    if (tools.length === 0) break;
    const resultados = await Promise.all(tools.map((t) => ejecutar(t, cuenta, caso, ctx)));
    tools.forEach((t) => intentadas.add(t));
    for (const r of resultados) {
      h = { ...h, ...r.h };
      evidencia.push(...r.ev);
    }
  }

  const ids = [...new Set(evidencia.map((e) => e.id))];

  // Ninguna tool respondió: modo seguro, no se puede afirmar nada sobre la cuenta
  if (Object.keys(h).length === 0) {
    return {
      salida: {
        riesgo_destino: 'medio',
        tipologias: [],
        hipotesis: 'No se pudo analizar la cuenta destino (las tools no respondieron); requiere revisión',
        cadena: [],
        evidencia: ids,
      },
      uso: USO_CERO,
    };
  }

  const tipologias = tipologiasMarcadas(h);
  const base = riesgoBase(tipologias, h.perfil?.banco_propio ?? true);

  let llm: DetectiveLLM | undefined;
  let uso = USO_CERO;
  if (requiereLLMDetective(base)) {
    try {
      const r = await deps.runAgent(
        'detective',
        {
          cuenta,
          tipo_cuenta: h.perfil?.tipo ?? 'desconocido',
          antiguedad_dias: h.perfil?.antiguedad_dias ?? null,
          banco_propio: h.perfil?.banco_propio ?? true,
          tipologias,
          hallazgos: {
            fan_in: h.fan_in && { remitentes_nuevos: h.fan_in.remitentes_nuevos, horas: h.fan_in.ventana_horas },
            reenvio: h.reenvio && { porcentaje: h.reenvio.porcentaje_reenviado, horas: h.reenvio.ventana_horas },
            estructuracion: h.estructuracion && { operaciones: h.estructuracion.operaciones_cercanas_umbral },
          },
          evidencia: evidencia.map((e) => ({ id: e.id, fuente: e.fuente })),
        },
        DetectiveLLM,
        { nivel: 'rapido', maxLlamadas: 2, timeoutMs: 15_000 },
      );
      llm = r.salida;
      uso = r.uso;
    } catch (err) {
      // Modo seguro: sin LLM el riesgo se queda en `medio`
      uso = (err as { uso?: typeof USO_CERO }).uso ?? USO_CERO;
    }
  }

  const { salida } = ensamblarDetective({
    hallazgos: h,
    evidencia: ids,
    cadena: h.reenvio ? [cuenta, ...h.reenvio.destinos] : [cuenta],
    llm,
  });
  return { salida, uso: sumarUso(uso) };
}
