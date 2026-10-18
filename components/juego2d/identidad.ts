import { yo } from "@/components/juego/api";

/**
 * Identidad del jugador en este celular: el id que asigna el servidor (cookie
 * `ter_jugador`, ver lib/juego/jugador.ts) más su apodo y país recordados.
 * Como en un arcade, quien vuelve sigue siendo quien era: su récord lo espera.
 *
 * El id se guarda también en localStorage: si alguien borra las cookies pero
 * no el almacenamiento, se le devuelve la misma cookie y no pierde su récord.
 */

const COOKIE = "ter_jugador";
const K_ID = "ter-jugador";
const K_APODO = "ter-apodo";
const K_PAIS = "ter-pais";
const FORMATO = /^J-[0-9A-Z]{9}-[0-9A-F]{12}$/;

const leer = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const escribir = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    // sin almacenamiento: queda la cookie
  }
};

function cookieActual(): string | null {
  const m = new RegExp(`(?:^|; )${COOKIE}=([^;]+)`).exec(document.cookie);
  return m && FORMATO.test(decodeURIComponent(m[1])) ? decodeURIComponent(m[1]) : null;
}

/** Asegura el id de jugador. Sin conexión, usa el guardado (o ninguno). */
export async function identificar(): Promise<string | null> {
  const guardado = leer(K_ID);
  if (!cookieActual() && guardado && FORMATO.test(guardado)) {
    // Se borraron las cookies pero no el almacenamiento: se recupera el mismo jugador.
    document.cookie = `${COOKIE}=${encodeURIComponent(guardado)}; max-age=${400 * 86400}; path=/; samesite=lax`;
  }
  try {
    const { jugador } = await yo();
    escribir(K_ID, jugador);
    return jugador;
  } catch {
    return cookieActual() ?? (guardado && FORMATO.test(guardado) ? guardado : null);
  }
}

export function apodoRecordado(): string | null {
  return leer(K_APODO);
}

export function paisRecordado(): string | null {
  return leer(K_PAIS);
}

export function recordar(apodo: string, pais?: string) {
  escribir(K_APODO, apodo);
  if (pais) escribir(K_PAIS, pais);
}
