import { z } from 'zod';

/**
 * Contrato entre el bloque de Ale (analytics, reglas) y el de Tony (agentes).
 *
 * CONTRACT: Ale implementa estas funciones y emite estos ids; Tony las consume.
 * Fuente: docs/context/tony_dev/AGENT_PLAYBOOKS.md §6
 */

// ─────────────────────────────────────────────────────────────
// Señales del nivel 0 — `lib/rules/level0.ts` debe emitir EXACTAMENTE estos ids
// ─────────────────────────────────────────────────────────────

export const SENALES_NIVEL0 = [
  'beneficiario_nuevo',
  'monto_atipico',
  'dispositivo_nuevo',
  'cambio_sim_o_clave',
  'llamada_activa',
  'horario_atipico',
] as const;
export type SenalNivel0 = (typeof SENALES_NIVEL0)[number];

// ─────────────────────────────────────────────────────────────
// Umbrales de tipologías (19 §3). Configurables, pero con un solo origen.
// ─────────────────────────────────────────────────────────────

export const UMBRALES = {
  fan_in_remitentes_nuevos: 5,
  fan_in_ventana_horas: 48,
  reenvio_porcentaje: 0.7,
  reenvio_ventana_horas: 2,
  estructuracion_operaciones: 3,
  estructuracion_banda_min: 0.9,
  ciclo_profundidad_max: 3,
} as const;

// ─────────────────────────────────────────────────────────────
// Nombres de `fuente` de la evidencia
// ─────────────────────────────────────────────────────────────

export const FUENTES = [
  'perfil_cuenta',
  'fan_in',
  'reenvio_rapido',
  'estructuracion',
  'ciclos',
  'listas_riesgo',
  'guardian_respuesta',
  'canales',
] as const;
export type Fuente = (typeof FUENTES)[number];

// ─────────────────────────────────────────────────────────────
// Salida (`data`) de cada tool de analytics
// ─────────────────────────────────────────────────────────────

export const TipoCuenta = z.enum(['persona', 'comercio', 'desconocido']);
export type TipoCuenta = z.infer<typeof TipoCuenta>;

export const ResultadoPerfil = z.object({
  cuenta: z.string().min(1),
  /** false = cuenta de otro banco: el historial de reenvío no es visible (19 §10). */
  banco_propio: z.boolean(),
  antiguedad_dias: z.number().int().min(0).nullable(),
  tipo: TipoCuenta,
});
export type ResultadoPerfil = z.infer<typeof ResultadoPerfil>;

export const ResultadoFanIn = z.object({
  cuenta: z.string().min(1),
  remitentes_nuevos: z.number().int().min(0),
  ventana_horas: z.number().positive(),
  marcado: z.boolean(),
});
export type ResultadoFanIn = z.infer<typeof ResultadoFanIn>;

export const ResultadoReenvio = z.object({
  cuenta: z.string().min(1),
  /** 0..1, parte de lo recibido que salió dentro de la ventana. */
  porcentaje_reenviado: z.number().min(0).max(1),
  ventana_horas: z.number().positive(),
  destinos: z.array(z.string()),
  marcado: z.boolean(),
});
export type ResultadoReenvio = z.infer<typeof ResultadoReenvio>;

export const ResultadoEstructuracion = z.object({
  cuenta: z.string().min(1),
  operaciones_cercanas_umbral: z.number().int().min(0),
  marcado: z.boolean(),
});
export type ResultadoEstructuracion = z.infer<typeof ResultadoEstructuracion>;

export const ResultadoCiclos = z.object({
  cuenta: z.string().min(1),
  ciclo: z.array(z.string()).nullable(),
  marcado: z.boolean(),
});
export type ResultadoCiclos = z.infer<typeof ResultadoCiclos>;

export const ResultadoListas = z.object({
  cuenta: z.string().min(1),
  en_lista: z.boolean(),
  listas: z.array(z.string()),
});
export type ResultadoListas = z.infer<typeof ResultadoListas>;

/** Estado del canal con el cliente (analytics.canales). Lo usa el Guardián. */
export const ResultadoCanal = z.object({
  cliente: z.string().min(1),
  /** Dispositivo/SIM nuevo o señal de toma de control: no se verifica por este canal. */
  canal_comprometido: z.boolean(),
  canal_habitual: z.string().min(1),
  /** Canal alternativo confiable, si existe. */
  canal_seguro: z.string().min(1).nullable(),
});
export type ResultadoCanal = z.infer<typeof ResultadoCanal>;

/**
 * Respuesta del cliente al Guardián, registrada como evidencia
 * (`ctx.evidencia.registrar('guardian_respuesta', …)`). Los campos opcionales
 * permiten reconstruir el estado de la conversación desde `caso.evidencia`.
 */
export const DatoRespuestaGuardian = z.object({
  pregunta: z.string().min(1),
  texto: z.string(),
  id: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional(),
  clasificacion: z.enum(['si', 'no', 'incierta', 'sin_respuesta']).optional(),
  senales_extra: z
    .array(
      z.enum(['guiado_por_telefono', 'urgencia', 'cuenta_segura', 'presion_tercero', 'intenta_aprobar_por_chat']),
    )
    .optional(),
});
export type DatoRespuestaGuardian = z.infer<typeof DatoRespuestaGuardian>;

/**
 * Convención de `ctx.analytics`: la clave es el nombre de la fuente
 * (`perfil_cuenta`, `listas_riesgo`, `fan_in`, `reenvio_rapido`,
 * `estructuracion`, `ciclos`, `canales`) y el primer argumento es la cuenta
 * (o el cliente, para `canales`). Cada tool devuelve `{ data, evidencia }`.
 */
