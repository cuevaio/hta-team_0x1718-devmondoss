import type { Caso } from '@/lib/contracts';
import { evaluarTransferencia, responderGuardian } from '@/lib/pipeline';
import { opcionDiferir } from '@/lib/diferir';

/**
 * «Ola de ataques» para el demo: el presentador lanza cientos de ataques a la
 * vez contra el sistema real (el mismo pipeline que usan los celulares) y el
 * monitor muestra en vivo cómo resiste: cuántos se frenaron, cuántos se
 * resolvieron con IA y cuántos en modo degradado (reglas + memoria) cuando el
 * modelo se satura.
 *
 * Mezcla realista: ~70% a cuentas mula (con llamada activa o celular nuevo a
 * veces) y ~30% pagos legítimos (bodega, hotel). Cuando el Guardián pregunta,
 * un tercio responde con texto libre (eso es lo que va al modelo).
 *
 * Datos sintéticos; el alias de los casos es «OLA».
 *
 * Dueño: Tony_dev (demo jugable).
 */

const MULAS = ['M-01', 'M-02', 'M-03'];
const LEGITIMOS: Array<{ origen: string; destino: string; monto: number }> = [
  { origen: 'C-ROSA', destino: 'B-PEPE', monto: 380 },
  { origen: 'C-LUCIA', destino: 'H-SOL', monto: 650 },
  { origen: 'C-JORGE', destino: 'B-PEPE', monto: 120 },
];
const CLIENTES = ['C-ROSA', 'C-JORGE', 'C-LUCIA'];
const MONTOS = [300, 1500, 3000, 4800];
const RESPUESTAS_LIBRES = [
  'sí, me están guiando por teléfono, dicen que son del banco',
  'no sé, me escribieron que era urgente',
  'es para mi sobrino que cambió de número',
  'nadie me llama, lo hago yo',
  'me dijeron que no le cuente a nadie',
];
const RESPUESTAS_RAPIDAS = ['SÍ, ME GUÍAN', 'NO, LO HAGO YO', ''];

const azar = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export interface EstadoOla {
  activa: boolean;
  lanzados: number;
  objetivo: number;
  completados: number;
  errores: number;
  /** Ataques a cuentas mula y cuántos quedaron retenidos (no PERMITIR). */
  a_mulas: number;
  mulas_retenidas: number;
  /** Pagos legítimos y cuántos pasaron (lo que no se debe bloquear). */
  legitimos: number;
  legitimos_pasaron: number;
  respuestas_guardian: number;
  casos_con_ia: number;
  por_regla: Record<string, number>;
  latencia_ms: { p50: number | null; p95: number | null };
  inicio: string | null;
  fin: string | null;
}

const vacio = (): EstadoOla => ({
  activa: false,
  lanzados: 0,
  objetivo: 0,
  completados: 0,
  errores: 0,
  a_mulas: 0,
  mulas_retenidas: 0,
  legitimos: 0,
  legitimos_pasaron: 0,
  respuestas_guardian: 0,
  casos_con_ia: 0,
  por_regla: {},
  latencia_ms: { p50: null, p95: null },
  inicio: null,
  fin: null,
});

const esperaPendiente = (c: Caso) => c.timeline.some((e) => e.evento === 'turno_pendiente') && !c.salidas.guardian;

export class Ola {
  private e: EstadoOla = vacio();
  private latencias: number[] = [];
  private enVuelo = 0;
  private detener = false;

  estado(): EstadoOla {
    const o = [...this.latencias].sort((a, b) => a - b);
    const p = (q: number) => (o.length ? Math.round(o[Math.min(o.length - 1, Math.floor(q * o.length))]) : null);
    return { ...structuredClone(this.e), latencia_ms: { p50: p(0.5), p95: p(0.95) } };
  }

  /** Lanza `n` ataques a `porSegundo`. Devuelve false si ya hay una ola en curso. */
  lanzar(n: number, porSegundo: number): boolean {
    if (this.e.activa) return false;
    this.e = { ...vacio(), activa: true, objetivo: n, inicio: new Date().toISOString() };
    this.latencias = [];
    this.detener = false;
    const intervalo = 1000 / porSegundo;
    let i = 0;
    const tic = () => {
      if (this.detener || i >= n) {
        if (this.enVuelo === 0) this.cerrar();
        return;
      }
      i++;
      this.e.lanzados++;
      void this.unAtaque();
      setTimeout(tic, intervalo);
    };
    tic();
    return true;
  }

  parar() {
    this.detener = true;
    if (this.enVuelo === 0 && this.e.activa) this.cerrar();
  }

  private cerrar() {
    this.e.activa = false;
    this.e.fin = new Date().toISOString();
  }

  private async unAtaque() {
    this.enVuelo++;
    const aMula = Math.random() < 0.7;
    const legit = azar(LEGITIMOS);
    const transaccion = aMula
      ? { origen: azar(CLIENTES), destino: azar(MULAS), monto: azar(MONTOS), moneda: 'PEN' as const }
      : { ...legit, moneda: 'PEN' as const };
    const contexto = aMula
      ? { llamada_activa_o_acceso_remoto: Math.random() < 0.5, dispositivo_nuevo_24h: Math.random() < 0.2 }
      : {};
    const t0 = Date.now();
    try {
      const { caso } = await evaluarTransferencia(transaccion, { contexto, alias: 'OLA', ...opcionDiferir() });
      let final = caso;
      if (esperaPendiente(caso)) {
        await new Promise((r) => setTimeout(r, 200 + Math.random() * 1200));
        const libre = Math.random() < 0.34;
        const r = await responderGuardian(caso.id, libre ? azar(RESPUESTAS_LIBRES) : azar(RESPUESTAS_RAPIDAS), opcionDiferir());
        this.e.respuestas_guardian++;
        if (r) final = r;
      }
      this.latencias.push(Date.now() - t0);
      if (this.latencias.length > 2000) this.latencias.shift();
      this.e.completados++;
      const regla = final.decision?.regla ?? 'sin_decision';
      this.e.por_regla[regla] = (this.e.por_regla[regla] ?? 0) + 1;
      if (final.ia.llamadas > 0) this.e.casos_con_ia++;
      const paso = final.decision?.accion === 'PERMITIR';
      if (aMula) {
        this.e.a_mulas++;
        if (!paso) this.e.mulas_retenidas++;
      } else {
        this.e.legitimos++;
        if (paso) this.e.legitimos_pasaron++;
      }
    } catch {
      this.e.errores++;
    } finally {
      this.enVuelo--;
      if (this.enVuelo === 0 && (this.detener || this.e.lanzados >= this.e.objetivo)) this.cerrar();
    }
  }
}

const g = globalThis as unknown as { __olaDemo?: Ola };
export const ola = (g.__olaDemo ??= new Ola());
