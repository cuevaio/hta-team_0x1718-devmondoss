import { ErrorLlm, type LlmCaller } from './llm';

/**
 * Resistencia a la saturación del modelo (pensado para el demo, con cientos
 * de ataques a la vez contra un modelo local que atiende pocos pedidos).
 *
 *   - **Concurrencia acotada**: como mucho N llamadas al modelo a la vez.
 *   - **Cola con tope y espera máxima**: si no hay turno a tiempo, la llamada
 *     se rechaza YA como «saturado» (no reintentable). El agente cae a su
 *     fallback determinista y la Policy decide igual: el dinero sigue
 *     retenido, solo que sin la opinión del modelo (modo degradado).
 *   - **Cortacircuitos**: si el modelo acumula fallas (timeouts, errores),
 *     se deja de llamarlo unos segundos y después se prueba con un pedido.
 *
 * Así una ola de ataques nunca deja al servidor colgado esperando al modelo,
 * y lo que se mide (en vivo, en el monitor) es cuánto se resolvió con IA y
 * cuánto en modo degradado.
 */

export interface ConfigLimitador {
  /** Llamadas simultáneas al modelo. */
  concurrencia: number;
  /** Pedidos esperando turno, como mucho. */
  colaMax: number;
  /** Espera máxima por un turno (además, nunca más de la mitad del timeout del agente). */
  esperaMaxMs: number;
  /** Fallas en la ventana que abren el circuito. */
  umbralFallas: number;
  ventanaMs: number;
  /** Cuánto queda abierto el circuito antes de volver a probar. */
  pausaMs: number;
}

export type EstadoCircuito = 'cerrado' | 'abierto' | 'probando';

export interface EstadoCarga {
  concurrencia: number;
  en_curso: number;
  en_cola: number;
  atendidas: number;
  /** Rechazadas por no haber turno a tiempo (fueron a modo degradado). */
  saturadas: number;
  /** Rechazadas con el circuito abierto (fueron a modo degradado). */
  por_circuito: number;
  fallas: number;
  circuito: EstadoCircuito;
  latencia_ms: { p50: number | null; p95: number | null };
  /** Últimos 60 s: cuántas resolvió el modelo y cuántas fueron a modo degradado. */
  ultimo_minuto: { con_ia: number; degradadas: number };
}

export function configLimitadorDesdeEnv(modo: 'ollama' | 'claude', env: NodeJS.ProcessEnv = process.env): ConfigLimitador {
  const n = (v: string | undefined, def: number) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : def;
  };
  return {
    concurrencia: n(env.AGENTES_CONCURRENCIA, modo === 'ollama' ? 2 : 8),
    colaMax: n(env.AGENTES_COLA_MAX, modo === 'ollama' ? 12 : 40),
    esperaMaxMs: n(env.AGENTES_ESPERA_MAX_MS, 4_000),
    umbralFallas: 5,
    ventanaMs: 30_000,
    pausaMs: 15_000,
  };
}

export class SaturacionLlm extends ErrorLlm {
  constructor(motivo: string) {
    super(`modelo saturado: ${motivo}`, false);
    this.name = 'SaturacionLlm';
  }
}

type Esperando = { listo: () => void; cancelar: () => void };

export function limitar(caller: LlmCaller, cfg: ConfigLimitador, reloj: () => number = Date.now) {
  let enCurso = 0;
  const cola: Esperando[] = [];
  let atendidas = 0;
  let saturadas = 0;
  let porCircuito = 0;
  let fallas = 0;
  const fallasRecientes: number[] = [];
  let circuito: EstadoCircuito = 'cerrado';
  let abiertoHasta = 0;
  let sondaEnCurso = false;
  const latencias: number[] = [];
  const eventos: Array<{ t: number; ia: boolean }> = [];

  const registrar = (ia: boolean) => {
    const ahora = reloj();
    eventos.push({ t: ahora, ia });
    while (eventos.length && eventos[0].t < ahora - 60_000) eventos.shift();
  };

  const liberar = () => {
    enCurso--;
    const siguiente = cola.shift();
    if (siguiente) {
      enCurso++;
      siguiente.listo();
    }
  };

  const turno = (esperaMs: number) =>
    new Promise<void>((ok, falla) => {
      if (enCurso < cfg.concurrencia) {
        enCurso++;
        return ok();
      }
      if (cola.length >= cfg.colaMax) return falla(new SaturacionLlm('cola llena'));
      const item: Esperando = {
        listo: () => {
          clearTimeout(t);
          ok();
        },
        cancelar: () => falla(new SaturacionLlm('sin turno a tiempo')),
      };
      const t = setTimeout(() => {
        const i = cola.indexOf(item);
        if (i >= 0) cola.splice(i, 1);
        item.cancelar();
      }, esperaMs);
      cola.push(item);
    });

  const fallo = () => {
    fallas++;
    const ahora = reloj();
    fallasRecientes.push(ahora);
    while (fallasRecientes.length && fallasRecientes[0] < ahora - cfg.ventanaMs) fallasRecientes.shift();
    if (circuito === 'probando' || fallasRecientes.length >= cfg.umbralFallas) {
      circuito = 'abierto';
      abiertoHasta = ahora + cfg.pausaMs;
      fallasRecientes.length = 0;
    }
  };

  const limitado: LlmCaller = async (req) => {
    // Circuito abierto: ni se intenta (modo degradado inmediato).
    if (circuito === 'abierto') {
      if (reloj() < abiertoHasta) {
        porCircuito++;
        registrar(false);
        throw new SaturacionLlm('circuito abierto');
      }
      circuito = 'probando';
    }
    if (circuito === 'probando') {
      if (sondaEnCurso) {
        porCircuito++;
        registrar(false);
        throw new SaturacionLlm('probando si el modelo se recuperó');
      }
      sondaEnCurso = true;
    }
    const sonda = circuito === 'probando';
    const t0 = reloj();
    try {
      await turno(Math.min(cfg.esperaMaxMs, Math.floor(req.timeoutMs / 2)));
    } catch (e) {
      if (sonda) sondaEnCurso = false;
      saturadas++;
      registrar(false);
      throw e;
    }
    // El tiempo en cola se descuenta del timeout del agente.
    const restante = req.timeoutMs - (reloj() - t0);
    try {
      const r = await caller({ ...req, timeoutMs: Math.max(1_000, restante) });
      atendidas++;
      latencias.push(reloj() - t0);
      if (latencias.length > 200) latencias.shift();
      registrar(true);
      if (sonda) circuito = 'cerrado';
      return r;
    } catch (e) {
      // Una petición inválida (404, rechazo) no es culpa de la carga.
      if (!(e instanceof ErrorLlm) || e.reintentable) fallo();
      registrar(false);
      throw e;
    } finally {
      if (sonda) sondaEnCurso = false;
      liberar();
    }
  };

  const estado = (): EstadoCarga => {
    const o = [...latencias].sort((a, b) => a - b);
    const p = (q: number) => (o.length ? o[Math.min(o.length - 1, Math.floor(q * o.length))] : null);
    const ahora = reloj();
    const min = eventos.filter((e) => e.t >= ahora - 60_000);
    return {
      concurrencia: cfg.concurrencia,
      en_curso: enCurso,
      en_cola: cola.length,
      atendidas,
      saturadas,
      por_circuito: porCircuito,
      fallas,
      circuito: circuito === 'abierto' && ahora >= abiertoHasta ? 'probando' : circuito,
      latencia_ms: { p50: p(0.5), p95: p(0.95) },
      ultimo_minuto: { con_ia: min.filter((e) => e.ia).length, degradadas: min.filter((e) => !e.ia).length },
    };
  };

  return { caller: limitado, estado };
}
