/**
 * Progreso del jugador en este dispositivo: puntos totales, rango, estrellas
 * por minijuego y logros. Vive en localStorage (por apodo) y es solo una
 * comodidad: si no hay almacenamiento, el juego sigue igual en memoria.
 * El ranking del evento se calcula en el servidor (`/api/juego/arcade`).
 */

export type ModoArcade = "real_o_estafa" | "atrapa_la_mula" | "pausa_o_pasa" | "sigue_el_dinero";

export const MODOS_ARCADE: ModoArcade[] = ["real_o_estafa", "atrapa_la_mula", "pausa_o_pasa", "sigue_el_dinero"];

/** Puntaje para 1, 2 y 3 estrellas. */
const UMBRALES: Record<ModoArcade, [number, number, number]> = {
  real_o_estafa: [1200, 2800, 4500],
  atrapa_la_mula: [1200, 2800, 4800],
  pausa_o_pasa: [1000, 2400, 4000],
  sigue_el_dinero: [2500, 4500, 6000],
};

export function estrellas(modo: ModoArcade, puntaje: number): number {
  return UMBRALES[modo].filter((u) => puntaje >= u).length;
}

export function proximaEstrella(modo: ModoArcade, puntaje: number): number | null {
  return UMBRALES[modo].find((u) => puntaje < u) ?? null;
}

export const RANGOS = [
  { min: 0, nombre: "NOVATO" },
  { min: 2500, nombre: "ALERTA" },
  { min: 7000, nombre: "DETECTIVE" },
  { min: 14000, nombre: "GUARDIÁN" },
  { min: 25000, nombre: "LEYENDA" },
];

export function rango(total: number) {
  let i = 0;
  while (i + 1 < RANGOS.length && total >= RANGOS[i + 1].min) i++;
  const siguiente = RANGOS[i + 1] ?? null;
  return { nivel: i + 1, nombre: RANGOS[i].nombre, siguiente, k: siguiente ? (total - RANGOS[i].min) / (siguiente.min - RANGOS[i].min) : 1 };
}

export type IdLogro =
  | "primera"
  | "ojo_halcon"
  | "imparable"
  | "red_desarmada"
  | "sin_inocentes"
  | "cazamulas"
  | "guardian_perfecto"
  | "tres_estrellas"
  | "todoterreno"
  | "salvaste"
  | "hacker_etico"
  | "en_vivo"
  | "campeon";

export const LOGROS: Record<IdLogro, { titulo: string; sub: string; bonus: number }> = {
  primera: { titulo: "PRIMERA PARTIDA", sub: "Bienvenido", bonus: 100 },
  ojo_halcon: { titulo: "OJO DE HALCÓN", sub: "Cero caídas", bonus: 400 },
  imparable: { titulo: "IMPARABLE", sub: "Racha x10", bonus: 300 },
  red_desarmada: { titulo: "RED DESARMADA", sub: "3 mulas", bonus: 300 },
  sin_inocentes: { titulo: "SIN INOCENTES", sub: "0 inocentes", bonus: 200 },
  cazamulas: { titulo: "CAZAMULAS", sub: "15 mulas", bonus: 300 },
  guardian_perfecto: { titulo: "GUARDIÁN PERFECTO", sub: "0 errores", bonus: 400 },
  tres_estrellas: { titulo: "3 ESTRELLAS", sub: "Experto", bonus: 300 },
  todoterreno: { titulo: "TODOTERRENO", sub: "4 arcades", bonus: 500 },
  salvaste: { titulo: "A SALVO", sub: "Historia", bonus: 200 },
  hacker_etico: { titulo: "HACKER ÉTICO", sub: "Hueco hallado", bonus: 300 },
  en_vivo: { titulo: "EN VIVO", sub: "Jugaste en sala", bonus: 200 },
  campeon: { titulo: "CAMPEÓN EN VIVO", sub: "1° de la sala", bonus: 500 },
};

export type Progreso = {
  total: number;
  mejor: Partial<Record<ModoArcade, number>>;
  estrellas: Partial<Record<ModoArcade, number>>;
  logros: IdLogro[];
};

const clave = (alias: string) => `ter-progreso:${alias.toLowerCase()}`;

/**
 * `quien`: id del jugador (o el apodo si no hay id). `aliasViejo`: si este
 * jugador tenía progreso guardado por apodo (antes de los ids), se migra.
 */
export function cargarProgreso(quien: string, aliasViejo?: string): Progreso {
  const vacio: Progreso = { total: 0, mejor: {}, estrellas: {}, logros: [] };
  try {
    let crudo = window.localStorage.getItem(clave(quien));
    if (!crudo && aliasViejo && aliasViejo !== quien) {
      crudo = window.localStorage.getItem(clave(aliasViejo));
      if (crudo) window.localStorage.setItem(clave(quien), crudo);
    }
    if (!crudo) return vacio;
    const p = JSON.parse(crudo) as Partial<Progreso>;
    return {
      total: typeof p.total === "number" ? p.total : 0,
      mejor: p.mejor ?? {},
      estrellas: p.estrellas ?? {},
      logros: Array.isArray(p.logros) ? p.logros.filter((l): l is IdLogro => l in LOGROS) : [],
    };
  } catch {
    return vacio;
  }
}

export function guardarProgreso(alias: string, p: Progreso) {
  try {
    window.localStorage.setItem(clave(alias), JSON.stringify(p));
  } catch {
    // sin almacenamiento: queda en memoria
  }
}

/** Lo que pasó al sumar una partida: estrellas nuevas, logros y si subió de rango. */
export type Cosecha = {
  estrellas: number;
  estrellasNuevas: number;
  logros: IdLogro[];
  bonus: number;
  subioA: string | null;
  record: boolean;
};

/**
 * Suma una partida de arcade (o de historia, con `modo` null) al progreso.
 * `logrosPosibles` son los que el minijuego cree ganados; aquí se filtran los
 * que ya se tenían.
 */
export function sumarPartida(p: Progreso, modo: ModoArcade | null, puntaje: number, logrosPosibles: IdLogro[]): Cosecha {
  const antes = rango(p.total).nombre;
  const nuevos: IdLogro[] = [];
  const ganar = (id: IdLogro) => {
    if (!p.logros.includes(id) && !nuevos.includes(id)) nuevos.push(id);
  };
  ganar("primera");
  logrosPosibles.forEach(ganar);
  let est = 0;
  let estNuevas = 0;
  let record = false;
  if (modo) {
    est = estrellas(modo, puntaje);
    estNuevas = Math.max(0, est - (p.estrellas[modo] ?? 0));
    p.estrellas[modo] = Math.max(p.estrellas[modo] ?? 0, est);
    record = puntaje > (p.mejor[modo] ?? 0);
    p.mejor[modo] = Math.max(p.mejor[modo] ?? 0, puntaje);
    if (est === 3) ganar("tres_estrellas");
    if (MODOS_ARCADE.every((x) => p.mejor[x] !== undefined)) ganar("todoterreno");
  }
  const bonus = nuevos.reduce((s, id) => s + LOGROS[id].bonus, 0);
  p.total += puntaje + bonus;
  p.logros.push(...nuevos);
  const despues = rango(p.total).nombre;
  return { estrellas: est, estrellasNuevas: estNuevas, logros: nuevos, bonus, subioA: despues !== antes ? despues : null, record };
}
