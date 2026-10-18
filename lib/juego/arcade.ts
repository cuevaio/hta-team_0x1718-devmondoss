import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { borrarFilas, cargarFilas, guardarFila, supabaseActivo } from '@/lib/persistencia/supabase';
import { Alias } from './alias';

/**
 * Jugadas de los modos arcade del juego (¿REAL O ESTAFA?, SIGUE EL DINERO,
 * ATRAPA LA MULA, ¿PAUSA O PASA?)
 * y las preguntas de encuesta de un toque que van dentro del juego.
 *
 * Es aparte de `partidas.ts` (las rondas A/B contra el motor): aquí no hay
 * casos del pipeline, solo lo que hizo el jugador. Sirve para dos cosas:
 *  - **Validación**: en qué estafas cae la gente y qué opina de la pausa.
 *  - **Tracción**: cuántas personas jugaron, desde qué país, y el ranking.
 *
 * Mismos principios que las partidas: anónimo (alias filtrado), sin texto
 * libre, y persistencia opcional con `ARCADE_ARCHIVO` y/o Supabase
 * (misma configuración que `partidas.ts`).
 *
 * Dueño: Tony_dev (demo jugable).
 */

export const PAISES_JUEGO = ['pe', 'co', 'mx', 'ar'] as const;
export const MODOS = ['real_o_estafa', 'sigue_el_dinero', 'atrapa_la_mula', 'pausa_o_pasa'] as const;
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
  /** `sala`: partida EN VIVO (multijugador). Cuenta como dato, pero no entra al ranking arcade. */
  origen: z.enum(['solo', 'sala']).optional(),
  pais: z.enum(PAISES_JUEGO),
  puntaje: z.number().int().min(0).max(100_000),
  encuesta: Encuesta.optional(),
};

const Respuestas = z
  .array(
    z.object({
      carta: Clave,
      categoria: Clave,
      estafa: z.boolean(),
      dijo_estafa: z.boolean(),
      ms: z.number().int().min(0).max(120_000),
    }),
  )
  .max(80);

export const EntradaRealOEstafa = z.object({
  modo: z.literal('real_o_estafa'),
  ...Base,
  respuestas: Respuestas,
});

/** ¿PAUSA O PASA?: `estafa` = la transferencia era riesgosa, `dijo_estafa` = la pausó. */
export const EntradaPausaOPasa = z.object({
  modo: z.literal('pausa_o_pasa'),
  ...Base,
  respuestas: Respuestas,
});

export const EntradaAtrapaLaMula = z.object({
  modo: z.literal('atrapa_la_mula'),
  ...Base,
  aciertos: z.number().int().min(0).max(500),
  /** Cuentas normales tocadas por error. */
  errores: z.number().int().min(0).max(500),
  /** Mulas que se escaparon. */
  escapados: z.number().int().min(0).max(500),
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

export const EntradaArcade = z.discriminatedUnion('modo', [
  EntradaRealOEstafa,
  EntradaSigueElDinero,
  EntradaAtrapaLaMula,
  EntradaPausaOPasa,
]);
export type EntradaArcade = z.infer<typeof EntradaArcade>;
export type JugadaArcade = EntradaArcade & { id: string; t: string };

export type FilaRanking = { alias: string; pais: string; puntaje: number };

export type ResumenArcade = {
  jugadas: number;
  jugadores: number;
  por_pais: Record<string, number>;
  por_modo: Record<string, number>;
  /** Jugadas hechas en salas EN VIVO (multijugador). */
  en_sala: number;
  ranking: Record<Modo, FilaRanking[]>;
  /** Suma del mejor puntaje de cada alias en cada modo. */
  general: FilaRanking[];
  /** Por tipo de estafa: cuántas veces salió y cuántas veces la creyeron real. */
  caidas: Array<{ categoria: string; vistas: number; cayeron: number; pct: number }>;
  /** Mensajes reales marcados como estafa (desconfianza: el costo de un falso positivo). */
  reales_rechazados_pct: number | null;
  /** ¿PAUSA O PASA?: transferencias riesgosas que el jugador dejó pasar y legítimas que pausó. */
  pausa_o_pasa: { riesgosas_pasadas_pct: number | null; legitimas_pausadas_pct: number | null };
  encuesta: Record<PreguntaEncuesta, Record<string, number>>;
};

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

export class RegistroArcade {
  private jugadas: JugadaArcade[] = [];
  /** Se resuelve cuando terminó de cargar de Supabase (si está configurado). */
  readonly listo: Promise<void>;

  constructor(
    private readonly archivo?: string,
    nube = supabaseActivo(),
  ) {
    if (archivo) this.cargar(archivo);
    this.listo = nube ? this.hidratar() : Promise.resolve();
  }

  private async hidratar(): Promise<void> {
    try {
      const nube = await cargarFilas<JugadaArcade>('jugadas_arcade');
      const ids = new Set(nube.map((j) => j.id));
      this.jugadas = [...nube, ...this.jugadas.filter((j) => !ids.has(j.id))];
    } catch (e) {
      console.error(`Arcade: no se pudo cargar de Supabase; sigo con lo local. ${(e as Error).message}`);
    }
  }

  registrar(entrada: EntradaArcade): JugadaArcade {
    const jugada: JugadaArcade = {
      ...entrada,
      id: `ARCADE-${String(this.jugadas.length + 1).padStart(5, '0')}`,
      t: new Date().toISOString(),
    };
    this.jugadas.push(jugada);
    this.guardar();
    void guardarFila('jugadas_arcade', { id: jugada.id, t: jugada.t, alias: jugada.alias, tipo: jugada.modo, data: jugada }).catch(
      (e: Error) => console.error(`Arcade: no se guardó ${jugada.id} en Supabase. ${e.message}`),
    );
    return jugada;
  }

  todas(): JugadaArcade[] {
    return this.jugadas.map((j) => structuredClone(j));
  }

  limpiar(): void {
    this.jugadas = [];
    this.guardar();
    void borrarFilas('jugadas_arcade').catch((e: Error) => console.error(`Arcade: no se borró en Supabase. ${e.message}`));
  }

  get cantidad(): number {
    return this.jugadas.length;
  }

  /** Posición (1 = primero) que tendría un puntaje en el ranking de su modo. */
  posicion(modo: Modo, puntaje: number): number {
    const mejores = this.mejoresPorAlias(modo);
    return mejores.filter((f) => f.puntaje > puntaje).length + 1;
  }

  /** Ranking general: suma del mejor puntaje de cada alias en cada modo. */
  general(): FilaRanking[] {
    const total = new Map<string, FilaRanking>();
    for (const modo of MODOS) {
      for (const f of this.mejoresPorAlias(modo)) {
        const clave = f.alias.toLowerCase();
        const previa = total.get(clave);
        total.set(clave, { alias: previa?.alias ?? f.alias, pais: previa?.pais ?? f.pais, puntaje: (previa?.puntaje ?? 0) + f.puntaje });
      }
    }
    return [...total.values()].sort((a, b) => b.puntaje - a.puntaje);
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

    let riesgosas = 0;
    let riesgosasPasadas = 0;
    let legitimas = 0;
    let legitimasPausadas = 0;
    for (const x of j) {
      if (x.modo !== 'pausa_o_pasa') continue;
      for (const r of x.respuestas) {
        if (r.estafa) {
          riesgosas++;
          if (!r.dijo_estafa) riesgosasPasadas++;
        } else {
          legitimas++;
          if (r.dijo_estafa) legitimasPausadas++;
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
      en_sala: j.filter((x) => x.origen === 'sala').length,
      ranking: Object.fromEntries(MODOS.map((m) => [m, this.mejoresPorAlias(m).slice(0, top)])) as Record<Modo, FilaRanking[]>,
      general: this.general().slice(0, top),
      caidas: [...categorias.entries()]
        .map(([categoria, c]) => ({ categoria, ...c, pct: pct(c.cayeron, c.vistas) }))
        .sort((a, b) => b.pct - a.pct || b.vistas - a.vistas),
      reales_rechazados_pct: reales === 0 ? null : pct(realesRechazados, reales),
      pausa_o_pasa: {
        riesgosas_pasadas_pct: riesgosas === 0 ? null : pct(riesgosasPasadas, riesgosas),
        legitimas_pausadas_pct: legitimas === 0 ? null : pct(legitimasPausadas, legitimas),
      },
      encuesta,
    };
  }

  /** Mejor puntaje de cada alias en un modo, de mayor a menor. */
  private mejoresPorAlias(modo: Modo): FilaRanking[] {
    const mejor = new Map<string, FilaRanking>();
    for (const x of this.jugadas) {
      if (x.modo !== modo || x.origen === 'sala') continue;
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
