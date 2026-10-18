import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Persistencia en Supabase de las partidas y jugadas del demo jugable.
 *
 * Opcional: sin `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` todo sigue como
 * antes (RAM + archivo). La key de servicio solo se usa en el servidor; las
 * tablas tienen RLS activado y sin políticas, así que el navegador no entra.
 *
 * Cada fila es `{ id, t, alias, tipo, data }`: `data` guarda el registro
 * completo tal como lo manejan `RegistroPartidas` y `RegistroArcade`.
 */
export type TablaJuego = 'partidas' | 'jugadas_arcade';

export interface FilaJuego {
  id: string;
  t: string;
  alias: string;
  /** `rol` en partidas, `modo` en arcade. */
  tipo: string;
  data: unknown;
}

let cliente: SupabaseClient | null | undefined;

function conectar(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  cliente = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cliente;
}

export const supabaseActivo = (): boolean => conectar() !== null;

/** Lee todas las filas de una tabla en orden de creación. Falla → lanza. */
export async function cargarFilas<T>(tabla: TablaJuego): Promise<T[]> {
  const db = conectar();
  if (!db) return [];
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from(tabla)
      .select('data')
      .order('t', { ascending: true })
      .order('id', { ascending: true })
      .range(desde, desde + 999);
    if (error) throw new Error(`Supabase ${tabla}: ${error.message}`);
    filas.push(...data.map((f) => f.data as T));
    if (data.length < 1000) return filas;
  }
}

/** Pausas entre reintentos: una caída corta de red (la Wi-Fi del evento) no pierde la fila. */
export const ESPERAS_REINTENTO_MS = [1_000, 4_000, 15_000];

/** Upsert de una fila, con reintentos. Si todos fallan → lanza (la fila sigue en RAM y en archivo). */
export async function guardarFila(tabla: TablaJuego, fila: FilaJuego, esperas: number[] = ESPERAS_REINTENTO_MS): Promise<void> {
  const db = conectar();
  if (!db) return;
  let ultimo = '';
  for (let i = 0; i <= esperas.length; i++) {
    try {
      const { error } = await db.from(tabla).upsert(fila);
      if (!error) return;
      ultimo = error.message;
    } catch (e) {
      ultimo = e instanceof Error ? e.message : String(e);
    }
    if (i < esperas.length) await new Promise((r) => setTimeout(r, esperas[i]));
  }
  throw new Error(`Supabase ${tabla}: ${ultimo}`);
}

export async function borrarFilas(tabla: TablaJuego): Promise<void> {
  const db = conectar();
  if (!db) return;
  const { error } = await db.from(tabla).delete().neq('id', '');
  if (error) throw new Error(`Supabase ${tabla}: ${error.message}`);
}

/** Solo para tests. */
export function reiniciarClienteSupabase(): void {
  cliente = undefined;
}
