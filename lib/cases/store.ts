import type { Caso, DecisionAccion, EventoTimeline, Puerta, Transaccion } from '@/lib/contracts';
import { LedgerEvidencia } from '@/lib/evidence/ledger';

/**
 * Store de casos + timeline.
 *
 * El `Caso` es el objeto que ve todo el sistema (doc 19 §6): la consola del
 * analista y el panel del cliente de la Fase 2 son vistas de esto mismo.
 *
 * Cada caso lleva su propio ledger de evidencia, así dos casos concurrentes
 * no comparten numeración `E-xx`.
 *
 * Dueño: Ale_dev.
 */

export interface CasoVivo {
  caso: Caso;
  ledger: LedgerEvidencia;
}

let contador = 0;

function nuevoId(): string {
  return `CASO-${String(++contador).padStart(4, '0')}`;
}

export class StoreCasos {
  private casos = new Map<string, CasoVivo>();
  /** Alias del jugador que originó el caso (modo juego). Fuera del `Caso`: no es parte del contrato. */
  private alias = new Map<string, string>();

  crear(puerta: Puerta, transaccion: Transaccion): CasoVivo {
    const caso: Caso = {
      id: nuevoId(),
      puerta,
      transaccion,
      nivel0: { senales: [], score: 0 },
      evidencia: [],
      salidas: {},
      timeline: [],
      ia: { llamadas: 0, tokens: 0, costo_estimado: 0 },
    };
    const vivo: CasoVivo = { caso, ledger: new LedgerEvidencia() };
    this.casos.set(caso.id, vivo);
    this.registrarEvento(caso.id, 'sistema', 'caso_creado', { puerta });
    return vivo;
  }

  get(id: string): CasoVivo | null {
    return this.casos.get(id) ?? null;
  }

  todos(): Caso[] {
    return [...this.casos.values()].map((v) => v.caso);
  }

  /** Asocia un alias (ya validado con `Alias`) a un caso. */
  etiquetar(id: string, alias: string): void {
    if (this.casos.has(id)) this.alias.set(id, alias);
  }

  aliasDe(id: string): string | null {
    return this.alias.get(id) ?? null;
  }

  /** Añade un evento al timeline. Es lo que el demo imprime y la UI mostrará. */
  registrarEvento(id: string, actor: string, evento: string, detalle?: unknown): void {
    const vivo = this.casos.get(id);
    if (!vivo) return;
    const e: EventoTimeline = {
      t: new Date().toISOString(),
      actor,
      evento,
      ...(detalle === undefined ? {} : { detalle }),
    };
    vivo.caso.timeline.push(e);
  }

  /** Sincroniza la evidencia del ledger hacia el caso. */
  sincronizarEvidencia(id: string): void {
    const vivo = this.casos.get(id);
    if (!vivo) return;
    vivo.caso.evidencia = vivo.ledger.todas();
  }

  /** Suma consumo de IA. El contador es visible en el demo (CU-03: Jorge = 0). */
  sumarUso(id: string, uso: { llamadas: number; tokens: number }): void {
    const vivo = this.casos.get(id);
    if (!vivo) return;
    vivo.caso.ia.llamadas += uso.llamadas;
    vivo.caso.ia.tokens += uso.tokens;
    vivo.caso.ia.costo_estimado = estimarCosto(vivo.caso.ia.tokens);
  }

  /** Retira un caso (la matriz de la suite en vivo, lib/demo/suite.ts, no deja 750 casos en el monitor). */
  quitar(id: string): void {
    this.casos.delete(id);
    this.alias.delete(id);
  }

  /** Para `/api/demo/reset`. */
  limpiar(): void {
    this.casos.clear();
    this.alias.clear();
    contador = 0;
  }

  get cantidad(): number {
    return this.casos.size;
  }
}

/**
 * Estimación gruesa de costo, solo para que el demo muestre un orden de
 * magnitud. Usa la tarifa de `claude-haiku-5-5` ($0.10 / $0.50 por millón) y
 * asume una mezcla 70/30 entrada-salida. **No es una cifra contable.**
 */
export function estimarCosto(tokens: number): number {
  const porMillon = 0.1 * 0.7 + 0.5 * 0.3;
  return Math.round((tokens / 1_000_000) * porMillon * 1e6) / 1e6;
}

/** Acciones que dejan el dinero retenido. */
export const ACCIONES_QUE_RETIENEN: DecisionAccion[] = ['PAUSAR', 'ESCALAR', 'VERIFICAR'];

export function retieneDinero(accion: DecisionAccion): boolean {
  return ACCIONES_QUE_RETIENEN.includes(accion);
}

export const storeCasos = new StoreCasos();
