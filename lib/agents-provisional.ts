import type {
  AgentsApi,
  AgentResult,
  Caso,
  SalidaAuditor,
  SalidaCoordinador,
  SalidaDetective,
  ToolContext,
  TurnoGuardian,
  UsoAgente,
} from '@/lib/contracts';
import { aplicarConsistenciaDetective } from '@/lib/contracts';
import { decidirCoordinador } from '@/lib/agents/decisiones/coordinador';
import {
  BANCO_PREGUNTAS,
  clasificarRapido,
  estadoFinal,
  seleccionarPreguntas,
  senalesDe,
  debeParar,
  type IdPregunta,
  type Respuesta,
} from '@/lib/agents/decisiones/guardian';
import {
  siguientesTools,
  type Hallazgos,
  type ToolDetective,
} from '@/lib/agents/decisiones/detective';
import { analytics } from '@/lib/analytics';

/**
 * ⚠️ ADAPTADOR PROVISIONAL — lo reemplaza `lib/agents/index.ts` de Tony.
 *
 * El blueprint §6 pone la entrega del `AgentsApi` de Tony en la hora 5. Para no
 * quedarme bloqueado (riesgo declarado en mi SPRINTS.md), aquí **compongo sus
 * funciones de decisión deterministas** (`lib/agents/decisiones/*`) con mis
 * analytics, y ejecuto el plan de tools.
 *
 * Importante:
 *  - **no reimplemento su lógica**: importo `decidirCoordinador`,
 *    `seleccionarPreguntas`, `estadoFinal`, `siguientesTools` tal cual;
 *  - **cero LLM**: lo que falta es solo la parte que él va a cubrir con el
 *    modelo (clasificar respuestas ambiguas y redactar el expediente);
 *  - vive FUERA de `lib/agents/`, que es su territorio, para borrarse de un
 *    solo `rm` cuando llegue el suyo.
 *
 * Dueño: Ale_dev (temporal).
 */

const SIN_USO: UsoAgente = { llamadas: 0, tokens: 0, ms: 0 };

/** Historial largo y limpio: cuenta antigua, sin tipologías marcadas. */
function destinoConocidoLimpio(cuentaId: string): boolean {
  const perfil = analytics.perfilCuenta(cuentaId);
  const antiguo = (perfil.antiguedad_dias ?? 0) > 180;
  return antiguo && analytics.tipologiasMarcadas(cuentaId).length === 0;
}

export const agentesProvisional: AgentsApi = {
  /** 🧭 Coordinador — tabla determinista de Tony. 0 llamadas de LLM. */
  async coordinador(caso: Caso): Promise<AgentResult<SalidaCoordinador>> {
    const salida = decidirCoordinador({
      puerta: caso.puerta,
      score: caso.nivel0.score,
      senales: caso.nivel0.senales,
      atajo: caso.nivel0.atajo,
      memoria_hit: false, // el pipeline ya resolvió P1 antes de llegar aquí
      destino_conocido_limpio: destinoConocidoLimpio(caso.transaccion.destino),
    });
    return { salida, uso: SIN_USO };
  },

  /** 🔍 Detective — ejecuta el plan de tools de Tony sobre mis analytics. */
  async detective(caso: Caso, ctx: ToolContext): Promise<AgentResult<SalidaDetective>> {
    const destino = caso.transaccion.destino;
    const hallazgos: Hallazgos = {};
    // Los ids los devuelven las tools. No se leen de `caso.evidencia`, que el
    // pipeline sincroniza DESPUÉS de que el agente termina.
    const ids: string[] = [];
    const montoCercaUmbral =
      caso.transaccion.monto >= ctx.data.umbralReporte() * 0.9 &&
      caso.transaccion.monto <= ctx.data.umbralReporte();

    // Máx. 2 pasos: la condición de parada la define siguientesTools().
    for (let paso = 0; paso < 2; paso++) {
      const tools = siguientesTools(hallazgos, { montoCercaUmbral });
      if (tools.length === 0) break;
      // Las tools del mismo paso corren en paralelo (19 §7).
      await Promise.all(tools.map((t) => ejecutarTool(t, destino, ctx, hallazgos, ids)));
    }

    const tipologias = analytics.tipologiasMarcadas(destino);
    const cadena = analytics.cadenaReenvio(destino, 2);

    // Riesgo base por tabla: el par fan_in + reenvio_rapido es lo que define
    // una mula. Fan-in solo NO basta — la bodega también lo tiene (CU-05).
    const riesgo =
      hallazgos.fan_in?.marcado && hallazgos.reenvio?.marcado
        ? 'alto'
        : hallazgos.estructuracion?.marcado || hallazgos.ciclos?.marcado
          ? 'medio'
          : 'bajo';

    const bruto: SalidaDetective = {
      riesgo_destino: riesgo,
      tipologias,
      hipotesis:
        riesgo === 'alto'
          ? 'cuenta de paso (mula) en cadena de layering'
          : riesgo === 'medio'
            ? 'patrón atípico sin el par que define una mula'
            : 'alto volumen de entrada sin reenvío: patrón de comercio',
      cadena: cadena.length > 1 ? cadena : [destino],
      evidencia: ids,
    };

    // Regla de consistencia del doc 19 §3.
    const { salida } = aplicarConsistenciaDetective(bruto, tipologias);
    return { salida, uso: SIN_USO };
  },

  /** 🛡️ Guardián — guion cerrado de Tony. Las preguntas son texto fijo. */
  async guardianTurno(
    caso: Caso,
    ctx: ToolContext,
    mensajeCliente?: string,
  ): Promise<AgentResult<TurnoGuardian>> {
    const cliente = ctx.data.clientePorCuenta(caso.transaccion.origen);
    if (!cliente) {
      return {
        salida: {
          terminado: true,
          salida: {
            estado_usuario: 'no_consultado',
            senales_manipulacion: [],
            canal_usado: 'ninguno',
            evidencia: [],
          },
        },
        uso: SIN_USO,
      };
    }

    const { data: canales } = await ctx.analytics.canales_seguros(cliente.id);
    const canalComprometido = canales.comprometidos.length > 0 || canales.seguros.length === 0;

    // G1 — canal comprometido: no se verifica por ahí (FM3). Se termina ya.
    if (canalComprometido) {
      return {
        salida: {
          terminado: true,
          salida: {
            estado_usuario: estadoFinal([], { canalComprometido: true }),
            senales_manipulacion: [],
            canal_usado: canales.seguros[0] ?? 'ninguno',
            // No se preguntó nada: no hay evidencia propia que citar.
            evidencia: [],
          },
        },
        uso: SIN_USO,
      };
    }

    const preguntas = seleccionarPreguntas(caso.nivel0.senales);
    const respuestas: Respuesta[] = [];
    const canal = canales.seguros[0] ?? 'app';
    const ids: string[] = [];

    for (const id of preguntas as IdPregunta[]) {
      const pregunta = BANCO_PREGUNTAS[id];
      await ctx.mensajes.enviar(cliente.id, pregunta.texto);

      const texto = mensajeCliente ?? (await ctx.mensajes.esperar(cliente.id, 1000));
      // Sin LLM: solo la clasificación rápida. Lo ambiguo queda `incierta`,
      // que `estadoFinal` trata como `sin_respuesta` — el lado conservador.
      const clasificacion = clasificarRapido(texto) ?? 'incierta';
      respuestas.push({ pregunta: id, clasificacion } as Respuesta);

      if (texto !== null && texto !== undefined) {
        const e = ctx.evidencia.registrar('guardian_respuesta', {
          pregunta: pregunta.texto,
          texto,
        });
        ids.push(e.id);
      }

      if (debeParar(respuestas)) break;
    }

    return {
      salida: {
        terminado: true,
        salida: {
          estado_usuario: estadoFinal(respuestas, { canalComprometido: false }),
          senales_manipulacion: senalesDe(respuestas),
          canal_usado: canal,
          evidencia: ids,
        },
      },
      uso: SIN_USO,
    };
  },

  /**
   * 📋 Auditor — plantilla determinista.
   *
   * Es el recorte #2 del blueprint §8 aplicado de forma provisional: redacta
   * desde la evidencia registrada, así cada afirmación cita un id que el
   * ledger emitió. Tony lo reemplaza por el Auditor con LLM.
   */
  async auditor(caso: Caso): Promise<AgentResult<SalidaAuditor>> {
    const afirmaciones: SalidaAuditor['afirmaciones'] = [];
    for (const e of caso.evidencia) {
      const texto = describir(e.fuente, e.dato);
      if (texto) afirmaciones.push({ texto, evidencia: [e.id] });
    }

    const alto = caso.salidas.detective?.riesgo_destino === 'alto';

    return {
      salida: {
        resumen: `Operación de S/${caso.transaccion.monto} desde ${caso.transaccion.origen} hacia ${caso.transaccion.destino}.`,
        hipotesis: alto ? 'estafa + cuenta mula' : 'operación sin patrón de mula',
        recomendacion: alto ? 'escalar' : 'descartar',
        afirmaciones,
        acciones_sugeridas: alto
          ? ['confirmar mula', 'preparar borrador de ROS']
          : ['cerrar sin acción'],
        confianza: afirmaciones.length >= 2 ? 'alta' : 'media',
        requiere_revision_manual: false,
      },
      uso: SIN_USO,
    };
  },
};

async function ejecutarTool(
  tool: ToolDetective,
  destino: string,
  ctx: ToolContext,
  h: Hallazgos,
  ids: string[],
): Promise<void> {
  const recoger = <T>(r: { data: T; evidencia: { id: string }[] }): T => {
    ids.push(...r.evidencia.map((e) => e.id));
    return r.data;
  };
  switch (tool) {
    case 'perfil_cuenta':
      h.perfil = recoger(await ctx.analytics.perfil_cuenta(destino));
      return;
    case 'listas_riesgo':
      h.listas = recoger(await ctx.analytics.listas_riesgo(destino));
      return;
    case 'fan_in':
      h.fan_in = recoger(await ctx.analytics.fan_in(destino));
      return;
    case 'reenvio_rapido':
      h.reenvio = recoger(await ctx.analytics.reenvio_rapido(destino));
      return;
    case 'estructuracion':
      h.estructuracion = recoger(await ctx.analytics.estructuracion(destino));
      return;
    case 'ciclos':
      h.ciclos = recoger(await ctx.analytics.ciclos(destino));
      return;
  }
}

function describir(fuente: string, dato: unknown): string | null {
  const d = dato as Record<string, unknown>;
  switch (fuente) {
    case 'fan_in':
      return `La cuenta recibió de ${d.remitentes_nuevos} remitentes nuevos en ${d.ventana_horas}h.`;
    case 'reenvio_rapido':
      return `Reenvió el ${Math.round(Number(d.porcentaje_reenviado) * 100)}% de lo recibido en menos de ${d.ventana_horas}h.`;
    case 'estructuracion':
      return `Registra ${d.operaciones_cercanas_umbral} operaciones justo por debajo del umbral de reporte.`;
    case 'perfil_cuenta':
      return `La cuenta tiene ${d.antiguedad_dias} días de antigüedad y es de tipo ${d.tipo}.`;
    case 'ciclos':
      return Array.isArray(d.ciclo) ? `Forma un ciclo: ${(d.ciclo as string[]).join(' → ')}.` : null;
    case 'guardian_respuesta':
      return `El titular respondió: "${d.texto}".`;
    default:
      return null;
  }
}
