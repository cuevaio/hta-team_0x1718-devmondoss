import type {
  AgentsApi,
  Caso,
  NombreAgente,
  SalidaAuditor,
  ToolContext,
  TurnoGuardian,
  UsoAgente,
  UsoIA,
} from '@/lib/contracts';
import { USO_CERO, sumarUso } from './util';

/**
 * Orquestación de los agentes, lista para que `lib/pipeline.ts` (Ale) la llame
 * entre las reglas y la policy. Nunca lanza: si un agente falla, lo reporta en
 * `errores` y su salida queda ausente → la Policy aplica P10 (modo seguro).
 *
 *   reglas → investigar() → [continuarGuardian()…] → Policy → auditar() si debeAuditar()
 */

export interface ErrorAgente {
  agente: NombreAgente;
  mensaje: string;
}

export interface ResultadoInvestigacion {
  /** Salidas listas para mezclar en `caso.salidas`. */
  salidas: Pick<Caso['salidas'], 'coordinador' | 'detective' | 'guardian'>;
  /**
   * Turno pendiente del Guardián: si `terminado` es false, hay que mostrarle
   * `mensaje` al cliente y esperar su respuesta (continuarGuardian).
   */
  turnoGuardian: TurnoGuardian | null;
  /** Uso por agente, para sumar a `caso.ia` con `acumularIA`. */
  uso: Partial<Record<NombreAgente, UsoAgente>>;
  errores: ErrorAgente[];
}

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Coordinador → especialistas en paralelo (primer turno del Guardián incluido). */
export async function investigar(caso: Caso, ctx: ToolContext, agentes: AgentsApi): Promise<ResultadoInvestigacion> {
  const r: ResultadoInvestigacion = { salidas: {}, turnoGuardian: null, uso: {}, errores: [] };

  try {
    const c = await agentes.coordinador(caso, ctx);
    r.salidas.coordinador = c.salida;
    r.uso.coordinador = c.uso;
  } catch (e) {
    r.errores.push({ agente: 'coordinador', mensaje: mensajeDe(e) });
    // Sin Coordinador se invoca a ambos: conservador
    r.salidas.coordinador = { salida_temprana: false, invocar: ['guardian', 'detective'], motivo: 'fallback: coordinador no disponible' };
  }

  const coord = r.salidas.coordinador;
  if (coord.salida_temprana) return r;

  const casoConCoord: Caso = { ...caso, salidas: { ...caso.salidas, coordinador: coord } };
  await Promise.all([
    coord.invocar.includes('detective')
      ? agentes
          .detective(casoConCoord, ctx)
          .then((d) => {
            r.salidas.detective = d.salida;
            r.uso.detective = d.uso;
          })
          .catch((e) => r.errores.push({ agente: 'detective', mensaje: mensajeDe(e) }))
      : Promise.resolve(),
    coord.invocar.includes('guardian')
      ? agentes
          .guardianTurno(casoConCoord, ctx)
          .then((g) => {
            r.turnoGuardian = g.salida;
            r.uso.guardian = g.uso;
            if (g.salida.terminado && g.salida.salida) r.salidas.guardian = g.salida.salida;
          })
          .catch((e) => r.errores.push({ agente: 'guardian', mensaje: mensajeDe(e) }))
      : Promise.resolve(),
  ]);
  return r;
}

export interface ResultadoTurno {
  turno: TurnoGuardian | null;
  uso: UsoAgente;
  error?: string;
}

/**
 * Siguiente turno del Guardián. `mensaje = ''` significa que el cliente no
 * respondió a tiempo. Ojo: `caso.evidencia` debe incluir lo registrado en turnos previos.
 */
export async function continuarGuardian(
  caso: Caso,
  ctx: ToolContext,
  agentes: AgentsApi,
  mensaje: string,
): Promise<ResultadoTurno> {
  try {
    const g = await agentes.guardianTurno(caso, ctx, mensaje);
    return { turno: g.salida, uso: g.uso };
  } catch (e) {
    return { turno: null, uso: USO_CERO, error: mensajeDe(e) };
  }
}

/** El Auditor corre solo en casos pausados/escalados y en alertas AML. */
export function debeAuditar(caso: Caso): boolean {
  if (caso.puerta === 'alerta_aml') return true;
  return caso.decision?.accion === 'PAUSAR' || caso.decision?.accion === 'ESCALAR';
}

export interface ResultadoAuditoria {
  salida?: SalidaAuditor;
  uso: UsoAgente;
  error?: string;
}

/** Expediente. Llamar DESPUÉS de registrar la decisión: no bloquea la pausa. */
export async function auditar(caso: Caso, ctx: ToolContext, agentes: AgentsApi): Promise<ResultadoAuditoria> {
  try {
    const a = await agentes.auditor(caso, ctx);
    return { salida: a.salida, uso: a.uso };
  } catch (e) {
    return { uso: USO_CERO, error: mensajeDe(e) };
  }
}

/**
 * Tarifas ESTIMADAS en USD por millón de tokens (mezcla entrada/salida 50/50,
 * a partir de docs/context/tony_dev/AGENTS_RUNTIME_NOTES.md). Solo para el
 * contador del demo; no es facturación.
 */
export const TARIFA_USD_POR_MILLON = { rapido: 0.3, capaz: 12 } as const;

const NIVEL: Record<NombreAgente, keyof typeof TARIFA_USD_POR_MILLON> = {
  coordinador: 'rapido',
  detective: 'rapido',
  guardian: 'rapido',
  auditor: 'capaz',
};

/** Suma el uso de los agentes al contador del caso (`caso.ia`). */
export function acumularIA(ia: UsoIA, uso: Partial<Record<NombreAgente, UsoAgente>>): UsoIA {
  let { llamadas, tokens, costo_estimado } = ia;
  for (const [agente, u] of Object.entries(uso) as [NombreAgente, UsoAgente][]) {
    llamadas += u.llamadas;
    tokens += u.tokens;
    costo_estimado += (u.tokens / 1_000_000) * TARIFA_USD_POR_MILLON[NIVEL[agente]];
  }
  return { llamadas, tokens, costo_estimado: Math.round(costo_estimado * 1e6) / 1e6 };
}

/** Uso total de una investigación (útil para logs). */
export function usoTotal(uso: Partial<Record<NombreAgente, UsoAgente>>): UsoAgente {
  return sumarUso(...Object.values(uso));
}
