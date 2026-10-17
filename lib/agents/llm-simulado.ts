import type { z } from 'zod';
import type { RunAgent, UsoAgente } from '@/lib/contracts';
import { AgentError } from './runtime';

/**
 * "LLM simulado": un runAgent determinista que responde con heurísticas sobre
 * el MISMO briefing que vería Claude. Se usa cuando no hay API key
 * (AGENTS_MOCK=1), así el sistema corre de punta a punta con los agentes
 * reales, las tools reales y los datos de Ale, sin gastar un token.
 *
 * Cuenta 1 llamada por invocación (tokens 0): el contador del demo muestra
 * cuántas llamadas haría el sistema con IA real.
 */

const USO: UsoAgente = { llamadas: 1, tokens: 0, ms: 0 };

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface BriefingDetective {
  tipo_cuenta?: string;
  antiguedad_dias?: number | null;
  hallazgos?: { reenvio?: { porcentaje?: number } };
  evidencia?: { id: string; fuente: string }[];
}

function detective(b: BriefingDetective) {
  const comercio = b.tipo_cuenta === 'comercio';
  const antigua = (b.antiguedad_dias ?? 0) >= 365;
  const sinReenvio = (b.hallazgos?.reenvio?.porcentaje ?? 0) < 0.3;
  const bajo = comercio && antigua && sinReenvio;
  return {
    riesgo_destino: bajo ? 'bajo' : 'medio',
    hipotesis: bajo
      ? 'Comercio antiguo con muchos pagadores y sin reenvío rápido: patrón compatible con actividad legítima'
      : 'Patrón parcial sin explicación en el perfil de la cuenta; se mantiene en observación',
    evidencia: (b.evidencia ?? []).filter((e) => ['perfil_cuenta', 'fan_in', 'reenvio_rapido'].includes(e.fuente)).map((e) => e.id),
  };
}

function guardian(b: { respuesta_cliente?: string }) {
  const t = norm(b.respuesta_cliente ?? '');
  const senales = new Set<string>();
  if (/llam|telefono|guia|asesor|me dijeron|me pidieron/.test(t)) senales.add('guiado_por_telefono');
  if (/urgent|rapido|peligro|bloque|ya mismo/.test(t)) senales.add('urgencia');
  if (/cuenta segura|cuenta nueva|otra cuenta/.test(t)) senales.add('cuenta_segura');
  if (/amenaz|familiar|policia|fiscal|secuestr/.test(t)) senales.add('presion_tercero');
  if (/aprueb|autoriz|soy yo|libera/.test(t)) senales.add('intenta_aprobar_por_chat');
  const niega = /^(no|nadie|nunca)\b|yo solo|nadie me/.test(t);
  const respuesta = senales.size > 0 && !niega ? 'si' : niega ? 'no' : /^(si|claro)\b/.test(t) ? 'si' : 'incierta';
  return { respuesta, senales_extra: niega ? [] : [...senales] };
}

interface BriefingAuditor {
  puerta?: string;
  afirmaciones?: { i: number }[];
  riesgo_detective?: string | null;
  estado_guardian?: string | null;
}

function auditor(b: BriefingAuditor) {
  const riesgo = b.riesgo_detective;
  const estado = b.estado_guardian;
  const hipotesis =
    estado === 'canal_comprometido'
      ? 'suplantacion_ato'
      : riesgo === 'alto' && estado === 'manipulacion_probable'
        ? 'estafa_vishing_mula'
        : riesgo === 'alto'
          ? 'mula_sin_cliente_afectado'
          : riesgo === 'bajo'
            ? 'falso_positivo_comercio'
            : 'indeterminada';
  const clienteEnRiesgo = estado === 'canal_comprometido' || estado === 'manipulacion_probable' || estado === 'sin_respuesta';
  const escalar = riesgo !== 'bajo' || clienteEnRiesgo;
  return {
    resumen: escalar
      ? 'Operación retenida: la evidencia muestra un patrón de riesgo que requiere revisión del analista.'
      : 'La cuenta destino no muestra patrones de riesgo; se recomienda descartar la alerta.',
    hipotesis,
    recomendacion: escalar ? 'escalar' : 'descartar',
    indices_afirmaciones: (b.afirmaciones ?? []).slice(0, 6).map((a) => a.i),
    acciones:
      riesgo === 'alto'
        ? ['confirmar_mula', 'preparar_borrador_ROS']
        : estado === 'canal_comprometido'
          ? ['mantener_pausa', 'pedir_info_titular']
          : escalar
            ? ['mantener_pausa']
            : ['sin_accion'],
    confianza: riesgo === 'alto' ? 'alta' : riesgo === 'medio' || clienteEnRiesgo ? 'media' : 'baja',
  };
}

export const runAgentSimulado: RunAgent = async <S extends z.ZodType>(
  nombre: Parameters<RunAgent>[0],
  input: unknown,
  schema: S,
) => {
  const b = (input ?? {}) as Record<string, unknown>;
  const crudo =
    nombre === 'detective' ? detective(b) : nombre === 'guardian' ? guardian(b) : nombre === 'auditor' ? auditor(b) : null;
  const parsed = schema.safeParse(crudo);
  if (!parsed.success) throw new AgentError(`${nombre}: el LLM simulado no tiene respuesta`, USO);
  return { salida: parsed.data as z.infer<S>, uso: USO };
};
