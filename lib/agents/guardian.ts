import type { AgentResult, Caso, Evidencia, ToolContext, TurnoGuardian } from '@/lib/contracts';
import { DatoRespuestaGuardian, ResultadoCanal } from '@/lib/contracts';
import {
  BANCO_PREGUNTAS,
  clasificarRapido,
  debeParar,
  detectaIntentoAprobar,
  estadoFinal,
  senalesDe,
  seleccionarPreguntas,
  type IdPregunta,
  type Respuesta,
  type RespuestaClasificada,
} from './decisiones/guardian';
import { GuardianLLM, type SenalGuardian } from './esquemas';
import { USO_CERO, llamarTool, type DepsAgentes } from './util';

const CANAL_DEFECTO: ResultadoCanal = {
  cliente: '',
  canal_comprometido: false,
  canal_habitual: 'app',
  canal_seguro: null,
};

/** Reconstruye la conversación desde la evidencia del caso (el agente no guarda estado). */
function leerRespuestas(evidencia: Evidencia[]): { respuestas: Respuesta[]; ids: string[] } {
  const respuestas: Respuesta[] = [];
  const ids: string[] = [];
  for (const e of evidencia) {
    if (e.fuente !== 'guardian_respuesta') continue;
    const d = DatoRespuestaGuardian.safeParse(e.dato);
    if (!d.success || !d.data.id || !d.data.clasificacion) continue;
    respuestas.push({
      pregunta: d.data.id,
      clasificacion: d.data.clasificacion,
      senales_extra: d.data.senales_extra,
    });
    ids.push(e.id);
  }
  return { respuestas, ids };
}

/**
 * 🛡️ Guardián — un turno de la conversación.
 *
 *   - `mensajeCliente === undefined` → primer turno: envía la primera pregunta.
 *   - `mensajeCliente` con texto     → respuesta del cliente a la pregunta pendiente.
 *   - `mensajeCliente === ''`        → el cliente no respondió a tiempo (timeout).
 *
 * Las preguntas salen de un banco cerrado: el Guardián nunca pide claves ni aprueba.
 */
export async function guardianTurno(
  caso: Caso,
  ctx: ToolContext,
  deps: DepsAgentes,
  mensajeCliente?: string,
): Promise<AgentResult<TurnoGuardian>> {
  const cliente = caso.transaccion.origen;
  const preguntas = seleccionarPreguntas(caso.nivel0.senales);
  const { respuestas, ids } = leerRespuestas(caso.evidencia);
  let uso = USO_CERO;

  const canalRes = await llamarTool(ctx, 'canales', cliente, ResultadoCanal);
  const canal = canalRes?.data ?? { ...CANAL_DEFECTO, cliente };
  if (canalRes) ids.push(...canalRes.evidencia.map((e) => e.id));

  const terminar = (): AgentResult<TurnoGuardian> => ({
    salida: {
      terminado: true,
      salida: {
        estado_usuario: estadoFinal(respuestas, { canalComprometido: canal.canal_comprometido }),
        senales_manipulacion: senalesDe(respuestas),
        canal_usado: canal.canal_seguro ?? canal.canal_habitual,
        evidencia: [...new Set(ids)],
      },
    },
    uso,
  });

  const preguntar = async (id: IdPregunta): Promise<AgentResult<TurnoGuardian>> => {
    const texto = BANCO_PREGUNTAS[id].texto;
    await ctx.mensajes?.enviar(cliente, texto);
    return { salida: { mensaje: texto, terminado: false }, uso };
  };

  // Primer turno
  if (mensajeCliente === undefined && respuestas.length === 0) {
    if (canal.canal_comprometido) return terminar(); // no se pregunta por un canal comprometido
    return preguntar(preguntas[0]);
  }

  // Respuesta a la pregunta pendiente
  if (mensajeCliente !== undefined) {
    const pendiente = preguntas[respuestas.length];
    if (pendiente) {
      const senales_extra = new Set<SenalGuardian>();
      if (detectaIntentoAprobar(mensajeCliente)) senales_extra.add('intenta_aprobar_por_chat');

      let clasificacion: RespuestaClasificada | null = clasificarRapido(mensajeCliente);
      if (clasificacion === null) {
        try {
          const r = await deps.runAgent(
            'guardian',
            { pregunta: BANCO_PREGUNTAS[pendiente].texto, respuesta_cliente: mensajeCliente },
            GuardianLLM,
            { nivel: 'rapido', maxLlamadas: 2, timeoutMs: 8_000 },
          );
          clasificacion = r.salida.respuesta;
          r.salida.senales_extra.forEach((s) => senales_extra.add(s));
          uso = r.uso;
        } catch (err) {
          clasificacion = 'incierta'; // ante la duda se mantiene la pausa
          uso = (err as { uso?: typeof USO_CERO }).uso ?? USO_CERO;
        }
      }

      const extras = [...senales_extra];
      const ev = ctx.evidencia.registrar('guardian_respuesta', {
        pregunta: BANCO_PREGUNTAS[pendiente].texto,
        texto: mensajeCliente,
        id: pendiente,
        clasificacion,
        senales_extra: extras,
      });
      ids.push(ev.id);
      respuestas.push({ pregunta: pendiente, clasificacion, senales_extra: extras });
    }
  }

  if (debeParar(respuestas) || respuestas.length >= preguntas.length) return terminar();
  return preguntar(preguntas[respuestas.length]);
}
