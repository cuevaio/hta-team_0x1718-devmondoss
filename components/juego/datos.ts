import type { Caso, DecisionAccion, ReglaPolicy } from "@/lib/contracts";
import { PUNTAJES } from "@/lib/rules/level0";

/**
 * Datos y traducciones del demo jugable (docs/DEMO_JUEGO.md).
 *
 * Todo lo que el jugador lee sale de aquí: el lenguaje humano nunca muestra
 * `P4`, `score 7` ni `E-07` (§7). Funciones puras, testeadas en
 * tests/juego/datos.test.ts.
 */

export type ContextoJugada = {
  dispositivo_nuevo_24h?: boolean;
  cambio_sim_o_clave_72h?: boolean;
  llamada_activa_o_acceso_remoto?: boolean;
  horario_atipico?: boolean;
};

// ── Atacante (§4) ─────────────────────────────────────────────

export type TacticaId =
  | "falso_banco"
  | "link_falso"
  | "falso_familiar"
  | "app_falsa"
  | "duplicado_chip";

export type Tactica = {
  id: TacticaId;
  icono: string;
  nombre: string;
  gancho: string;
  /** Qué tan común es, con su fuente (§2). */
  comun: string;
  dificil?: boolean;
  /** Señales que el canal del banco reportaría. */
  contexto: ContextoJugada;
};

export const TACTICAS: Tactica[] = [
  {
    id: "falso_banco",
    icono: "📞",
    nombre: "Falso banco",
    gancho: "Llamas fingiendo ser el área de seguridad del banco.",
    comun: "Muy común en Perú · SBS y ASBANC",
    contexto: { llamada_activa_o_acceso_remoto: true },
  },
  {
    id: "link_falso",
    icono: "🔗",
    nombre: "Link falso por SMS",
    gancho: "Un mensaje con un enlace falso te da su clave y entras desde otro celular.",
    comun: "Muy común en Perú · SBS",
    contexto: { dispositivo_nuevo_24h: true },
  },
  {
    id: "falso_familiar",
    icono: "💬",
    nombre: "Falso familiar",
    gancho: "«Cambié de número, necesito plata urgente».",
    comun: "Común · advertencia de la Fiscalía",
    contexto: {},
  },
  {
    id: "app_falsa",
    icono: "📲",
    nombre: "App falsa",
    gancho: "Una app falsa controla su celular a distancia.",
    comun: "En alza en LATAM · BioCatch",
    contexto: { llamada_activa_o_acceso_remoto: true },
  },
  {
    id: "duplicado_chip",
    icono: "🔁",
    nombre: "Duplicado de chip",
    gancho: "Consigues un duplicado de su chip y recibes sus códigos.",
    comun: "Difícil hoy · Osiptel exige 4 h y biometría",
    dificil: true,
    contexto: { cambio_sim_o_clave_72h: true, dispositivo_nuevo_24h: true },
  },
];

export type VictimaId = "rosa" | "jorge" | "lucia";

export const VICTIMAS: Array<{
  id: VictimaId;
  cuenta: string;
  nombre: string;
  situacion: string;
}> = [
  { id: "rosa", cuenta: "C-ROSA", nombre: "Rosa", situacion: "Atiende su bodega en hora punta" },
  { id: "jorge", cuenta: "C-JORGE", nombre: "Jorge", situacion: "Usa la app del banco a diario" },
  { id: "lucia", cuenta: "C-LUCIA", nombre: "Lucía", situacion: "Está de viaje y sin señal" },
];

export const DESTINOS: Array<{ id: string; nombre: string; detalle: string }> = [
  { id: "M-01", nombre: "Cuenta alquilada #1", detalle: "La banda ya la usó antes" },
  { id: "M-02", nombre: "Cuenta alquilada #2", detalle: "Recién conseguida" },
  { id: "M-03", nombre: "Cuenta alquilada #3", detalle: "Recién conseguida" },
];

export const MONTOS: Array<{ id: "todo" | "chico"; monto: number; nombre: string }> = [
  { id: "todo", monto: 4800, nombre: "Todo de una" },
  { id: "chico", monto: 300, nombre: "Un monto chico" },
];

export const MAX_INTENTOS = 5;

export type Jugada = {
  victima: VictimaId;
  tactica: TacticaId;
  destino: string;
  monto: number;
  madrugada: boolean;
};

/** Cuerpo de `POST /api/transfers` para una jugada del atacante. */
export function armarTransferencia(jugada: Jugada, alias: string) {
  const victima = VICTIMAS.find((v) => v.id === jugada.victima);
  const tactica = TACTICAS.find((t) => t.id === jugada.tactica);
  if (!victima || !tactica) throw new Error("jugada inválida");
  const contexto: ContextoJugada = { ...tactica.contexto };
  if (jugada.madrugada) contexto.horario_atipico = true;
  return {
    transaccion: {
      origen: victima.cuenta,
      destino: jugada.destino,
      monto: jugada.monto,
      moneda: "PEN" as const,
    },
    contexto,
    alias,
  };
}

// ── Víctima (§3) ──────────────────────────────────────────────

/** La transferencia que la llamada le pide a Rosa. */
export const ESTAFA_ROSA = { origen: "C-ROSA", destino: "M-01", monto: 4800 };
/** El pago legítimo a su proveedor de siempre (CU-05 / P2). */
export const PAGO_PROVEEDOR = { origen: "C-ROSA", destino: "B-PEPE", monto: 380 };

export const SEGUNDOS_LLAMADA = 45;

export const RESPUESTAS_GUARDIAN: Array<{ id: string; texto: string; etiqueta: string }> = [
  { id: "si", texto: "sí", etiqueta: "Sí, alguien me está guiando" },
  { id: "no", texto: "no, lo hago yo", etiqueta: "No, lo hago yo" },
  { id: "silencio", texto: "", etiqueta: "No respondo" },
];

export const FRUSTRACION = ["😌", "🙂", "😐", "😟", "😫"] as const;

// ── Traducciones ──────────────────────────────────────────────

export const SENALES: Record<string, string> = {
  beneficiario_nuevo: "Beneficiario nuevo",
  monto_atipico: "Monto fuera de lo normal",
  dispositivo_nuevo: "Celular nuevo",
  cambio_sim_o_clave: "Cambio de chip o clave",
  llamada_activa: "Llamada o control remoto activo (simulado)",
  horario_atipico: "Horario poco habitual",
  alerta_aml: "Alerta del monitoreo AML",
};

export function puntosDe(senal: string): number | null {
  return senal in PUNTAJES ? PUNTAJES[senal as keyof typeof PUNTAJES] : null;
}

export const retiene = (accion: DecisionAccion) => accion !== "PERMITIR";

const EXPLICACIONES: Record<ReglaPolicy, { titulo: string; detalle: string }> = {
  P1: {
    titulo: "Frenado al instante por la Memoria",
    detalle:
      "Un analista ya confirmó esta cuenta como mula. Nadie tuvo que investigar: 0 llamadas de IA.",
  },
  P2: {
    titulo: "Pasó: es un destino de siempre",
    detalle: "El cliente ya le paga a esta cuenta y no hubo señales de riesgo.",
  },
  P3: {
    titulo: "Pasó sin investigar",
    detalle: "Hubo muy pocas señales de riesgo y el sistema no gastó IA en esta operación.",
  },
  P4: {
    titulo: "Retenido y escalado",
    detalle:
      "El Detective vio que la cuenta destino es de alto riesgo y el Guardián detectó que el cliente estaba siendo guiado o no pudo responder.",
  },
  P5: {
    titulo: "Retenido y escalado",
    detalle:
      "El Detective vio que la cuenta destino es de alto riesgo. El dinero se retiene aunque nadie confirme nada.",
  },
  P6: {
    titulo: "Retenido para verificar",
    detalle: "El Guardián detectó una posible manipulación: se verifica por otro canal antes de liberar.",
  },
  P7: {
    titulo: "Pausado hasta verificar",
    detalle:
      "El titular no pudo verificar por un canal seguro. El silencio no libera el dinero.",
  },
  P8: {
    titulo: "Pasó",
    detalle:
      "La cuenta destino no mostró un patrón de mula y no hubo señales de alerta del cliente.",
  },
  P9: {
    titulo: "Pausa corta",
    detalle: "La cuenta destino tiene un riesgo medio: espera breve antes de liberar.",
  },
  P10: {
    titulo: "Revisión humana",
    detalle: "Un agente no respondió a tiempo. Ante la duda, el sistema retiene.",
  },
};

export function explicar(regla: ReglaPolicy) {
  return EXPLICACIONES[regla];
}

export const NOMBRES_ACTOR: Record<string, string> = {
  reglas: "Reglas (sin IA)",
  memoria: "🧠 Memoria",
  coordinador: "🧭 Coordinador",
  guardian: "🛡️ Guardián",
  detective: "🔍 Detective",
  auditor: "📋 Auditor",
  policy: "⚖️ Policy",
};

/** Quién actuó en el caso, en el orden real del timeline. */
export function actoresDe(caso: Caso): string[] {
  const vistos: string[] = [];
  for (const e of caso.timeline) {
    if (e.actor in NOMBRES_ACTOR && !vistos.includes(e.actor)) vistos.push(e.actor);
  }
  return vistos;
}

export const huboPausaPreventiva = (caso: Caso) =>
  caso.timeline.some((e) => e.evento === "pausa_preventiva");

/** Última pregunta del Guardián todavía sin cerrar, o `null`. */
export function preguntaPendiente(caso: Caso): string | null {
  if (caso.salidas.guardian) return null;
  for (let i = caso.timeline.length - 1; i >= 0; i--) {
    const e = caso.timeline[i];
    if (e.evento === "pregunta" || e.evento === "turno_pendiente") {
      const detalle = e.detalle as { mensaje?: unknown } | undefined;
      return typeof detalle?.mensaje === "string" ? detalle.mensaje : null;
    }
  }
  return null;
}

export const soles = (n: number) =>
  `S/ ${n.toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
