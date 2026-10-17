import type { Evidencia } from '@/lib/contracts';

/**
 * Ledger de evidencia.
 *
 * Los ids `E-xx` los asigna el SISTEMA, nunca el LLM (doc 19 §3).
 * Es la pieza que hace verificable el expediente del Auditor: si una
 * afirmación cita un id que este ledger no emitió, es alucinación.
 *
 * Un ledger por caso. No es global: dos casos concurrentes no comparten
 * numeración.
 *
 * Dueño: Ale_dev.
 */
export class LedgerEvidencia {
  private siguiente = 1;
  private registro: Evidencia[] = [];

  /** Registra un hecho calculado y devuelve su evidencia con id asignado. */
  registrar(fuente: string, dato: unknown): Evidencia {
    const evidencia: Evidencia = {
      id: `E-${String(this.siguiente++).padStart(2, '0')}`,
      fuente,
      dato,
    };
    this.registro.push(evidencia);
    return evidencia;
  }

  /** Toda la evidencia emitida, en orden. */
  todas(): Evidencia[] {
    return [...this.registro];
  }

  /** ¿Este ledger emitió ese id? Base del control antialucinación. */
  existe(id: string): boolean {
    return this.registro.some((e) => e.id === id);
  }

  get cantidad(): number {
    return this.registro.length;
  }
}
