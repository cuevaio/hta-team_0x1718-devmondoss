import { DIAS_VIGENCIA_VEREDICTO, veredictoVigente, type Veredicto } from '@/lib/contracts';

/**
 * 🧠 Memoria de riesgo.
 *
 * Fuente: doc 19 §5. Es el puente fraude ↔ AML y lo que protege a la
 * siguiente víctima (CU-03).
 *
 * Tres invariantes que el store hace cumplir:
 *  1. Solo entra lo validado por un humano (doc 15, R10) → `validado_por`.
 *  2. Todo veredicto expira (90 días por defecto).
 *  3. El efecto es PAUSAR para verificación, nunca confiscar.
 *
 * Dueño: Ale_dev. Los agentes la ven como solo lectura (`ToolContext.memoria`).
 */

export class MemoriaRiesgo {
  private registro = new Map<string, Veredicto>();

  /** Devuelve el veredicto solo si está vigente. Un expirado es como no tenerlo. */
  get(cuenta: string, hoy: Date = new Date()): Veredicto | null {
    const v = this.registro.get(cuenta);
    if (!v) return null;
    return veredictoVigente(v, hoy) ? v : null;
  }

  /**
   * Registra un veredicto validado por un analista.
   *
   * Lanza si no hay validador: es la barrera contra que el sistema se
   * autoalimente con sus propias conclusiones (R10).
   */
  confirm(cuenta: string, veredicto: Veredicto): void {
    if (!veredicto.validado_por?.trim()) {
      throw new Error(
        `Memoria: el veredicto de ${cuenta} no tiene validado_por. ` +
          'Solo entra lo confirmado por un humano (doc 15, R10).',
      );
    }
    if (veredicto.cuenta !== cuenta) {
      throw new Error(
        `Memoria: inconsistencia, se confirma ${cuenta} con un veredicto de ${veredicto.cuenta}.`,
      );
    }
    this.registro.set(cuenta, veredicto);
  }

  /** ¿Es mula confirmada y vigente? Es la condición de P1. */
  esMulaConfirmada(cuenta: string, hoy: Date = new Date()): boolean {
    return this.get(cuenta, hoy)?.veredicto === 'mula_confirmada';
  }

  /** Abre una apelación: suspende la vigencia sin borrar el registro. */
  abrirApelacion(cuenta: string): void {
    const v = this.registro.get(cuenta);
    if (v) this.registro.set(cuenta, { ...v, apelacion_abierta: true });
  }

  todos(): Veredicto[] {
    return [...this.registro.values()];
  }

  /** Para `/api/demo/reset`. */
  limpiar(): void {
    this.registro.clear();
  }

  get cantidad(): number {
    return this.registro.size;
  }
}

/**
 * Construye un veredicto con la expiración calculada.
 * `validado_por` es obligatorio en la firma: no se puede olvidar.
 */
export function crearVeredicto(params: {
  cuenta: string;
  veredicto: Veredicto['veredicto'];
  validado_por: string;
  expediente: string;
  hoy?: Date;
  dias?: number;
}): Veredicto {
  const hoy = params.hoy ?? new Date();
  const dias = params.dias ?? DIAS_VIGENCIA_VEREDICTO;
  const expira = new Date(hoy.getTime() + dias * 86_400_000);
  return {
    cuenta: params.cuenta,
    veredicto: params.veredicto,
    validado_por: params.validado_por,
    fecha: hoy.toISOString().slice(0, 10),
    expira: expira.toISOString().slice(0, 10),
    expediente: params.expediente,
    apelacion_abierta: false,
  };
}

/** Instancia de proceso. Sin base de datos en el MVP (blueprint §2). */
export const memoria = new MemoriaRiesgo();
