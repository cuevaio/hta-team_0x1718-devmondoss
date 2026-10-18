import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Alias } from './alias';
import { PAISES_JUEGO } from './arcade';
import { CARTAS, type JuegoSala, type VerdadCarta } from './cartas';

/**
 * Salas EN VIVO (multijugador, estilo concurso): alguien crea una sala con un
 * código de 4 letras, los demás entran desde su celular y todos responden la
 * misma carta al mismo tiempo. El reloj es del servidor: las rondas avanzan
 * solas, así que basta con que cada celular consulte el estado.
 *
 * Las salas viven en la RAM del proceso (como los casos): son efímeras y se
 * limpian solas a las 2 h. Lo que vale como dato (las respuestas) lo registra
 * cada jugador al final en `/api/juego/arcade` con `origen: 'sala'`.
 *
 * Dueño: Tony_dev (demo jugable).
 */

export const RONDAS = 8;
export const CUENTA_MS = 3_000;
export const RESPONDER_MS = 10_000;
export const REVELAR_MS = 4_500;
const VIDA_MS = 2 * 60 * 60 * 1000;
/** Una sala que nunca empezó deja de mostrarse en el monitor a los 15 min. */
const ESPERA_VISIBLE_MS = 15 * 60 * 1000;
const MAX_JUGADORES = 150;
/** Sin I ni O: se confunden con 1 y 0 al dictar el código. */
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export const JuegoSalaZ = z.enum(['real_o_estafa', 'pausa_o_pasa']);
const Pais = z.enum(PAISES_JUEGO);
const Codigo = z.string().trim().toUpperCase().regex(/^[A-Z]{4}$/);

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
]);
export type AccionSala = z.infer<typeof AccionSala>;
export { Codigo as CodigoSala };

type Respuesta = { dijo_estafa: boolean; ms: number; correcto: boolean; puntos: number };
type Jugador = { alias: string; pais: string; puntaje: number; respuestas: Map<number, Respuesta>; racha: number };

type Sala = {
  codigo: string;
  juego: JuegoSala;
  host: string;
  token: string;
  creada: number;
  inicio: number | null;
  cartas: VerdadCarta[];
  jugadores: Map<string, Jugador>;
};

export type Fase = 'espera' | 'cuenta' | 'responder' | 'revelar' | 'fin';

export type VistaSala = {
  codigo: string;
  juego: JuegoSala;
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
  /** Lo del jugador que consulta (si mandó `alias`). */
  mio: { puntaje: number; posicion: number; respondio: boolean; ultima: Respuesta | null } | null;
};

export type ErrorSala = { error: string; status: 400 | 403 | 404 | 409 };

const clave = (alias: string) => alias.trim().toLowerCase();

function barajar<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 8 cartas con al menos 3 de cada lado (estafa y real) para que haya duda. */
function repartir(juego: JuegoSala): VerdadCarta[] {
  const todas = CARTAS[juego];
  const si = barajar(todas.filter((c) => c.estafa));
  const no = barajar(todas.filter((c) => !c.estafa));
  return barajar([...si.slice(0, 5), ...no.slice(0, RONDAS - 5)]);
}

export class Salas {
  private salas = new Map<string, Sala>();

  constructor(private readonly reloj: () => number = Date.now) {}

  crear(alias: string, pais: string, juego: JuegoSala): { codigo: string; token: string } {
    this.limpiarViejas();
    let codigo = '';
    do {
      codigo = Array.from({ length: 4 }, () => LETRAS[Math.floor(Math.random() * LETRAS.length)]).join('');
    } while (this.salas.has(codigo));
    const token = randomBytes(12).toString('hex');
    const sala: Sala = { codigo, juego, host: alias, token, creada: this.reloj(), inicio: null, cartas: repartir(juego), jugadores: new Map() };
    sala.jugadores.set(clave(alias), { alias, pais, puntaje: 0, respuestas: new Map(), racha: 0 });
    this.salas.set(codigo, sala);
    return { codigo, token };
  }

  accion(codigo: string, a: AccionSala): VistaSala | ErrorSala {
    const sala = this.salas.get(codigo);
    if (!sala) return { error: 'sala no encontrada', status: 404 };
    const ahora = this.reloj();
    const f = this.fase(sala, ahora);
    if (a.accion === 'unirse') {
      if (!sala.jugadores.has(clave(a.alias))) {
        if (sala.jugadores.size >= MAX_JUGADORES) return { error: 'la sala está llena', status: 409 };
        sala.jugadores.set(clave(a.alias), { alias: a.alias, pais: a.pais, puntaje: 0, respuestas: new Map(), racha: 0 });
      }
      return this.vista(codigo, a.alias)!;
    }
    if (a.accion === 'iniciar' || a.accion === 'reiniciar') {
      if (a.token !== sala.token) return { error: 'solo quien creó la sala puede hacer eso', status: 403 };
      if (a.accion === 'iniciar' && f.fase !== 'espera') return { error: 'la sala ya empezó', status: 409 };
      if (a.accion === 'reiniciar') {
        sala.cartas = repartir(sala.juego);
        for (const j of sala.jugadores.values()) {
          j.puntaje = 0;
          j.racha = 0;
          j.respuestas.clear();
        }
        sala.inicio = null;
        return this.vista(codigo, sala.host)!;
      }
      sala.inicio = ahora;
      return this.vista(codigo, sala.host)!;
    }
    // responder
    const j = sala.jugadores.get(clave(a.alias));
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
    return this.vista(codigo, a.alias)!;
  }

  vista(codigo: string, alias?: string): VistaSala | null {
    const sala = this.salas.get(codigo);
    if (!sala) return null;
    const ahora = this.reloj();
    const f = this.fase(sala, ahora);
    const carta = f.fase === 'responder' || f.fase === 'revelar' ? sala.cartas[f.ronda] : null;
    const jugadores = [...sala.jugadores.values()]
      .map((j) => ({ alias: j.alias, pais: j.pais, puntaje: j.puntaje }))
      .sort((x, y) => y.puntaje - x.puntaje);
    const enRonda = [...sala.jugadores.values()].map((j) => j.respuestas.get(f.ronda));
    const respondieron = carta ? enRonda.filter(Boolean).length : 0;
    const yo = alias ? sala.jugadores.get(clave(alias)) : undefined;
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
      mio: yo
        ? {
            puntaje: yo.puntaje,
            posicion: jugadores.findIndex((x) => clave(x.alias) === clave(yo.alias)) + 1,
            respondio: yo.respuestas.has(f.ronda),
            ultima: yo.respuestas.get(f.ronda) ?? null,
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
