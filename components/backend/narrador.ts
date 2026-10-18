import type { Caso, EventoTimeline } from "@/lib/contracts";
import type { ResultadoPrueba } from "@/lib/demo/suite";

/**
 * El narrador del panel `/demo`: convierte un caso REAL (timeline, evidencia,
 * salidas de los agentes) en las líneas de la terminal y en las notas que se
 * muestran como diálogo (pausan el flujo) o toast. Todo lo que dice sale del
 * caso; no hay textos de relleno con datos inventados.
 */

export type Detalle = Record<string, unknown>;

export type ClaveNota =
  | "reglas"
  | "pausa"
  | "memoria"
  | "red"
  | "plan"
  | "detective"
  | "chat"
  | "estado"
  | "silencio"
  | "expediente"
  | "error"
  | "decision"
  | "veredicto"
  | "matriz";

export interface Documento {
  id: string;
  titulo: string;
  hecho: string;
  /** La tool lo marcó como señal de riesgo. */
  marcado: boolean;
}

export interface Nota {
  clave: ClaveNota;
  /** Quién habla: el agente o la pieza del sistema. */
  quien: string;
  titulo: string;
  texto: string;
  /** Diálogo que pausa el flujo, o toast que no lo detiene. */
  modo: "dialogo" | "toast";
  /** Cuánto se queda abierto el diálogo a velocidad 1× (ms). */
  dura: number;
  docs?: Documento[];
  chat?: { cliente: string; canal: string; pregunta: string; respuesta: string | null };
  afirmaciones?: Array<{ texto: string; evidencia: string[] }>;
  decision?: { accion: string; regla: string; motivo: string };
  invariantes?: Array<{ texto: string; ok: boolean }>;
}

export interface Linea {
  t?: string;
  tag: string;
  texto: string;
  tipo: "cmd" | "evento" | "tool" | "decision" | "error" | "ok";
  /** Cuántos eventos del timeline quedan revelados cuando aparece esta línea. */
  ev: number;
  espera: number;
  nota?: Nota;
}

/** Pausas de la reproducción (ms, a velocidad 1×). */
export const PAUSA = { comando: 250, evento: 380, tool: 140, decision: 650, cierre: 350, lote: 140 };

/**
 * Qué se explica con diálogo en cada prueba: lo que esa prueba vino a mostrar.
 * Lo demás sale como toast, para no frenar diez veces lo mismo.
 */
const FOCO: Record<string, ClaveNota[]> = {
  rosa: ["pausa", "detective", "chat"],
  inyeccion: ["chat"],
  alerta: ["veredicto"],
  memoria: ["memoria"],
  red: ["red"],
  caida: ["error"],
  matriz: ["matriz"],
};

const DURA: Partial<Record<ClaveNota, number>> = { detective: 4500, chat: 4500, matriz: 3500 };

const SENAL: Record<string, string> = {
  beneficiario_nuevo: "beneficiario nuevo",
  monto_atipico: "monto atípico",
  llamada_activa: "llamada activa",
  dispositivo_nuevo: "celular nuevo",
  cambio_sim_o_clave: "cambio de SIM o clave",
  horario_atipico: "horario atípico",
  alerta_aml: "alerta AML",
};

export const ESTADO_CLIENTE: Record<string, string> = {
  manipulacion_probable: "manipulado",
  canal_comprometido: "canal comprometido",
  confirmado_seguro: "seguro",
  sin_respuesta: "sin respuesta",
};

const CLIENTE: Record<string, string> = { "C-ROSA": "Rosa", "C-JORGE": "Jorge", "C-LUCIA": "Lucía", "C-ANA": "Ana" };

const TOOL: Record<string, string> = {
  perfil_cuenta: "Perfil de la cuenta",
  listas_riesgo: "Listas de riesgo",
  fan_in: "Remitentes nuevos",
  reenvio_rapido: "Reenvío rápido",
  ciclos: "Ciclos de dinero",
  estructuracion: "Montos bajo el umbral",
  reenvio_transfronterizo: "Envíos al exterior",
  red_regional: "Red regional",
  guardian_pregunta: "Pregunta del Guardián",
  guardian_respuesta: "Respuesta del cliente",
};

const soles = (n: number) => `S/ ${n.toLocaleString("es-PE")}`;
const pct = (x: unknown) => `${Math.round(Number(x) * 100)}%`;
export const ms = (a: string, b: string) => Math.max(0, new Date(b).getTime() - new Date(a).getTime());
export const duracion = (t: number) => (t < 1000 ? `${t} ms` : `${(t / 1000).toFixed(1)} s`);
const senales = (v: unknown) => (Array.isArray(v) ? v.map((s) => SENAL[String(s)] ?? String(s)).join(" · ") : "");

/** Un dato de tool en una línea: `remitentes_nuevos=14 ventana_horas=48`. */
export function datoCorto(v: unknown): string {
  if (!v || typeof v !== "object") return String(v ?? "");
  return Object.entries(v as Detalle)
    .filter(([k]) => !["cuenta", "pregunta", "texto", "id"].includes(k))
    .map(([k, x]) => `${k}=${typeof x === "object" ? JSON.stringify(x) : String(x)}`)
    .join(" ")
    .slice(0, 110);
}

/** El hecho de una tool dicho como persona: «14 remitentes nuevos en 48 h». */
function hecho(fuente: string, d: Detalle): string {
  switch (fuente) {
    case "perfil_cuenta":
      return `${d.tipo} · ${d.antiguedad_dias} días de antigüedad${d.banco_propio === false ? " · de otro banco" : ""}`;
    case "listas_riesgo":
      return d.en_lista ? `en ${(d.listas as string[]).join(", ")}` : "no figura en listas";
    case "fan_in":
      return `${d.remitentes_nuevos} remitentes nuevos en ${d.ventana_horas} h`;
    case "reenvio_rapido":
      return d.observable === false ? "no observable (otro banco)" : `reenvió el ${pct(d.porcentaje_reenviado)} en ${d.ventana_horas} h`;
    case "ciclos":
      return d.ciclo ? "dinero que vuelve en círculo" : "sin ciclos";
    case "estructuracion":
      return `${d.operaciones_cercanas_umbral} operaciones justo bajo el umbral`;
    case "reenvio_transfronterizo":
      return `${pct(d.porcentaje_al_exterior)} enviado al exterior`;
    case "guardian_pregunta":
      return `pregunta por ${d.canal ?? "app"}`;
    case "guardian_respuesta":
      return `«${d.texto ?? ""}»`;
    case "red_regional":
      return d.en_red ? `confirmada por ${(d.emisor as { banco?: string })?.banco}` : "sin avisos de la red";
    default:
      return datoCorto(d);
  }
}

/** Una línea de log por evento. */
export function linea(e: EventoTimeline): string {
  const d = (e.detalle ?? {}) as Detalle;
  const l = (v: unknown) => (Array.isArray(v) ? v.join(", ") : "");
  switch (e.evento) {
    case "caso_creado":
      return String(d.puerta ?? "");
    case "nivel0_evaluado":
      return `score ${d.score} · ${l(d.senales) || "sin señales"}`;
    case "pausa_preventiva":
      return `dinero retenido antes de consultar a ningún agente (score ${d.score})`;
    case "plan":
      return `invoca ${l(d.invocar) || "—"}`;
    case "riesgo_destino":
      return `riesgo ${d.riesgo_destino} · ${l(d.tipologias)}`;
    case "pregunta":
    case "turno_pendiente":
      return `«${d.mensaje}»`;
    case "respuesta_guardian":
      return `«${d.texto || "(sin respuesta)"}»`;
    case "estado_usuario":
      return `${d.estado_usuario} · canal ${d.canal_usado ?? "—"}`;
    case "expediente":
      return `recomienda ${d.recomendacion} · ${d.afirmaciones} afirmaciones citadas`;
    case "mula_confirmada":
      return `${d.cuenta} ya confirmada por un analista`;
    case "mula_confirmada_en_red":
      return `${d.cuenta} confirmada por ${(d.emisor as { banco?: string } | undefined)?.banco ?? "otro banco"}`;
    case "decision":
    case "atajo_determinista":
      return `${d.accion} · ${d.regla}`;
    case "error_agentes":
      return `${d.agente}: ${d.mensaje}`;
    default: {
      const j = e.detalle === undefined ? "" : JSON.stringify(e.detalle);
      return j.length > 90 ? `${j.slice(0, 90)}…` : j;
    }
  }
}

/** La nota de un evento, con los datos del caso. `null`: el evento no se narra. */
function notaDe(e: EventoTimeline, caso: Caso, ya: Set<ClaveNota>): Omit<Nota, "modo" | "dura"> | null {
  const d = (e.detalle ?? {}) as Detalle;
  const destino = caso.transaccion.destino;
  const cliente = CLIENTE[caso.transaccion.origen] ?? caso.transaccion.origen;
  switch (e.evento) {
    case "nivel0_evaluado":
      return { clave: "reglas", quien: "Reglas", titulo: `Score de riesgo ${d.score}`, texto: `${senales(d.senales) || "sin señales"} · sin IA` };
    case "pausa_preventiva":
      return {
        clave: "pausa",
        quien: "Sistema",
        titulo: "Dinero retenido",
        texto: caso.puerta === "transferencia" ? `${soles(caso.transaccion.monto)} · antes de la IA` : `${destino} · antes de la IA`,
      };
    case "mula_confirmada":
      return {
        clave: "memoria",
        quien: "Memoria",
        titulo: "Mula ya conocida",
        texto: `${d.cuenta} · 0 llamadas de IA`,
      };
    case "mula_confirmada_en_red": {
      const em = (d.emisor ?? {}) as { banco?: string; pais?: string };
      return {
        clave: "red",
        quien: "Red regional",
        titulo: "Aviso de otro banco",
        texto: `${em.banco} (${String(em.pais ?? "").toUpperCase()}) ya la confirmó`,
      };
    }
    case "plan":
      return {
        clave: "plan",
        quien: "Coordinador",
        titulo: d.salida_temprana ? "Salida temprana" : `Convoca a ${(d.invocar as string[] | undefined)?.join(" y ") ?? "—"}`,
        texto: String(d.motivo ?? ""),
      };
    case "riesgo_destino": {
      const citas = Array.isArray(d.evidencia) ? (d.evidencia as string[]) : [];
      const docs = citas
        .map((id) => caso.evidencia.find((x) => x.id === id))
        .filter((x) => x !== undefined)
        .map((x) => ({ id: x.id, titulo: TOOL[x.fuente] ?? x.fuente, hecho: hecho(x.fuente, (x.dato ?? {}) as Detalle), marcado: (x.dato as Detalle)?.marcado === true }));
      return {
        clave: "detective",
        quien: "Detective",
        titulo: `Riesgo ${d.riesgo_destino} en ${destino}`,
        texto: "",
        // Solo lo que pesó: las evidencias marcadas como señal (o las primeras, si ninguna).
        docs: (docs.some((x) => x.marcado) ? docs.filter((x) => x.marcado) : docs).slice(0, 4),
      };
    }
    case "pregunta": {
      if (ya.has("chat")) return null;
      const p = caso.evidencia.find((x) => x.fuente === "guardian_pregunta")?.dato as Detalle | undefined;
      const resp =
        (caso.evidencia.find((x) => x.fuente === "guardian_respuesta")?.dato as Detalle | undefined)?.texto ??
        (caso.timeline.find((x) => x.evento === "respuesta_guardian")?.detalle as Detalle | undefined)?.texto;
      return {
        clave: "chat",
        quien: "Guardián",
        titulo: `Guardián → ${cliente}`,
        texto: "",
        chat: { cliente, canal: String(p?.canal ?? "app"), pregunta: String(d.mensaje ?? ""), respuesta: typeof resp === "string" && resp ? resp : null },
      };
    }
    case "turno_pendiente":
      return { clave: "silencio", quien: "Guardián", titulo: "Sin respuesta", texto: "El silencio no es aprobación: el dinero sigue retenido." };
    case "estado_usuario":
      return {
        clave: "estado",
        quien: "Guardián",
        titulo: `${cliente}: ${ESTADO_CLIENTE[String(d.estado_usuario)] ?? d.estado_usuario}`,
        texto: `canal ${d.canal_usado ?? "—"}${Array.isArray(d.senales_manipulacion) && d.senales_manipulacion.length ? ` · ${(d.senales_manipulacion as string[]).join(", ")}` : ""}`,
      };
    case "expediente": {
      const a = caso.salidas.auditor;
      return {
        clave: "expediente",
        quien: "Auditor",
        titulo: `Expediente: recomienda ${d.recomendacion}`,
        texto: "Cada afirmación cita la evidencia que la respalda. Sin cita, no entra.",
        afirmaciones: a?.afirmaciones.map((x) => ({ texto: x.texto, evidencia: x.evidencia })),
      };
    }
    case "error_agentes":
      if (ya.has("error")) return { clave: "estado", quien: "Sistema", titulo: `Falla: ${d.agente}`, texto: String(d.mensaje ?? "") };
      return {
        clave: "error",
        quien: "Sistema",
        titulo: `Se cayó el ${d.agente}`,
        texto: "Modo seguro: el dinero no sale",
      };
    case "decision":
      return {
        clave: "decision",
        quien: "Policy",
        titulo: "La Policy decide",
        texto: "La decide una regla fija, no el modelo: la IA investiga y opina; la Policy decide sobre el dinero.",
        decision: { accion: String(d.accion), regla: String(d.regla), motivo: String(d.motivo ?? "") },
      };
    default:
      return null;
  }
}

function conModo(n: Omit<Nota, "modo" | "dura">, prueba: string): Nota {
  const dialogo = (FOCO[prueba] ?? []).includes(n.clave);
  return { ...n, modo: dialogo ? "dialogo" : "toast", dura: DURA[n.clave] ?? 3200 };
}

/**
 * La terminal del caso: cada evento del timeline y, antes del agente que las
 * usó, las tools que corrió (con el id de evidencia que emitieron).
 */
export function terminal(r: ResultadoPrueba, caso: Caso): Linea[] {
  const t0 = caso.timeline[0]?.t ?? "";
  const usadas = new Set<string>();
  const ya = new Set<ClaveNota>();
  const cuenta = caso.transaccion.destino;
  const tools = (ids: string[], ev: number): Linea[] =>
    ids.flatMap((id) => {
      const e = caso.evidencia.find((x) => x.id === id);
      if (!e || usadas.has(id)) return [];
      usadas.add(id);
      return [{ tag: "tool", texto: `${e.fuente} → ${e.id}  ${hecho(e.fuente, (e.dato ?? {}) as Detalle)}`.slice(0, 80), tipo: "tool" as const, ev, espera: PAUSA.tool }];
    });
  const porFuente = (fuente: string) => caso.evidencia.filter((e) => e.fuente === fuente).map((e) => e.id);
  const citas = (d: Detalle) => (Array.isArray(d.evidencia) ? (d.evidencia as string[]) : []);

  const lineas: Linea[] = [
    {
      tag: "$",
      texto:
        caso.puerta === "alerta_aml"
          ? `POST /api/alerts  cuenta=${cuenta}`
          : `POST /api/transfers  ${caso.transaccion.origen} → ${cuenta}  ${soles(caso.transaccion.monto)}`,
      tipo: "cmd",
      ev: 0,
      espera: PAUSA.comando,
    },
  ];
  caso.timeline.forEach((e, i) => {
    const d = (e.detalle ?? {}) as Detalle;
    if (e.evento === "riesgo_destino" || e.evento === "estado_usuario") lineas.push(...tools(citas(d), i));
    if (e.evento === "pregunta") lineas.push(...tools(porFuente("guardian_pregunta"), i));
    if (e.evento === "expediente") lineas.push(...tools(caso.evidencia.map((x) => x.id), i));
    const tipo = e.evento === "decision" ? "decision" : e.evento === "error_agentes" ? "error" : "evento";
    const n = notaDe(e, caso, ya);
    if (n) ya.add(n.clave);
    lineas.push({
      t: `+${ms(t0, e.t)}ms`,
      tag: e.actor,
      texto: `${e.evento}  ${linea(e)}`.slice(0, 90),
      tipo,
      ev: i + 1,
      espera: tipo === "decision" ? PAUSA.decision : PAUSA.evento,
      ...(n ? { nota: conModo(n, r.id) } : {}),
    });
  });

  // En la alerta, después de la decisión, un analista confirma la mula (la suite lo hace de verdad).
  const humano = r.chequeos.find((c) => c.texto === "Un humano confirma");
  if (r.id === "alerta" && humano?.ok) {
    lineas.push({
      tag: "analista",
      texto: `confirma ${cuenta} como mula_confirmada · ${humano.valor ?? ""}`,
      tipo: "evento",
      ev: caso.timeline.length,
      espera: PAUSA.evento,
      nota: conModo(
        {
          clave: "veredicto",
          quien: "Analista",
          titulo: `Analista confirma ${cuenta}`,
          texto: "Desde ahora la Memoria la frena sin IA",
        },
        r.id,
      ),
    });
  }

  const ok = r.chequeos.filter((c) => c.ok).length;
  lineas.push({
    tag: r.ok ? "✓" : "✗",
    texto: `${ok}/${r.chequeos.length} chequeos · ${caso.ia.llamadas} llamadas de IA · ${duracion(r.ms)} en el servidor`,
    tipo: r.ok ? "ok" : "error",
    ev: caso.timeline.length,
    espera: PAUSA.cierre,
  });
  return lineas;
}

/** La terminal de la matriz: un lote de 50 ataques por línea. */
export function terminalMatriz(r: ResultadoPrueba): Linea[] {
  const m = r.matriz!;
  const porTactica = m.celdas.length / m.tacticas.length;
  const lotes = Math.ceil(m.celdas.length / 50);
  const lineas: Linea[] = [{ tag: "$", texto: `matriz  ${m.combinaciones} ataques · agentes ${r.agentes}`, tipo: "cmd", ev: 0, espera: PAUSA.comando }];
  for (let i = 0; i < lotes; i++) {
    const lote = m.celdas.slice(i * 50, i * 50 + 50);
    const cuenta = (a: string) => lote.filter((x) => x === a).length;
    lineas.push({
      tag: m.tacticas[Math.floor((i * 50) / porTactica)] ?? "",
      texto: `lote ${String(i + 1).padStart(2, "0")}/${lotes}  escalar=${cuenta("ESCALAR")} pausar=${cuenta("PAUSAR")} verificar=${cuenta("VERIFICAR")} permitir=${cuenta("PERMITIR")}`,
      tipo: "evento",
      ev: i + 1,
      espera: PAUSA.lote,
    });
  }
  const huecos = m.invariantes.reduce((n, v) => n + v.violaciones, 0);
  lineas.push({
    tag: huecos ? "✗" : "✓",
    texto: `${m.invariantes.length} invariantes · ${huecos} violaciones · ${duracion(r.ms)} en el servidor`,
    tipo: huecos ? "error" : "ok",
    ev: lotes,
    espera: PAUSA.cierre,
    nota: conModo(
      {
        clave: "matriz",
        quien: "Suite",
        titulo: `${m.combinaciones} ataques · ${huecos} huecos`,
        texto: "",
        invariantes: m.invariantes.map((v) => ({ texto: v.texto, ok: v.violaciones === 0 })),
      },
      r.id,
    ),
  });
  return lineas;
}

export const lineasDe = (r: ResultadoPrueba) => (r.matriz ? terminalMatriz(r) : r.casos[0] ? terminal(r, r.casos[0]) : []);
