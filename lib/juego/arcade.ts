import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { Alias } from './alias';

/**
 * Jugadas de los modos arcade del juego (¿REAL O ESTAFA?, SIGUE EL DINERO)
 * y las preguntas de encuesta de un toque que van dentro del juego.
 *
 * Es aparte de `partidas.ts` (las rondas A/B contra el motor): aquí no hay
 * casos del pipeline, solo lo que hizo el jugador. Sirve para dos cosas:
 *  - **Validación**: en qué estafas cae la gente y qué opina de la pausa.
 *  - **Tracción**: cuántas personas jugaron, desde qué país, y el ranking.
 *
 * Mismos principios que las partidas: anónimo (alias filtrado), sin texto
 * libre, y persistencia opcional con `ARCADE_ARCHIVO`.
 *
 * Dueño: Tony_dev (demo jugable).
 */

export const PAISES_JUEGO = ['pe', 'co', 'mx', 'ar'] as const;
export const MODOS = ['real_o_estafa', 'sigue_el_dinero'] as const;
export type Modo = (typeof MODOS)[number];

/** Preguntas de un toque y sus respuestas posibles. */
export const ENCUESTA = {
  vivido: ['yo', 'cercano', 'no'],
  espera: ['nada', '5min', '1h', '24h'],
  protege_hoy: ['si', 'no', 'no_se'],
  activaria: ['si', 'no', 'no_se'],
  recomendaria: ['si', 'no'],
} as const;
export type PreguntaEncuesta = keyof typeof ENCUESTA;

const Encuesta = z
  .object({
    vivido: z.enum(ENCUESTA.vivido),
    espera: z.enum(ENCUESTA.espera),
    protege_hoy: z.enum(ENCUESTA.protege_hoy),
    activaria: z.enum(ENCUESTA.activaria),
    recomendaria: z.enum(ENCUESTA.recomendaria),
  })
  .partial()
  .strict();

const Clave = z.string().regex(/^[a-z0-9_]{1,32}$/);

const Base = {
  alias: Alias,
  pais: z.enum(PAISES_JUEGO),
  puntaje: z.number().int().min(0).max(100_000),
  encuesta: Encuesta.optional(),
};

export const EntradaRealOEstafa = z.object({
  modo: z.literal('real_o_estafa'),
  ...Base,
  respuestas: z
    .array(
      z.object({
        carta: Clave,
        categoria: Clave,
        estafa: z.boolean(),
        dijo_estafa: z.boolean(),
        ms: z.number().int().min(0).max(120_000),
      }),
    )
    .max(80),
});

export const EntradaSigueElDinero = z.object({
  modo: z.literal('sigue_el_dinero'),
  ...Base,
  /** Porcentaje del dinero robado que se congeló a tiempo. */
  recuperado_pct: z.number().int().min(0).max(100),
  /** Cuentas legítimas congeladas por error. */
  falsos_positivos: z.number().int().min(0).max(20),
  mulas: z.number().int().min(0).max(20),
  segundos: z.number().int().min(0).max(600),
});

export const EntradaArcade = z.discriminatedUnion('modo', [EntradaRealOEstafa, EntradaSigueElDinero]);
export type EntradaArcade = z.infer<typeof EntradaArcade>;
export type JugadaArcade = EntradaArcade & { id: string; t: string };

export type FilaRanking = { alias: string; pais: string; puntaje: number };

export type ResumenArcade = {
  jugadas: number;
  jugadores: number;
  por_pais: Record<string, number>;
  por_modo: Record<string, number>;
  ranking: Record<Modo, FilaRanking[]>;
  /** Por tipo de estafa: cuántas veces salió y cuántas veces la creyeron real. */
  caidas: Array<{ categoria: string; vistas: number; cayeron: number; pct: number }>;
  /** Mensajes reales marcados como estafa (desconfianza: el costo de un falso positivo). */
  reales_rechazados_pct: number | null;
  encuesta: Record<PreguntaEncuesta, Record<string, number>>;
};

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

export class RegistroArcade {
  private jugadas: JugadaArcade[] = [];

  constructor(private readonly archivo?: string) {
    if (archivo) this.cargar(archivo);
  }

  registrar(entrada: EntradaArcade): JugadaArcade {
    const jugada: JugadaArcade = {
      ...entrada,
      id: `ARCADE-${String(this.jugadas.length + 1).padStart(5, '0')}`,
      t: new Date().toISOString(),
    };
    this.jugadas.push(jugada);
    this.guardar();
    return jugada;
  }

  todas(): JugadaArcade[] {
    return this.jugadas.map((j) => structuredClone(j));
  }

  limpiar(): void {
    this.jugadas = [];
    this.guardar();
  }

  get cantidad(): number {
    return this.jugadas.length;
  }

  /** Posición (1 = primero) que tendría un puntaje en el ranking de su modo. */
  posicion(modo: Modo, puntaje: number): number {
    const mejores = this.mejoresPorAlias(modo);
    return mejores.filter((f) => f.puntaje > puntaje).length + 1;
  }

  resumen(top = 10): ResumenArcade {
    const j = this.jugadas;
    const contar = (claves: string[]) =>
      claves.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});

    const categorias = new Map<string, { vistas: number; cayeron: number }>();
    let reales = 0;
    let realesRechazados = 0;
    for (const x of j) {
      if (x.modo !== 'real_o_estafa') continue;
      for (const r of x.respuestas) {
        if (r.estafa) {
          const c = categorias.get(r.categoria) ?? { vistas: 0, cayeron: 0 };
          c.vistas++;
          if (!r.dijo_estafa) c.cayeron++;
          categorias.set(r.categoria, c);
        } else {
          reales++;
          if (r.dijo_estafa) realesRechazados++;
        }
      }
    }

    const encuesta = Object.fromEntries(
      (Object.keys(ENCUESTA) as PreguntaEncuesta[]).map((p) => [
        p,
        contar(j.flatMap((x) => (x.encuesta?.[p] ? [x.encuesta[p] as string] : []))),
      ]),
    ) as ResumenArcade['encuesta'];

    return {
      jugadas: j.length,
      jugadores: new Set(j.map((x) => x.alias.toLowerCase())).size,
      por_pais: contar(j.map((x) => x.pais)),
      por_modo: contar(j.map((x) => x.modo)),
      ranking: {
        real_o_estafa: this.mejoresPorAlias('real_o_estafa').slice(0, top),
        sigue_el_dinero: this.mejoresPorAlias('sigue_el_dinero').slice(0, top),
      },
      caidas: [...categorias.entries()]
        .map(([categoria, c]) => ({ categoria, ...c, pct: pct(c.cayeron, c.vistas) }))
        .sort((a, b) => b.pct - a.pct || b.vistas - a.vistas),
      reales_rechazados_pct: reales === 0 ? null : pct(realesRechazados, reales),
      encuesta,
    };
  }

  /** Mejor puntaje de cada alias en un modo, de mayor a menor. */
  private mejoresPorAlias(modo: Modo): FilaRanking[] {
    const mejor = new Map<string, FilaRanking>();
    for (const x of this.jugadas) {
      if (x.modo !== modo) continue;
      const clave = x.alias.toLowerCase();
      const previa = mejor.get(clave);
      if (!previa || x.puntaje > previa.puntaje) mejor.set(clave, { alias: x.alias, pais: x.pais, puntaje: x.puntaje });
    }
    return [...mejor.values()].sort((a, b) => b.puntaje - a.puntaje);
  }

  private cargar(archivo: string): void {
    if (!existsSync(archivo)) return;
    try {
      const crudo: unknown = JSON.parse(readFileSync(archivo, 'utf8'));
      if (Array.isArray(crudo)) this.jugadas = crudo as JugadaArcade[];
    } catch {
      const apartado = `${archivo}.corrupto-${Date.now()}`;
      renameSync(archivo, apartado);
      console.warn(`Arcade: ${archivo} ilegible; apartado como ${apartado}.`);
    }
  }

  private guardar(): void {
    if (!this.archivo) return;
    mkdirSync(dirname(this.archivo), { recursive: true });
    const temporal = `${this.archivo}.tmp`;
    writeFileSync(temporal, JSON.stringify(this.jugadas), 'utf8');
    renameSync(temporal, this.archivo);
  }
}

export const arcade = new RegistroArcade(process.env.ARCADE_ARCHIVO?.trim() || undefined);
