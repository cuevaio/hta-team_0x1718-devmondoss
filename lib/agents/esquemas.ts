import { z } from 'zod';

/**
 * Esquemas de lo que el LLM devuelve de verdad: mucho más chicos que las
 * salidas finales de los agentes (lib/contracts/agentes.ts). El código arma la
 * salida final; el modelo solo rellena el hueco cerrado.
 *
 * Fuente: docs/context/tony_dev/AGENT_PLAYBOOKS.md
 */

const IdEvidencia = z.string().regex(/^E-\d{2,}$/);

// 🔍 Detective — solo se llama en riesgo base `medio`; no puede subir a `alto`.
export const DetectiveLLM = z.object({
  riesgo_destino: z.enum(['bajo', 'medio']),
  hipotesis: z.string().min(1).max(240),
  evidencia: z.array(IdEvidencia),
});
export type DetectiveLLM = z.infer<typeof DetectiveLLM>;

// 🛡️ Guardián — solo clasifica una respuesta libre.
export const SENALES_GUARDIAN = [
  'guiado_por_telefono',
  'urgencia',
  'cuenta_segura',
  'presion_tercero',
  'intenta_aprobar_por_chat',
] as const;
export type SenalGuardian = (typeof SENALES_GUARDIAN)[number];

export const GuardianLLM = z.object({
  respuesta: z.enum(['si', 'no', 'incierta']),
  senales_extra: z.array(z.enum(SENALES_GUARDIAN)),
});
export type GuardianLLM = z.infer<typeof GuardianLLM>;

// 📋 Auditor — elige índices y catálogos; no escribe afirmaciones.
export const HIPOTESIS_AUDITOR = [
  'estafa_vishing_mula',
  'suplantacion_ato',
  'mula_sin_cliente_afectado',
  'falso_positivo_comercio',
  'indeterminada',
] as const;
export type HipotesisAuditor = (typeof HIPOTESIS_AUDITOR)[number];

export const ACCIONES_AUDITOR = [
  'confirmar_mula',
  'preparar_borrador_ROS',
  'mantener_pausa',
  'liberar_tras_verificacion',
  'pedir_info_titular',
  'sin_accion',
] as const;
export type AccionAuditor = (typeof ACCIONES_AUDITOR)[number];

export const AuditorLLM = z.object({
  resumen: z.string().min(1).max(320),
  hipotesis: z.enum(HIPOTESIS_AUDITOR),
  recomendacion: z.enum(['descartar', 'escalar']),
  indices_afirmaciones: z.array(z.number().int().min(0)).max(6),
  acciones: z.array(z.enum(ACCIONES_AUDITOR)).max(3),
  confianza: z.enum(['baja', 'media', 'alta']),
});
export type AuditorLLM = z.infer<typeof AuditorLLM>;
