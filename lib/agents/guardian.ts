import type { AgentResult, Caso, Evidencia, ToolContext, TurnoGuardian } from '@/lib/contracts';
import { DatoPreguntaGuardian, DatoRespuestaGuardian } from '@/lib/contracts';
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
import { USO_CERO, sumarUso, type DepsAgentes } from './util';

/** Cuánto esperar una respuesta encolada en el buzón (modo una-llamada). */
const ESPERA_MS = 1_000;

interface Conversacion {
  preguntadas: IdPregunta[];
  respuestas: Respuesta[];
  ids: string[];
}

/** Reconstruye la conversación desde la evidencia del caso (el agente no guarda estado). */
function leerConversacion(evidencia: Evidencia[]): Conversacion {
  const c: Conversacion = { preguntadas: [], respuestas: [], ids: [] };
  for (const e of evidencia) {
    if (e.fuente === 'guardian_pregunta') {
      const d = DatoPreguntaGuardian.safeParse(e.dato);
      if (d.success) c.preguntadas.push(d.data.id);
    } else if (e.fuente === 'guardian_respuesta') {
      const d = DatoRespuestaGuardian.safeParse(e.dato);
      if (!d.success || !d.data.id || !d.data.clasificacion) continue;
      c.respuestas.push({ pregunta: d.data.id, clasificacion: d.data.clasificacion, senales_extra: d.data.senales_extra });
      c.ids.push(e.id);
    }
  }
  return c;
}

/**
 * 🛡️ Guardián — guion cerrado; el LLM solo clasifica respuestas libres.
 *
 * Funciona en los dos modos del pipeline:
 *   - **Una llamada:** pregunta y toma la respuesta de `mensajeCliente` o, si no
 *     viene, de `ctx.mensajes.esperar` (buzón). Sigue hasta terminar.
 *   - **Varios turnos:** si no hay respuesta disponible, devuelve la pregunta
 *     pendiente (`terminado: false`); la siguiente llamada trae la respuesta.
 *
 * `mensajeCliente === ''` significa que el cliente no respondió a tiempo.
 * Cada pregunta y respuesta queda como evidencia: el estado vive en el caso.
 */
export async function guardianTurno(
  caso: Caso,
  ctx: ToolContext,
  deps: DepsAgentes,
  mensajeCliente?: string,
): Promise<AgentResult<TurnoGuardian>> {
  const usos = [USO_CERO];
  const conv = leerConversacion(caso.evidencia);
  const preguntas = seleccionarPreguntas(caso.nivel0.senales);

  const cliente = ctx.data?.clientePorCuenta?.(caso.transaccion.origen) ?? null;
  const clienteId = cliente?.id ?? caso.transaccion.origen;

  // Canales: nunca se verifica por un canal comprometido (FM3)
  let seguros: string[] = ['app'];
  let comprometido = false;
  let alcanzable = true;
  try {
    const { data } = await ctx.analytics.canales_seguros(clienteId);
    seguros = data.seguros;
    comprometido = data.comprometidos.length > 0 || data.seguros.length === 0;
  } catch {
    /* sin datos de canal: se asume la app */
  }
  try {
    const { data } = await ctx.analytics.disponibilidad(clienteId);
    alcanzable = data.alcanzable;
  } catch {
    /* sin datos: se asume alcanzable */
  }
  const canal = seguros[0] ?? 'ninguno';

  const terminar = (): AgentResult<TurnoGuardian> => ({
    salida: {
      terminado: true,
      salida: {
        estado_usuario: estadoFinal(conv.respuestas, { canalComprometido: comprometido }),
        senales_manipulacion: senalesDe(conv.respuestas),
        canal_usado: canal,
        evidencia: [...new Set(conv.ids)],
      },
    },
    uso: sumarUso(...usos),
  });

  if (!cliente && !ctx.data?.clientePorCuenta) {
    // Contexto sin datos de cliente (p. ej. tests): se sigue con el id de origen
  } else if (!cliente) {
    return {
      salida: {
        terminado: true,
        salida: { estado_usuario: 'no_consultado', senales_manipulacion: [], canal_usado: 'ninguno', evidencia: [] },
      },
      uso: USO_CERO,
    };
  }

  // G1 — canal comprometido: no se pregunta por ahí
  if (comprometido) return terminar();

  const registrarRespuesta = (id: IdPregunta, texto: string, clasificacion: RespuestaClasificada, extras: SenalGuardian[]) => {
    const ev = ctx.evidencia.registrar('guardian_respuesta', {
      pregunta: BANCO_PREGUNTAS[id].texto,
      texto,
      id,
      clasificacion,
      senales_extra: extras,
    });
    conv.ids.push(ev.id);
    conv.respuestas.push({ pregunta: id, clasificacion, senales_extra: extras });
  };

  // Cliente inalcanzable (sin señal, sin teléfono): no se espera; el silencio no es un sí
  if (!alcanzable && conv.respuestas.length === 0) {
    registrarRespuesta(preguntas[0], '', 'sin_respuesta', []);
    return terminar();
  }

  const preguntar = async (id: IdPregunta) => {
    await ctx.mensajes?.enviar(clienteId, BANCO_PREGUNTAS[id].texto);
    ctx.evidencia.registrar('guardian_pregunta', { id, pregunta: BANCO_PREGUNTAS[id].texto, canal });
    conv.preguntadas.push(id);
  };

  const clasificar = async (id: IdPregunta, texto: string) => {
    const extras = new Set<SenalGuardian>();
    if (detectaIntentoAprobar(texto)) extras.add('intenta_aprobar_por_chat');
    let clasificacion: RespuestaClasificada | null = clasificarRapido(texto);
    if (clasificacion === null) {
      try {
        const r = await deps.runAgent(
          'guardian',
          { pregunta: BANCO_PREGUNTAS[id].texto, respuesta_cliente: texto },
          GuardianLLM,
          { nivel: 'rapido', maxLlamadas: 2, timeoutMs: 8_000 },
        );
        clasificacion = r.salida.respuesta;
        r.salida.senales_extra.forEach((s) => extras.add(s));
        usos.push(r.uso);
      } catch (err) {
        clasificacion = 'incierta'; // ante la duda se mantiene la pausa
        usos.push((err as { uso?: typeof USO_CERO }).uso ?? USO_CERO);
      }
    }
    registrarRespuesta(id, texto, clasificacion, [...extras]);
  };

  let pendienteDeMensaje = mensajeCliente;
  while (!debeParar(conv.respuestas) && conv.respuestas.length < preguntas.length) {
    const id = preguntas[conv.respuestas.length];
    if (!conv.preguntadas.includes(id)) await preguntar(id);

    let texto: string | null;
    if (pendienteDeMensaje !== undefined) {
      texto = pendienteDeMensaje;
      pendienteDeMensaje = undefined;
    } else {
      texto = (await ctx.mensajes?.esperar(clienteId, ESPERA_MS)) ?? null;
    }

    // Sin respuesta disponible: se devuelve la pregunta y se espera el siguiente turno
    if (texto === null) {
      return { salida: { mensaje: BANCO_PREGUNTAS[id].texto, terminado: false }, uso: sumarUso(...usos) };
    }
    await clasificar(id, texto);
  }
  return terminar();
}
