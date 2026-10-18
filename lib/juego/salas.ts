import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Caso, ReglaPolicy } from '@/lib/contracts';
import { Alias } from './alias';
import { PAISES_JUEGO } from './arcade';
import { CARTAS, type JuegoSala, type VerdadCarta } from './cartas';
import {
  claveGolpe,
  Golpe,
  MONTO_DE,
  transferenciaDeGolpe,
  type TacticaId,
  type VictimaId,
} from './golpes';

/**
 * Salas EN VIVO (multijugador, estilo concurso): alguien crea una sala con un
 * código de 4 letras, los demás entran desde su celular y todos responden la
 * misma carta al mismo tiempo. El reloj es del servidor: las rondas avanzan
 * solas, así que basta con que cada celular consulte el estado.
 *
 * Hay dos clases de sala:
 *
 *  - **Cartas** (`real_o_estafa`, `pausa_o_pasa`): 8 rondas, la misma carta
 *    para todos, gana el más rápido en acertar.
 *  - **LA BANDA** (`banda`): una sola fase de ataque. Cada jugador arma golpes
 *    desde el catálogo de `golpes.ts` y el servidor los pasa por el **pipeline
 *    real** (`evaluarTransferencia`). Frenar un golpe da pocos puntos; pasar
 *    la capa («hueco») da muchos, porque encontrar huecos es el objetivo.
 *    Los intentos son casos de verdad: salen en el monitor del evento.
 *
 * Las salas viven en la RAM del proceso (como los casos): son efímeras y se
 * limpian solas a las 2 h. Lo que vale como dato (las respuestas) lo registra
 * cada jugador al final en `/api/juego/arcade` con `origen: 'sala'`.
 *
 * Dueño: Tony_dev (demo jugable); el modo `banda`, Ale_dev.
 */

export const RONDAS = 8;
export const CUENTA_MS = 3_000;
export const RESPONDER_MS = 10_000;
export const REVELAR_MS = 4_500;
/** LA BANDA: cuánto dura la fase de ataque (una sola, todos a la vez). */
export const ATAQUE_MS = 150_000;
/** Golpes que puede lanzar cada jugador en una sala. */
export const MAX_GOLPES = 10;
/** Espera mínima entre golpes de un mismo jugador (el pipeline es real). */
export const ESPERA_GOLPE_MS = 2_000;
/** Puntos: frenar enseña, pero el premio es encontrar un hueco. */
export const PUNTOS_FRENADO = 100;
export const PUNTOS_HUECO = 1_000;
/** Primer hueco de la sala con esa táctica: el descubrimiento vale más. */
export const PUNTOS_DESCUBRIMIENTO = 500;
/** Cuántos golpes recientes de la sala se devuelven (feed y proyector). */
const ULTIMOS_GOLPES = 8;
const VIDA_MS = 2 * 60 * 60 * 1000;
/** Una sala que nunca empezó deja de mostrarse en el monitor a los 15 min. */
const ESPERA_VISIBLE_MS = 15 * 60 * 1000;
const MAX_JUGADORES = 150;
/** Sin I ni O: se confunden con 1 y 0 al dictar el código. */
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export const JUEGOS_VIVOS = ['real_o_estafa', 'pausa_o_pasa', 'banda'] as const;
export type JuegoVivo = (typeof JUEGOS_VIVOS)[number];
export const JuegoSalaZ = z.enum(JUEGOS_VIVOS);
const Pais = z.enum(PAISES_JUEGO);
const Codigo = z.string().trim().toUpperCase().regex(/^[A-Z]{4}$/);

/** ¿Es una sala de cartas (y no LA BANDA)? */
const esCartas = (j: JuegoVivo): j is JuegoSala => j !== 'banda';

export const CrearSala = z.object({ alias: Alias, pais: Pais, juego: JuegoSalaZ });

export const AccionSala = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('unirse'), alias: Alias, pais: Pais }),
  z.object({ accion: z.literal('iniciar'), token: z.string().min(8) }),
  z.object({ accion: z.literal('reiniciar'), token: z.string().min(8) }),
  z.object({
    accion: z.literal('responder'),
    alias: Alias,
    ronda: z.number().int().min(0).max(RONDAS - 1),
    dijo_estafa: z.boolean(),
  }),
  z.object({ accion: z.literal('golpe'), alias: Alias, golpe: Golpe }),
]);
export type AccionSala = z.infer<typeof AccionSala>;
export { Codigo as CodigoSala };

type Respuesta = { dijo_estafa: boolean; ms: number; correcto: boolean; puntos: number };

/** Un golpe ya evaluado por el pipeline real. */
export type GolpeRegistrado = {
  caso: string;
  alias: string;
  victima: VictimaId;
  tactica: TacticaId;
  destino: string;
  monto: number;
  madrugada: boolean;
  /** `false` = hueco: el dinero habría salido. */
  frenado: boolean;
  regla: ReglaPolicy;
  accion: string;
  /** Llamadas al modelo que costó frenarlo (0 = lo frenaron las reglas). */
  llamadas_ia: number;
  puntos: number;
  descubrimiento: boolean;
  t: number;
  /**
   * Orden dentro de la sala (1, 2, 3…). El feed se ordena por esto y no por
   * `t`: dos golpes del mismo milisegundo quedarían empatados y el proyector
   * mostraría un orden al azar.
   */
  orden: number;
};

type Jugador = {
  alias: string;
  pais: string;
  puntaje: number;
  respuestas: Map<number, Respuesta>;
  racha: number;
  golpes: GolpeRegistrado[];
  /** Golpes ya probados (no se repiten: hay que cambiar algo). */
  claves: Set<string>;
  ultimoGolpe: number;
};

type Sala = {
  codigo: string;
  juego: JuegoVivo;
  host: string;
  /** Llave del anfitrión en `jugadores`. */
  hostId: string;
  token: string;
  creada: number;
  inicio: number | null;
  cartas: VerdadCarta[];
  jugadores: Map<string, Jugador>;
  /** Tácticas con las que la sala ya encontró un hueco (el primero vale más). */
  tacticasConHueco: Set<TacticaId>;
  /** Contador de golpes de la sala: da el orden del feed. */
  secuencia: number;
};

export type Fase = 'espera' | 'cuenta' | 'responder' | 'revelar' | 'ataque' | 'fin';

/** Lo que ve la sala (y el proyector) de LA BANDA. `null` en salas de cartas. */
export type VistaBanda = {
  golpes: number;
  frenados: number;
  huecos: number;
  /** Los últimos golpes de la sala, el más nuevo primero. */
  ultimos: GolpeRegistrado[];
  por_tactica: Array<{ tactica: TacticaId; intentos: number; huecos: number }>;
};

export type VistaSala = {
  codigo: string;
  juego: JuegoVivo;
  host: string;
  fase: Fase;
  ronda: number;
  rondas: number;
  /** Milisegundos que le quedan a la fase actual (null en espera y fin). */
  restante_ms: number | null;
  ahora: number;
  carta: string | null;
  /** Solo al revelar: la verdad y cómo respondió la sala. */
  verdad: boolean | null;
  reparto: { estafa: number; real: number; sin_responder: number } | null;
  respondieron: number;
  jugadores: Array<{ alias: string; pais: string; puntaje: number }>;
  /** Solo en LA BANDA. */
  banda: VistaBanda | null;
  /** Lo del jugador que consulta (si mandó `alias`). */
  mio: {
    /** Su apodo en la sala (puede ser ANA2 si ya había otra ANA). */
    alias: string;
    puntaje: number;
    posicion: number;
    respondio: boolean;
    ultima: Respuesta | null;
    /** Solo en LA BANDA: sus golpes y cuántos le quedan. */
    banda: { golpes: number; huecos: number; restantes: number; mios: GolpeRegistrado[] } | null;
  } | null;
};

export type ErrorSala = { error: string; status: 400 | 403 | 404 | 409 | 429 | 503 };

/** Lo que devuelve un golpe: el caso real, para que el celular lo anime. */
export type ResultadoGolpe = { vista: VistaSala; golpe: GolpeRegistrado; caso: Caso };

/** El pipeline, inyectado: así las salas se prueban sin levantar los agentes. */
export type Evaluador = (entrada: ReturnType<typeof transferenciaDeGolpe>) => Promise<Caso>;

const clave = (alias: string) => alias.trim().toLowerCase();

/**
 * Llave de un jugador en la sala: su id de celular (cookie, lib/juego/jugador.ts).
 * Sin id (clientes viejos, tests), su apodo. Así dos «ANA» son dos jugadores.
 */
const llave = (jugador: string | undefined, alias: string) => jugador ?? `alias:${clave(alias)}`;

/** `vista()` acepta un id, una llave ya armada o un apodo suelto. */
const normalizar = (quien: string) => (/^J-/.test(quien) || quien.startsWith('alias:') ? quien : `alias:${clave(quien)}`);

/** Apodo que no se repita dentro de la sala: la segunda ANA es ANA2. */
function apodoLibre(sala: { jugadores: Map<string, { alias: string }> }, alias: string, id: string): string {
  const ocupado = (a: string) => [...sala.jugadores.entries()].some(([k, j]) => k !== id && clave(j.alias) === clave(a));
  if (!ocupado(alias)) return alias;
  for (let n = 2; n < 100; n++) {
    const otro = `${alias.slice(0, 22)}${n}`;
    if (!ocupado(otro)) return otro;
  }
  return `${alias.slice(0, 20)}${Math.floor(Math.random() * 9000) + 1000}`;
}

function nuevoJugador(alias: string, pais: string): Jugador {
  return {
    alias,
    pais,
    puntaje: 0,
    respuestas: new Map(),
    racha: 0,
    golpes: [],
    claves: new Set(),
    ultimoGolpe: 0,
  };
}

function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 8 cartas con al menos 3 de cada lado (estafa y real) para que haya duda. */
function repartir(juego: JuegoVivo): VerdadCarta[] {
  if (!esCartas(juego)) return []; // LA BANDA no usa cartas: los golpes los arma el jugador
  const todas = CARTAS[juego];
  const si = barajar(todas.filter((c) => c.estafa));
  const no = barajar(todas.filter((c) => !c.estafa));
  return barajar([...si.slice(0, 5), ...no.slice(0, RONDAS - 5)]);
}

/**
 * Resumen de LA BANDA: lo que se proyecta y lo que ve cada celular. Se calcula
 * de los golpes de todos, así que no hay un contador que pueda desincronizarse.
 */
function vistaBanda(sala: Sala): VistaBanda {
  const todos = [...sala.jugadores.values()].flatMap((j) => j.golpes).sort((a, b) => b.orden - a.orden);
  const porTactica = new Map<TacticaId, { tactica: TacticaId; intentos: number; huecos: number }>();
  for (const g of todos) {
    const fila = porTactica.get(g.tactica) ?? { tactica: g.tactica, intentos: 0, huecos: 0 };
    fila.intentos++;
    if (!g.frenado) fila.huecos++;
    porTactica.set(g.tactica, fila);
  }
  return {
    golpes: todos.length,
    frenados: todos.filter((g) => g.frenado).length,
    huecos: todos.filter((g) => !g.frenado).length,
    ultimos: todos.slice(0, ULTIMOS_GOLPES),
    por_tactica: [...porTactica.values()].sort((a, b) => b.intentos - a.intentos),
  };
}

export class Salas {
  private salas = new Map<string, Sala>();

  /**
   * El reloj se envuelve (`() => Date.now()`) en vez de pasar `Date.now`: así
   * un test que finge el reloj del sistema también mueve el de las salas.
   */
  constructor(private readonly reloj: () => number = () => Date.now()) {}

  crear(alias: string, pais: string, juego: JuegoVivo, jugador?: string): { codigo: string; token: string } {
    this.limpiarViejas();
    let codigo = '';
    do {
      codigo = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
    } while (this.salas.has(codigo));
    const token = randomBytes(12).toString('hex');
    const sala: Sala = {
      codigo,
      juego,
      host: alias,
      hostId: llave(jugador, alias),
      token,
      creada: this.reloj(),
      inicio: null,
      cartas: repartir(juego),
      jugadores: new Map(),
      tacticasConHueco: new Set(),
      secuencia: 0,
    };
    sala.jugadores.set(sala.hostId, nuevoJugador(alias, pais));
    this.salas.set(codigo, sala);
    return { codigo, token };
  }

  accion(codigo: string, a: AccionSala, jugador?: string): VistaSala | ErrorSala {
    const sala = this.salas.get(codigo);
    if (!sala) return { error: 'sala no encontrada', status: 404 };
    const ahora = this.reloj();
    const f = this.fase(sala, ahora);
    if (a.accion === 'unirse') {
      const id = llave(jugador, a.alias);
      if (!sala.jugadores.has(id)) {
        if (sala.jugadores.size >= MAX_JUGADORES) return { error: 'la sala está llena', status: 409 };
        sala.jugadores.set(id, nuevoJugador(apodoLibre(sala, a.alias, id), a.pais));
      }
      return this.vista(codigo, id)!;
    }
    if (a.accion === 'iniciar' || a.accion === 'reiniciar') {
      if (a.token !== sala.token) return { error: 'solo quien creó la sala puede hacer eso', status: 403 };
      if (a.accion === 'iniciar' && f.fase !== 'espera') return { error: 'la sala ya empezó', status: 409 };
      if (a.accion === 'reiniciar') {
        sala.cartas = repartir(sala.juego);
        sala.tacticasConHueco.clear();
        sala.secuencia = 0;
        for (const j of sala.jugadores.values()) {
          j.puntaje = 0;
          j.racha = 0;
          j.respuestas.clear();
          j.golpes = [];
          j.claves.clear();
          j.ultimoGolpe = 0;
        }
        sala.inicio = null;
        return this.vista(codigo, sala.hostId)!;
      }
      sala.inicio = ahora;
      return this.vista(codigo, sala.hostId)!;
    }
    // Un golpe necesita el pipeline: lo atiende `golpe()`, que es asíncrono.
    if (a.accion === 'golpe') return { error: 'un golpe se manda al evaluador de la sala', status: 400 };
    if (!esCartas(sala.juego)) return { error: 'en esta sala no se responden cartas: se lanzan golpes', status: 409 };
    // responder
    const id = llave(jugador, a.alias);
    const j = sala.jugadores.get(id);
    if (!j) return { error: 'primero únete a la sala', status: 403 };
    if (f.fase !== 'responder' || f.ronda !== a.ronda) return { error: 'esa ronda ya cerró', status: 409 };
    if (j.respuestas.has(a.ronda)) return { error: 'ya respondiste esta ronda', status: 409 };
    const ms = RESPONDER_MS - (f.restante ?? 0);
    const correcto = a.dijo_estafa === sala.cartas[a.ronda].estafa;
    // Estilo concurso: acertar vale 500 + hasta 500 por rapidez; la racha suma.
    j.racha = correcto ? j.racha + 1 : 0;
    const puntos = correcto ? 500 + Math.round(500 * (1 - ms / RESPONDER_MS)) + Math.min(3, j.racha - 1) * 100 : 0;
    j.puntaje += puntos;
    j.respuestas.set(a.ronda, { dijo_estafa: a.dijo_estafa, ms, correcto, puntos });
    return this.vista(codigo, id)!;
  }

  /**
   * LA BANDA: el jugador manda ids del catálogo, el servidor arma la
   * transferencia y la pasa por el pipeline real. El caso que vuelve es de
   * verdad: aparece en el monitor del evento con su alias.
   *
   * El orden importa: los límites (espera entre golpes, tope, no repetir) se
   * aplican ANTES de evaluar, para que dos toques seguidos no entren los dos
   * mientras el pipeline piensa.
   */
  async golpe(
    codigo: string,
    datos: { alias: string; golpe: Golpe },
    evaluar: Evaluador,
    jugador?: string,
  ): Promise<ResultadoGolpe | ErrorSala> {
    const sala = this.salas.get(codigo);
    if (!sala) return { error: 'sala no encontrada', status: 404 };
    if (sala.juego !== 'banda') return { error: 'esta sala no es de LA BANDA', status: 409 };
    const id = llave(jugador, datos.alias);
    const j = sala.jugadores.get(id);
    if (!j) return { error: 'primero únete a la sala', status: 403 };
    const ahora = this.reloj();
    const f = this.fase(sala, ahora);
    if (f.fase !== 'ataque') {
      return {
        error: f.fase === 'fin' ? 'el tiempo terminó' : 'la sala todavía no empezó',
        status: 409,
      };
    }
    if (j.golpes.length >= MAX_GOLPES) return { error: `ya lanzaste tus ${MAX_GOLPES} golpes`, status: 409 };
    const espera = ESPERA_GOLPE_MS - (ahora - j.ultimoGolpe);
    if (j.ultimoGolpe > 0 && espera > 0) {
      return { error: `espera ${Math.ceil(espera / 1000)} s antes del próximo golpe`, status: 429 };
    }
    const k = claveGolpe(datos.golpe);
    if (j.claves.has(k)) return { error: 'ya probaste ese golpe: cambia algo', status: 409 };

    // Se reservan el turno y la combinación antes de esperar al pipeline.
    j.ultimoGolpe = ahora;
    j.claves.add(k);
    let caso: Caso;
    try {
      caso = await evaluar(transferenciaDeGolpe(datos.golpe, j.alias));
    } catch {
      j.claves.delete(k); // no se evaluó: que pueda volver a intentarlo
      return { error: 'el sistema no pudo evaluar el golpe; prueba otra vez', status: 503 };
    }

    const decision = caso.decision;
    const frenado = !decision || decision.accion !== 'PERMITIR';
    const descubrimiento = !frenado && !sala.tacticasConHueco.has(datos.golpe.tactica);
    if (descubrimiento) sala.tacticasConHueco.add(datos.golpe.tactica);
    const puntos = frenado
      ? PUNTOS_FRENADO
      : PUNTOS_HUECO + (descubrimiento ? PUNTOS_DESCUBRIMIENTO : 0);
    const registrado: GolpeRegistrado = {
      caso: caso.id,
      alias: j.alias,
      victima: datos.golpe.victima,
      tactica: datos.golpe.tactica,
      destino: datos.golpe.destino,
      monto: MONTO_DE[datos.golpe.monto],
      madrugada: datos.golpe.madrugada,
      frenado,
      regla: decision?.regla ?? 'P10',
      accion: decision?.accion ?? 'ESCALAR',
      llamadas_ia: caso.ia?.llamadas ?? 0,
      puntos,
      descubrimiento,
      t: ahora,
      orden: ++sala.secuencia,
    };
    j.golpes.push(registrado);
    j.puntaje += puntos;
    return { vista: this.vista(codigo, id)!, golpe: registrado, caso };
  }

  /** `quien`: id de jugador (cookie), llave, o el apodo (clientes viejos). */
  vista(codigo: string, quien?: string): VistaSala | null {
    const sala = this.salas.get(codigo);
    if (!sala) return null;
    const ahora = this.reloj();
    const f = this.fase(sala, ahora);
    const carta = f.fase === 'responder' || f.fase === 'revelar' ? sala.cartas[f.ronda] : null;
    const orden = [...sala.jugadores.entries()].sort(([, x], [, y]) => y.puntaje - x.puntaje);
    const jugadores = orden.map(([, j]) => ({ alias: j.alias, pais: j.pais, puntaje: j.puntaje }));
    const enRonda = [...sala.jugadores.values()].map((j) => j.respuestas.get(f.ronda));
    const respondieron = carta ? enRonda.filter(Boolean).length : 0;
    const miId = quien ? normalizar(quien) : undefined;
    const yo = miId ? sala.jugadores.get(miId) : undefined;
    return {
      codigo: sala.codigo,
      juego: sala.juego,
      host: sala.host,
      fase: f.fase,
      ronda: f.ronda,
      rondas: RONDAS,
      restante_ms: f.restante,
      ahora,
      carta: carta?.id ?? null,
      verdad: f.fase === 'revelar' && carta ? carta.estafa : null,
      reparto:
        f.fase === 'revelar'
          ? {
              estafa: enRonda.filter((r) => r?.dijo_estafa).length,
              real: enRonda.filter((r) => r && !r.dijo_estafa).length,
              sin_responder: enRonda.filter((r) => !r).length,
            }
          : null,
      respondieron,
      jugadores,
      banda: sala.juego === 'banda' ? vistaBanda(sala) : null,
      mio: yo
        ? {
            alias: yo.alias,
            puntaje: yo.puntaje,
            posicion: orden.findIndex(([k]) => k === miId) + 1,
            respondio: yo.respuestas.has(f.ronda),
            ultima: yo.respuestas.get(f.ronda) ?? null,
            banda:
              sala.juego === 'banda'
                ? {
                    golpes: yo.golpes.length,
                    huecos: yo.golpes.filter((g) => !g.frenado).length,
                    restantes: Math.max(0, MAX_GOLPES - yo.golpes.length),
                    mios: [...yo.golpes].sort((a, b) => b.orden - a.orden).slice(0, ULTIMOS_GOLPES),
                  }
                : null,
          }
        : null,
    };
  }

  /** Salas para el monitor: las de las últimas 2 h, salvo lobbies abandonados. */
  activas(): VistaSala[] {
    this.limpiarViejas();
    const ahora = this.reloj();
    return [...this.salas.values()]
      .filter((s) => s.inicio !== null || ahora - s.creada < ESPERA_VISIBLE_MS)
      .map((s) => this.vista(s.codigo)!);
  }

  private fase(sala: Sala, ahora: number): { fase: Fase; ronda: number; restante: number | null } {
    if (sala.inicio === null) return { fase: 'espera', ronda: 0, restante: null };
    const t = ahora - sala.inicio;
    if (t < CUENTA_MS) return { fase: 'cuenta', ronda: 0, restante: CUENTA_MS - t };
    // LA BANDA: una sola fase larga, todos atacando a la vez.
    if (sala.juego === 'banda') {
      const dentro = t - CUENTA_MS;
      return dentro < ATAQUE_MS
        ? { fase: 'ataque', ronda: 0, restante: ATAQUE_MS - dentro }
        : { fase: 'fin', ronda: 0, restante: null };
    }
    const ciclo = RESPONDER_MS + REVELAR_MS;
    const ronda = Math.floor((t - CUENTA_MS) / ciclo);
    if (ronda >= RONDAS) return { fase: 'fin', ronda: RONDAS - 1, restante: null };
    const dentro = (t - CUENTA_MS) % ciclo;
    return dentro < RESPONDER_MS
      ? { fase: 'responder', ronda, restante: RESPONDER_MS - dentro }
      : { fase: 'revelar', ronda, restante: ciclo - dentro };
  }

  private limpiarViejas() {
    const ahora = this.reloj();
    for (const [c, s] of this.salas) if (ahora - s.creada > VIDA_MS) this.salas.delete(c);
  }
}

// Un solo registro por proceso (también entre rutas en `next dev`).
const g = globalThis as unknown as { __salasJuego?: Salas };
export const salas = (g.__salasJuego ??= new Salas());
