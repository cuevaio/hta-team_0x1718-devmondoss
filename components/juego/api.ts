import type { Caso } from "@/lib/contracts";
import { tokenOperador } from "@/components/demo-dashboard";
import type { ContextoJugada } from "./datos";

/**
 * Cliente HTTP del demo jugable. Solo consume la API documentada en
 * docs/work/API.md; nunca decide nada por su cuenta (la decisión es del motor).
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const token = tokenOperador();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "x-demo-token": token } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? `La solicitud falló (${response.status}).`);
  if (body === null) throw new Error("El servidor devolvió una respuesta vacía.");
  return body;
}

export const post = <T>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", body: JSON.stringify(body) });

export function transferir(body: {
  transaccion: { origen: string; destino: string; monto: number; moneda: "PEN" };
  contexto?: ContextoJugada;
  alias?: string;
}) {
  return post<Caso>("/api/transfers", body);
}

export function responderGuardian(casoId: string, texto: string) {
  return post<Caso>(`/api/cases/${casoId}/guardian/reply`, { texto });
}

export type PartidaVictima = {
  rol: "victima";
  alias: string;
  ronda_a: { cayo: boolean; frustracion: number };
  ronda_b: { casos: string[]; pausa_molesto: "no" | "un_poco" | "mucho" };
  activaria: "si" | "no" | "no_se";
};

export type PartidaAtacante = {
  rol: "atacante";
  alias: string;
  intentos: Array<{ caso: string; tactica: string }>;
  idea?: string;
};

export function registrarPartida(partida: PartidaVictima | PartidaAtacante) {
  return post<{ id: string }>("/api/juego/partidas", partida);
}

export type JugadaArcade =
  | {
      modo: "real_o_estafa" | "pausa_o_pasa";
      alias: string;
      pais: string;
      puntaje: number;
      respuestas: Array<{ carta: string; categoria: string; estafa: boolean; dijo_estafa: boolean; ms: number }>;
      encuesta?: Record<string, string>;
    }
  | {
      modo: "sigue_el_dinero";
      alias: string;
      pais: string;
      puntaje: number;
      recuperado_pct: number;
      falsos_positivos: number;
      mulas: number;
      segundos: number;
      encuesta?: Record<string, string>;
    }
  | {
      modo: "atrapa_la_mula";
      alias: string;
      pais: string;
      puntaje: number;
      aciertos: number;
      errores: number;
      escapados: number;
      encuesta?: Record<string, string>;
    };

export type FilaRanking = { alias: string; pais: string; puntaje: number };

export type ResumenArcade = {
  jugadas: number;
  jugadores: number;
  ranking: Record<"real_o_estafa" | "sigue_el_dinero" | "atrapa_la_mula" | "pausa_o_pasa", FilaRanking[]>;
  general: FilaRanking[];
  caidas: Array<{ categoria: string; vistas: number; cayeron: number; pct: number }>;
};

export function registrarArcade(jugada: JugadaArcade) {
  return post<{ id: string; posicion: number }>("/api/juego/arcade", jugada);
}

export function resumenArcade() {
  return api<ResumenArcade>("/api/juego/arcade");
}
