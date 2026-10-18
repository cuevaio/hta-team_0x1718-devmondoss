import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

/**
 * Token del operador del demo (INFRA_Y_ORQUESTACION §5).
 *
 * Cuando el servidor se expone con un túnel, cualquiera con la URL podría
 * reiniciar el demo o confirmar una mula en la Memoria. Estas dos acciones
 * quedan reservadas al operador: exigen la cabecera `x-demo-token`.
 *
 * Solo se exige si existe `DEMO_TOKEN`. Sin la variable (laptop en
 * `localhost`, tests, demo de consola) todo funciona igual que antes.
 *
 * La comparación es en tiempo constante sobre hashes de igual largo, para que
 * la latencia no revele cuántos caracteres coinciden.
 *
 * Dueño: Ale_dev.
 */

export const CABECERA_TOKEN = 'x-demo-token';

const hash = (s: string) => createHash('sha256').update(s).digest();

export function tokenValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  return timingSafeEqual(hash(recibido), hash(esperado));
}

/** `null` si puede seguir; si no, la respuesta 401 que hay que devolver. */
export function exigirToken(req: Request, env: NodeJS.ProcessEnv = process.env): NextResponse | null {
  const esperado = env.DEMO_TOKEN?.trim();
  if (!esperado) return null;
  if (tokenValido(req.headers.get(CABECERA_TOKEN), esperado)) return null;
  return NextResponse.json(
    { error: 'esta acción es del operador del demo: falta el token o no es válido' },
    { status: 401 },
  );
}
