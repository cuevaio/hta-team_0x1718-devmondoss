import type {
  ResultadoCiclos,
  ResultadoEstructuracion,
  ResultadoFanIn,
  ResultadoListas,
  ResultadoPerfil,
  ResultadoRed,
  ResultadoReenvio,
  ResultadoTransfronterizo,
  RiesgoDestino,
  SalidaDetective,
  Tipologia,
} from '@/lib/contracts';
import { aplicarConsistenciaDetective } from '@/lib/contracts';
import type { DetectiveLLM } from '../esquemas';

/**
 * 🔍 Detective — plan de tools fijo, riesgo base por tabla, LLM solo si es `medio`.
 * Fuente: docs/context/tony_dev/AGENT_PLAYBOOKS.md §3
 */

export type ToolDetective =
  | 'perfil_cuenta'
  | 'listas_riesgo'
  | 'fan_in'
  | 'reenvio_rapido'
  | 'estructuracion'
  | 'ciclos'
  | 'reenvio_transfronterizo'
  | 'red_regional';

/** Lo que han devuelto las tools hasta ahora (todo opcional: se llenan por pasos). */
export interface Hallazgos {
  perfil?: ResultadoPerfil;
  listas?: ResultadoListas;
  fan_in?: ResultadoFanIn;
  reenvio?: ResultadoReenvio;
  estructuracion?: ResultadoEstructuracion;
  ciclos?: ResultadoCiclos;
  transfronterizo?: ResultadoTransfronterizo;
  /** Solo se pide si la red tiene algo sobre la cuenta (ver detective.ts). */
  red?: ResultadoRed;
}

/**
 * Siguiente tanda de tools. Devuelve `[]` cuando el plan terminó: es la
 * condición de parada (máx. 2 pasos, sin loops agénticos).
 *
 * `estructuracion` corre siempre en el paso 2: mira si la CUENTA DESTINO recibe
 * muchas operaciones justo bajo el umbral de reporte, algo que no depende del
 * monto de esta transferencia. Es una tool determinista: no gasta IA.
 */
export function siguientesTools(h: Hallazgos): ToolDetective[] {
  // PASO 1 — todo en paralelo, siempre
  if (!h.perfil || !h.listas || !h.fan_in || !h.reenvio) {
    return (['perfil_cuenta', 'listas_riesgo', 'fan_in', 'reenvio_rapido'] as const).filter(
      (t) =>
        (t === 'perfil_cuenta' && !h.perfil) ||
        (t === 'listas_riesgo' && !h.listas) ||
        (t === 'fan_in' && !h.fan_in) ||
        (t === 'reenvio_rapido' && !h.reenvio),
    );
  }
  // En lista de riesgo: ya es alto, no hace falta más
  if (h.listas.en_lista) return [];
  // PASO 2
  const paso2: ToolDetective[] = [];
  if (h.reenvio.marcado && !h.ciclos) paso2.push('ciclos');
  if (!h.estructuracion) paso2.push('estructuracion');
  // Si reenvía rápido, ¿hacia dónde? Una mula regional saca el dinero del país.
  if (h.reenvio.marcado && !h.transfronterizo) paso2.push('reenvio_transfronterizo');
  return paso2;
}

export function tipologiasMarcadas(h: Hallazgos): Tipologia[] {
  const t: Tipologia[] = [];
  if (h.fan_in?.marcado) t.push('fan_in');
  if (h.reenvio?.marcado) t.push('reenvio_rapido');
  if (h.estructuracion?.marcado) t.push('estructuracion');
  if (h.ciclos?.marcado) t.push('circular');
  if (h.listas?.en_lista) t.push('en_lista');
  if (h.transfronterizo?.marcado) t.push('transfronterizo');
  if (h.red?.en_red) t.push('en_red');
  return t;
}

/**
 * Tabla de riesgo base. Cuenta externa: se limita a `medio` salvo que esté en
 * lista o en la red.
 *
 * Red regional: `en_red` sola es `medio` (un veredicto ajeno no escala solo,
 * P1R); con cualquier hallazgo PROPIO pasa a `alto`. `transfronterizo` con
 * reenvío rápido es `alto`: es la mula que saca el dinero del país en horas.
 */
export function riesgoBase(tipologias: Tipologia[], bancoPropio = true): RiesgoDestino {
  const t = new Set(tipologias);
  const propias = tipologias.filter((x) => x !== 'en_red');
  let riesgo: RiesgoDestino;
  if (
    t.has('en_lista') ||
    t.has('circular') ||
    (t.has('fan_in') && t.has('reenvio_rapido')) ||
    (t.has('reenvio_rapido') && t.has('transfronterizo')) ||
    (t.has('en_red') && propias.length > 0)
  ) {
    riesgo = 'alto';
  } else if (t.size > 0) {
    riesgo = 'medio';
  } else {
    riesgo = 'bajo';
  }
  if (!bancoPropio && riesgo === 'alto' && !t.has('en_lista') && !t.has('en_red')) return 'medio';
  return riesgo;
}

/**
 * Solo el caso ambiguo justifica una llamada al modelo. Con `en_red` no hay
 * ambigüedad que resolver: el modelo no puede bajarla (no es descartable) y la
 * decisión la toma P1R. Llamarlo sería gastar IA sin efecto.
 */
export function requiereLLMDetective(base: RiesgoDestino, tipologias: Tipologia[] = []): boolean {
  return base === 'medio' && !tipologias.includes('en_red');
}

export function plantillaHipotesis(tipologias: Tipologia[], riesgo: RiesgoDestino): string {
  const t = new Set(tipologias);
  if (t.has('en_lista')) return 'Cuenta presente en lista de riesgo';
  if (t.has('circular')) return 'Movimiento circular de fondos entre cuentas relacionadas';
  if (t.has('reenvio_rapido') && t.has('transfronterizo')) {
    return 'Mula regional: recibe y saca el dinero a otro país en menos de 2 h';
  }
  if (t.has('fan_in') && t.has('reenvio_rapido')) {
    return 'Cuenta de paso (posible mula): recibe de varios remitentes nuevos y reenvía rápido';
  }
  if (t.has('en_red')) {
    return tipologias.length > 1
      ? 'Confirmada como mula por otro banco de la red, y con hallazgos propios que lo respaldan'
      : 'Confirmada como mula por otro banco de la red regional; sin hallazgos propios todavía';
  }
  if (riesgo === 'bajo') return 'Sin patrones de riesgo marcados por las tools';
  return `Patrón parcial (${tipologias.join(', ')}); sin evidencia suficiente para considerarla mula`;
}

export interface EntradaEnsamblado {
  hallazgos: Hallazgos;
  /** Ids de toda la evidencia que produjeron las tools. */
  evidencia: string[];
  cadena?: string[];
  /** Presente solo si el LLM fue llamado (riesgo base `medio`). */
  llm?: DetectiveLLM;
}

export interface SalidaEnsambladoDetective {
  salida: SalidaDetective;
  riesgoBase: RiesgoDestino;
  ajustado: boolean;
  motivoAjuste?: string;
}

/**
 * Tipologías que el LLM puede considerar un falso positivo. Solo `fan_in`: es
 * el caso de la Bodega (CU-05), muchos pagadores legítimos. Reenvío rápido,
 * estructuración, ciclo o lista NO se explican con «es un comercio».
 */
const DESCARTABLES_POR_LLM: ReadonlySet<Tipologia> = new Set(['fan_in']);

/** ¿Puede el LLM bajar este patrón a `bajo`? Lo decide el código, no el prompt. */
export function llmPuedeBajar(tipologias: Tipologia[]): boolean {
  return tipologias.every((t) => DESCARTABLES_POR_LLM.has(t));
}

/** Arma la `SalidaDetective` final. El LLM, si participó, solo puede bajar de `medio` a `bajo`. */
export function ensamblarDetective(e: EntradaEnsamblado): SalidaEnsambladoDetective {
  const tipologias = tipologiasMarcadas(e.hallazgos);
  const base = riesgoBase(tipologias, e.hallazgos.perfil?.banco_propio ?? true);

  let riesgo: RiesgoDestino = base;
  let hipotesis = plantillaHipotesis(tipologias, base);
  let evidencia = e.evidencia;

  if (base === 'medio' && e.llm) {
    // La regla 2 del prompt («baja solo si no hay reenvío rápido») se hace
    // cumplir AQUÍ: un `bajo` termina en P8 y libera el dinero, así que no puede
    // depender de que el modelo obedezca. Si el patrón no es descartable, el
    // riesgo se queda en `medio` aunque el modelo diga `bajo`.
    const bajaPermitida = e.llm.riesgo_destino !== 'bajo' || llmPuedeBajar(tipologias);
    if (bajaPermitida) {
      riesgo = e.llm.riesgo_destino; // el esquema ya impide 'alto'
      hipotesis = e.llm.hipotesis;
      const citadas = e.llm.evidencia.filter((id) => e.evidencia.includes(id));
      if (citadas.length > 0) evidencia = citadas;
    }
  }

  const cadena = e.cadena ?? e.hallazgos.reenvio?.destinos ?? [];
  const bruta: SalidaDetective = {
    riesgo_destino: riesgo,
    tipologias,
    hipotesis,
    cadena,
    evidencia,
  };
  const consistente = aplicarConsistenciaDetective(bruta, tipologias);
  return {
    salida: consistente.salida,
    riesgoBase: base,
    ajustado: consistente.ajustado,
    motivoAjuste: consistente.motivo,
  };
}
