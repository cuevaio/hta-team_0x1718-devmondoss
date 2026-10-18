import {
  VeredictoRed,
  veredictoVigente,
  type Emisor,
  type FichaCompartible,
  type Veredicto,
} from '@/lib/contracts';
import semillaJson from '@/lib/data/seed.json';
import type { Semilla } from '@/lib/data/types';

/**
 * 🌎 Red regional de veredictos.
 *
 * Con los pagos inmediatos interconectados entre países (TAPP, Bre-B, QR de
 * Bolivia, PIX), una mula confirmada en un banco puede recibir mañana desde
 * otro país. Cada banco que confirma una mula publica aquí su veredicto y una
 * ficha con los hechos de la CUENTA; los demás bancos la consultan.
 *
 * Reglas de la red, además de las de la Memoria:
 *  1. Solo se publica lo que validó un humano (R10), con su emisor.
 *  2. Confianza graduada: un veredicto de OTRO banco no escala por sí solo.
 *     Retiene y verifica (P1R); escalar exige evidencia propia (P4/P5).
 *  3. Nada del cliente sale del banco: la ficha no lleva la conversación del
 *     Guardián ni datos de la víctima (`FichaCompartible`).
 *  4. Sin eco: una ficha que solo repite un veredicto de la red queda marcada
 *     `basado_en_red` y no cuenta como confirmación independiente.
 *
 * En el MVP la red vive en este proceso y arranca con los veredictos
 * sintéticos de `seed.json`. Conectarla a un servicio compartido no cambia
 * esta interfaz.
 */

/** Este banco en la red. Sintético. */
export const BANCO_PROPIO: Emisor = { banco: 'pe-banco-demo', pais: 'pe' };

const esPropio = (e: Emisor) => e.banco === BANCO_PROPIO.banco;
const clave = (cuenta: string, e: Emisor) => `${cuenta}@${e.banco}`;

function semillaRed(): VeredictoRed[] {
  const crudo = (semillaJson as Semilla).red_regional ?? [];
  return crudo.flatMap((x) => {
    const v = VeredictoRed.safeParse(x);
    // R10 también en la red: sin validador, no entra.
    return v.success && v.data.veredicto.validado_por.trim() ? [v.data] : [];
  });
}

export class RedRegional {
  private registro = new Map<string, VeredictoRed>();

  constructor(private readonly inicial: () => VeredictoRed[] = semillaRed) {
    this.reiniciar();
  }

  /**
   * Publica el veredicto de ESTE banco. Solo mulas confirmadas: un descarte
   * retira la publicación propia sobre esa cuenta, si la había.
   */
  publicar(veredicto: Veredicto, ficha?: FichaCompartible): VeredictoRed | null {
    if (!veredicto.validado_por?.trim()) {
      throw new Error(`Red: el veredicto de ${veredicto.cuenta} no tiene validado_por (R10).`);
    }
    const k = clave(veredicto.cuenta, BANCO_PROPIO);
    if (veredicto.veredicto !== 'mula_confirmada') {
      this.registro.delete(k);
      return null;
    }
    const publicado: VeredictoRed = { veredicto: { ...veredicto, emisor: BANCO_PROPIO }, ficha };
    this.registro.set(k, publicado);
    return publicado;
  }

  /**
   * Mula confirmada y vigente por OTRO banco de la red. Lo propio ya está en
   * la Memoria local (P1); aquí solo se mira lo ajeno (P1R). Si varios bancos
   * la confirmaron, devuelve el más reciente.
   */
  deOtroBanco(cuenta: string, hoy: Date = new Date()): VeredictoRed | null {
    const vigentes = [...this.registro.values()].filter(
      (r) =>
        r.veredicto.cuenta === cuenta &&
        !esPropio(r.veredicto.emisor) &&
        r.veredicto.veredicto === 'mula_confirmada' &&
        veredictoVigente(r.veredicto, hoy),
    );
    return vigentes.sort((a, b) => b.veredicto.fecha.localeCompare(a.veredicto.fecha))[0] ?? null;
  }

  esMulaDeOtroBanco(cuenta: string, hoy: Date = new Date()): boolean {
    return this.deOtroBanco(cuenta, hoy) !== null;
  }

  todos(): VeredictoRed[] {
    return [...this.registro.values()].map((r) => structuredClone(r));
  }

  get cantidad(): number {
    return this.registro.size;
  }

  /** Para `/api/demo/reset`: vuelve a los veredictos de la semilla. */
  reiniciar(): void {
    this.registro.clear();
    for (const r of this.inicial()) this.registro.set(clave(r.veredicto.cuenta, r.veredicto.emisor), r);
  }
}

export const red = new RedRegional();
