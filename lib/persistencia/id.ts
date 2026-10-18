import { randomBytes } from 'node:crypto';

/**
 * Id único entre servidores: hora (base 36, se ordena por tiempo) + azar.
 *
 * Antes el id era un contador del proceso (`ARCADE-00003`). Con varios
 * servidores escribiendo en el mismo Supabase (la Mac, Railway, otro
 * proyecto) dos generaban el mismo id y el `upsert` de uno borraba la fila
 * del otro sin avisar. Con hora + 6 bytes al azar eso no pasa.
 */
export function idUnico(prefijo: string, ahora: number = Date.now()): string {
  // 9 caracteres en base 36 alcanzan hasta el año 5188: se ordenan bien como texto.
  return `${prefijo}-${ahora.toString(36).toUpperCase().padStart(9, '0')}-${randomBytes(6).toString('hex').toUpperCase()}`;
}
