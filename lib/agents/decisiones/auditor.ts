import type {
  Afirmacion,
  Caso,
  Evidencia,
  FichaCompartible,
  RiesgoDestino,
  SalidaAuditor,
} from '@/lib/contracts';
import {
  DatoRespuestaGuardian,
  ResultadoCiclos,
  ResultadoEstructuracion,
  ResultadoFanIn,
  ResultadoListas,
  ResultadoPerfil,
  ResultadoRed,
  ResultadoReenvio,
  ResultadoTransfronterizo,
  validarCitasAuditor,
} from '@/lib/contracts';
import type { AccionAuditor, AuditorLLM, HipotesisAuditor } from '../esquemas';

/**
 * 📋 Auditor — las afirmaciones las arma el código; el LLM solo elige cuáles incluir.
 * Fuente: docs/context/tony_dev/AGENT_PLAYBOOKS.md §5
 */

export const TEXTO_HIPOTESIS: Record<HipotesisAuditor, string> = {
  estafa_vishing_mula: 'Estafa por ingeniería social (vishing) con destino en cuenta mula',
  suplantacion_ato: 'Suplantación / toma de control de la cuenta del titular',
  mula_sin_cliente_afectado: 'Cuenta de paso con patrón de mula, sin cliente afectado identificado',
  falso_positivo_comercio: 'Alto volumen legítimo, patrón compatible con comercio',
  indeterminada: 'No hay evidencia suficiente para una hipótesis',
};

export const TEXTO_ACCION: Record<AccionAuditor, string> = {
  confirmar_mula: 'Confirmar mula',
  preparar_borrador_ROS: 'Preparar borrador de ROS',
  mantener_pausa: 'Mantener la pausa hasta verificación',
  liberar_tras_verificacion: 'Liberar tras verificación por canal seguro',
  pedir_info_titular: 'Solicitar información adicional al titular',
  sin_accion: 'Sin acción adicional',
};

const MAX_AFIRMACIONES = 6;

/** Una plantilla por fuente de evidencia. Devuelve `null` si el dato no tiene la forma esperada. */
export function afirmacionDe(e: Evidencia): Afirmacion | null {
  const cita = [e.id];
  switch (e.fuente) {
    case 'fan_in': {
      const d = ResultadoFanIn.safeParse(e.dato);
      return d.success
        ? { texto: `La cuenta ${d.data.cuenta} recibió de ${d.data.remitentes_nuevos} remitentes nuevos en ${d.data.ventana_horas} h`, evidencia: cita }
        : null;
    }
    case 'reenvio_rapido': {
      const d = ResultadoReenvio.safeParse(e.dato);
      // Cuenta de otra entidad: un 0% no es un dato observado. Afirmar «reenvió
      // el 0%» citaría un E-xx válido sobre algo que nadie vio (19 §10).
      if (d.success && d.data.observable === false) {
        return { texto: `No se ven las salidas de la cuenta ${d.data.cuenta}: es de otra entidad`, evidencia: cita };
      }
      return d.success
        ? { texto: `Reenvió el ${Math.round(d.data.porcentaje_reenviado * 100)}% de lo recibido en menos de ${d.data.ventana_horas} h`, evidencia: cita }
        : null;
    }
    case 'estructuracion': {
      const d = ResultadoEstructuracion.safeParse(e.dato);
      return d.success
        ? { texto: `${d.data.operaciones_cercanas_umbral} operaciones entre el 90% y el 100% del umbral de reporte`, evidencia: cita }
        : null;
    }
    case 'ciclos': {
      const d = ResultadoCiclos.safeParse(e.dato);
      return d.success && d.data.ciclo
        ? { texto: `Se detectó un ciclo de fondos: ${d.data.ciclo.join(' → ')}`, evidencia: cita }
        : null;
    }
    case 'listas_riesgo': {
      const d = ResultadoListas.safeParse(e.dato);
      return d.success && d.data.en_lista
        ? { texto: `La cuenta figura en: ${d.data.listas.join(', ')}`, evidencia: cita }
        : null;
    }
    case 'reenvio_transfronterizo': {
      const d = ResultadoTransfronterizo.safeParse(e.dato);
      if (!d.success || d.data.observable === false || d.data.destinos.length === 0) return null;
      const paises = [...new Set(d.data.destinos.map((x) => x.pais.toUpperCase()))].join(', ');
      return {
        texto: `Envió el ${Math.round(d.data.porcentaje_al_exterior * 100)}% de lo recibido a cuentas de otro país (${paises}) en menos de ${d.data.ventana_horas} h`,
        evidencia: cita,
      };
    }
    case 'red_regional': {
      const d = ResultadoRed.safeParse(e.dato);
      return d.success && d.data.en_red && d.data.emisor
        ? {
            texto: `El banco ${d.data.emisor.banco} (${d.data.emisor.pais.toUpperCase()}) confirmó la cuenta ${d.data.cuenta} como mula el ${d.data.fecha} (expediente ${d.data.expediente})`,
            evidencia: cita,
          }
        : null;
    }
    case 'perfil_cuenta': {
      const d = ResultadoPerfil.safeParse(e.dato);
      if (!d.success) return null;
      const edad = d.data.antiguedad_dias === null ? 'sin historial' : `${d.data.antiguedad_dias} días de antigüedad`;
      return { texto: `Cuenta de tipo ${d.data.tipo} con ${edad}`, evidencia: cita };
    }
    case 'guardian_respuesta': {
      const d = DatoRespuestaGuardian.safeParse(e.dato);
      return d.success
        ? { texto: `La persona titular respondió «${d.data.texto}» a: ${d.data.pregunta}`, evidencia: cita }
        : null;
    }
    default:
      return null;
  }
}

/** Candidatas en el orden de la evidencia; las que no tienen plantilla se omiten. */
export function afirmacionesCandidatas(evidencia: Evidencia[]): Afirmacion[] {
  return evidencia.map(afirmacionDe).filter((a): a is Afirmacion => a !== null);
}

export interface ContextoAuditor {
  evidencia: Evidencia[];
  riesgoDetective?: RiesgoDestino;
  /** Estado del cliente según el Guardián, si participó. */
  estadoGuardian?: string;
  /**
   * El Guardián preguntó y el cliente todavía no responde. No es «sin
   * alertas»: el dinero está retenido esperando esa respuesta.
   */
  guardianPendiente?: boolean;
}

const CLIENTE_EN_RIESGO = ['canal_comprometido', 'manipulacion_probable', 'sin_respuesta'];

/** Números de un texto, sin separadores de miles: «S/ 4,800» → «4800», «91%» → «91». */
function cifrasDe(texto: string): string[] {
  return (texto.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,](?=\d{3}\b)/g, '').replace(/[.,]$/, ''));
}

/**
 * Cifras del resumen (texto libre del LLM) que NO aparecen en las afirmaciones
 * elegidas. Las afirmaciones las arma el código desde la evidencia; el resumen
 * no. Sin esta verificación, «el modelo nunca produce una cifra» era falso.
 */
export function cifrasSinRespaldo(resumen: string, afirmaciones: Afirmacion[]): string[] {
  const respaldadas = new Set(afirmaciones.flatMap((a) => cifrasDe(a.texto)));
  return [...new Set(cifrasDe(resumen))].filter((n) => !respaldadas.has(n));
}

export const RESUMEN_RETIRADO =
  'Resumen retirado: citaba cifras que no están en la evidencia. Revisar las afirmaciones adjuntas.';

/** Arma la `SalidaAuditor` con lo que eligió el LLM, aplicando las validaciones del playbook. */
export function ensamblarAuditor(
  llm: AuditorLLM,
  candidatas: Afirmacion[],
  ctx: ContextoAuditor,
): SalidaAuditor {
  const indices = [...new Set(llm.indices_afirmaciones)].filter((i) => i < candidatas.length);
  const afirmaciones = indices.slice(0, MAX_AFIRMACIONES).map((i) => candidatas[i]);

  let revision = false;
  if (afirmaciones.length === 0) revision = true;
  if (ctx.riesgoDetective === 'alto' && llm.recomendacion === 'descartar') revision = true;
  if (ctx.estadoGuardian && CLIENTE_EN_RIESGO.includes(ctx.estadoGuardian) && llm.recomendacion === 'descartar') {
    revision = true; // descartar con el cliente en riesgo es incoherente: que lo vea un humano
  }

  // Una cifra sin respaldo no se muestra al analista: se retira el resumen.
  const inventadas = cifrasSinRespaldo(llm.resumen, afirmaciones);
  if (inventadas.length > 0) revision = true;

  // Con la pregunta sin responder no se puede recomendar «descartar»: el caso
  // está retenido por P7 y un analista podría liberar lo que el sistema frenó.
  // Se corrige hacia el lado seguro (escalar, mantener la pausa) y se marca.
  let recomendacion = llm.recomendacion;
  let acciones = llm.acciones.map((a) => TEXTO_ACCION[a]);
  if (ctx.guardianPendiente && recomendacion === 'descartar') {
    recomendacion = 'escalar';
    acciones = [TEXTO_ACCION.mantener_pausa];
    revision = true;
  }

  const salida: SalidaAuditor = {
    resumen: inventadas.length > 0 ? RESUMEN_RETIRADO : llm.resumen,
    hipotesis: TEXTO_HIPOTESIS[llm.hipotesis],
    recomendacion,
    afirmaciones,
    acciones_sugeridas: acciones,
    confianza: llm.confianza,
    requiere_revision_manual: revision,
  };
  if (!validarCitasAuditor(salida, ctx.evidencia).valido) {
    salida.requiere_revision_manual = true;
  }
  return salida;
}

/** Fallback sin LLM: conservador y siempre marcado para revisión manual. */
export function auditorDeterministico(
  candidatas: Afirmacion[],
  riesgoDetective: RiesgoDestino | undefined,
): SalidaAuditor {
  const alto = riesgoDetective === 'alto';
  const recomendacion = riesgoDetective === 'bajo' ? 'descartar' : 'escalar';
  return {
    resumen: alto
      ? 'Se detectó un patrón de riesgo alto en la cuenta destino. Revisar la evidencia adjunta.'
      : 'Resumen automático no disponible; revisar la evidencia adjunta.',
    hipotesis: TEXTO_HIPOTESIS.indeterminada,
    recomendacion,
    afirmaciones: candidatas.slice(0, MAX_AFIRMACIONES),
    acciones_sugeridas: [alto ? TEXTO_ACCION.confirmar_mula : TEXTO_ACCION.mantener_pausa],
    confianza: 'baja',
    requiere_revision_manual: true,
  };
}

// ─────────────────────────────────────────────────────────────
// 🌎 Ficha compartible con la red regional
// ─────────────────────────────────────────────────────────────

/**
 * Fuentes que describen la CUENTA destino. Fuera quedan las del cliente
 * (`guardian_*`): la conversación con la víctima no sale del banco. También
 * queda fuera `red_regional`: reenviar el veredicto de otro banco como propio
 * sería eco, no evidencia.
 */
const FUENTES_COMPARTIBLES = new Set([
  'perfil_cuenta',
  'fan_in',
  'reenvio_rapido',
  'reenvio_transfronterizo',
  'estructuracion',
  'ciclos',
  'listas_riesgo',
]);

/**
 * Lo que este banco publica en la red al confirmar una mula: los hechos de la
 * cuenta con sus citas, sin nada del cliente. 0 llamadas de IA: las
 * afirmaciones salen de las mismas plantillas que el expediente.
 */
export function fichaCompartible(caso: Caso): FichaCompartible {
  const cuenta = caso.transaccion.destino;
  const deLaCuenta = caso.evidencia.filter(
    (e) => FUENTES_COMPARTIBLES.has(e.fuente) && (e.dato as { cuenta?: string } | null)?.cuenta === cuenta,
  );
  const tipologias = (caso.salidas.detective?.tipologias ?? []).filter((t) => t !== 'en_red');
  return {
    cuenta,
    tipologias,
    hipotesis: caso.salidas.detective?.hipotesis ?? null,
    afirmaciones: afirmacionesCandidatas(deLaCuenta).slice(0, MAX_AFIRMACIONES),
    basado_en_red: caso.evidencia.some((e) => e.fuente === 'red_regional'),
  };
}
