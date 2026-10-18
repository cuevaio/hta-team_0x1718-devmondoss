import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { Caso, DecisionAccion, ReglaPolicy } from '@/lib/contracts';
import { borrarFilas, cargarFilas, guardarFila, supabaseActivo } from '@/lib/persistencia/supabase';
import { idUnico } from '@/lib/persistencia/id';
import { Alias, motivoAliasInvalido } from './alias';

/**
 * Partidas del demo jugable (DEMO_JUEGO §6): los datos que validan la
 * propuesta de valor.
 *
 * Principios:
 *  - **Anónimo** (§8): alias libre, sin correo, teléfono ni enlace. El texto
 *    libre del atacante pasa por el mismo filtro y nunca va a un modelo (R5).
 *  - **Los resultados los calcula el sistema**, no el cliente: lo robado y lo
 *    frenado salen de los casos reales del pipeline. Un caso inexistente o ya
 *    usado en otra partida se rechaza: no se pueden inflar los números.
 *  - **Sobrevive al reset del demo**: al registrar, se copia de cada caso lo
 *    que hace falta (acción, regla, monto). Si no, el reset que se hace antes
 *    de presentar borraría los datos de las partidas del evento.
 *  - Persistencia opcional con `PARTIDAS_ARCHIVO`, igual que la Memoria, y/o
 *    en Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`): se carga al
 *    arrancar (`listo`) y cada partida se escribe al registrarse.
 *
 * Dueño: Ale_dev.
 */

// ── Esquemas de entrada (las 3 preguntas de §6, con sus opciones exactas) ──

export const TACTICAS = ['falso_banco', 'link_falso', 'falso_familiar', 'app_falsa', 'duplicado_chip'] as const;
export const Tactica = z.enum(TACTICAS);

const IdCaso = z.string().regex(/^CASO-\d{4,}$/);

const TextoLibre = z
  .string()
  .trim()
  .max(280)
  .superRefine((t, ctx) => {
    const motivo = motivoAliasInvalido(t);
    if (motivo) ctx.addIssue({ code: 'custom', message: motivo.replace('el alias', 'el texto') });
  });

export const EntradaPartidaVictima = z.object({
  rol: z.literal('victima'),
  alias: Alias,
  ronda_a: z.object({
    /** ¿Transfirió en la ronda «Hoy»? Lo registra el juego, no el jugador. */
    cayo: z.boolean(),
    /** ¿Cuánta frustración sentiste? 😌 🙂 😐 😟 😫 → 1..5 (ordinal). */
    frustracion: z.number().int().min(1).max(5),
  }),
  ronda_b: z.object({
    /** Casos del pipeline real jugados en la ronda «Con nuestra capa». */
    casos: z.array(IdCaso).max(5),
    /** ¿La pausa te molestó? */
    pausa_molesto: z.enum(['no', 'un_poco', 'mucho']),
  }),
  /** ¿Activarías esta protección en tu banco? */
  activaria: z.enum(['si', 'no', 'no_se']),
});

export const EntradaPartidaAtacante = z.object({
  rol: z.literal('atacante'),
  alias: Alias,
  /** Máximo 5 intentos por partida (§4). */
  intentos: z.array(z.object({ caso: IdCaso, tactica: Tactica })).min(1).max(5),
  /** «¿Qué intentarías después?» — ideas para red-teaming. */
  idea: TextoLibre.optional(),
});

export const EntradaPartida = z.discriminatedUnion('rol', [EntradaPartidaVictima, EntradaPartidaAtacante]);
export type EntradaPartida = z.infer<typeof EntradaPartida>;

// ── Lo que se guarda: la entrada + la copia de los hechos de cada caso ──

export interface HechoCaso {
  caso: string;
  /**
   * Hora de creación del caso. El id (`CASO-0001`) se recicla con el reset del
   * demo y con cada reinicio del proceso, pero las partidas sobreviven a ambos:
   * el id solo no identifica un caso, id + hora sí.
   */
  creado?: string;
  accion: DecisionAccion;
  regla: ReglaPolicy;
  monto: number;
  destino: string;
}

export type Partida =
  | (z.infer<typeof EntradaPartidaVictima> & { id: string; t: string; hechos: HechoCaso[] })
  | (z.infer<typeof EntradaPartidaAtacante> & {
      id: string;
      t: string;
      hechos: (HechoCaso & { tactica: z.infer<typeof Tactica> })[];
    });

export type ErrorPartida = { error: string; casos?: string[]; status: 400 | 409 };

const casosDe = (e: EntradaPartida): string[] =>
  e.rol === 'victima' ? e.ronda_b.casos : e.intentos.map((i) => i.caso);

export class RegistroPartidas {
  private partidas: Partida[] = [];
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
      const nube = await cargarFilas<Partida>('partidas');
      const ids = new Set(nube.map((p) => p.id));
      // Lo que solo existe en el archivo local (p. ej. de antes de conectar Supabase) se conserva.
      this.partidas = [...nube, ...this.partidas.filter((p) => !ids.has(p.id))];
    } catch (e) {
      console.error(`Partidas: no se pudo cargar de Supabase; sigo con lo local. ${(e as Error).message}`);
    }
  }

  /**
   * Registra una partida. `buscarCaso` da acceso a los casos vivos del
   * pipeline; se inyecta para poder testear sin estado global.
   */
  registrar(entrada: EntradaPartida, buscarCaso: (id: string) => Caso | null): Partida | ErrorPartida {
    const ids = casosDe(entrada);
    if (new Set(ids).size !== ids.length) {
      return { error: 'un caso aparece dos veces en la partida', status: 400 };
    }
    const faltan = ids.filter((id) => !buscarCaso(id)?.decision);
    if (faltan.length > 0) {
      return { error: 'casos inexistentes o sin decisión', casos: faltan, status: 400 };
    }
    const clave = (id: string, creado?: string) => `${id}@${creado ?? ''}`;
    const usados = new Set(this.partidas.flatMap((p) => p.hechos.map((h) => clave(h.caso, h.creado))));
    const creadoDe = (id: string) => buscarCaso(id)!.timeline[0]?.t;
    const repetidos = ids.filter((id) => usados.has(clave(id, creadoDe(id))));
    if (repetidos.length > 0) {
      return { error: 'casos ya registrados en otra partida', casos: repetidos, status: 409 };
    }

    const hecho = (id: string): HechoCaso => {
      const c = buscarCaso(id)!;
      return {
        caso: id,
        creado: c.timeline[0]?.t,
        accion: c.decision!.accion,
        regla: c.decision!.regla,
        monto: c.transaccion.monto,
        destino: c.transaccion.destino,
      };
    };
    // Id único entre servidores (ver lib/persistencia/id.ts): con un contador, dos servidores
    // sobre el mismo Supabase se pisaban las partidas.
    const base = { id: idUnico('PARTIDA'), t: new Date().toISOString() };
    const partida: Partida =
      entrada.rol === 'victima'
        ? { ...entrada, ...base, hechos: entrada.ronda_b.casos.map(hecho) }
        : { ...entrada, ...base, hechos: entrada.intentos.map((i) => ({ ...hecho(i.caso), tactica: i.tactica })) };

    this.partidas.push(partida);
    this.guardar();
    void guardarFila('partidas', { id: partida.id, t: partida.t, alias: partida.alias, tipo: partida.rol, data: partida }).catch(
      (e: Error) => console.error(`Partidas: no se guardó ${partida.id} en Supabase. ${e.message}`),
    );
    return partida;
  }

  todas(): Partida[] {
    return this.partidas.map((p) => structuredClone(p));
  }

  /** Vacía este servidor. Supabase solo con `nube: true` (los datos del evento no se pierden por un clic). */
  limpiar(o: { nube?: boolean } = {}): void {
    this.partidas = [];
    this.guardar();
    if (o.nube) void borrarFilas('partidas').catch((e: Error) => console.error(`Partidas: no se borró en Supabase. ${e.message}`));
  }

  get cantidad(): number {
    return this.partidas.length;
  }

  private cargar(archivo: string): void {
    if (!existsSync(archivo)) return;
    try {
      const crudo: unknown = JSON.parse(readFileSync(archivo, 'utf8'));
      if (Array.isArray(crudo)) this.partidas = crudo as Partida[];
    } catch {
      const apartado = `${archivo}.corrupto-${Date.now()}`;
      renameSync(archivo, apartado);
      console.warn(`Partidas: ${archivo} ilegible; apartado como ${apartado}.`);
    }
  }

  private guardar(): void {
    if (!this.archivo) return;
    mkdirSync(dirname(this.archivo), { recursive: true });
    const temporal = `${this.archivo}.tmp`;
    writeFileSync(temporal, JSON.stringify(this.partidas, null, 2), 'utf8');
    renameSync(temporal, this.archivo);
  }
}

export const partidas = new RegistroPartidas(process.env.PARTIDAS_ARCHIVO?.trim() || undefined);
