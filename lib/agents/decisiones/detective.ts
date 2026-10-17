import type {
  ResultadoCiclos,
  ResultadoEstructuracion,
  ResultadoFanIn,
  ResultadoListas,
  ResultadoPerfil,
  ResultadoReenvio,
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
  | 'ciclos';

/** Lo que han devuelto las tools hasta ahora (todo opcional: se llenan por pasos). */
export interface Hallazgos {
  perfil?: ResultadoPerfil;
  listas?: ResultadoListas;
  fan_in?: ResultadoFanIn;
  reenvio?: ResultadoReenvio;
  estructuracion?: ResultadoEstructuracion;
  ciclos?: ResultadoCiclos;
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
  return paso2;
}

export function tipologiasMarcadas(h: Hallazgos): Tipologia[] {
  const t: Tipologia[] = [];
  if (h.fan_in?.marcado) t.push('fan_in');
  if (h.reenvio?.marcado) t.push('reenvio_rapido');
  if (h.estructuracion?.marcado) t.push('estructuracion');
  if (h.ciclos?.marcado) t.push('circular');
  if (h.listas?.en_lista) t.push('en_lista');
  return t;
}

/** Tabla de riesgo base. Cuenta externa: se limita a `medio` salvo que esté en lista. */
export function riesgoBase(tipologias: Tipologia[], bancoPropio = true): RiesgoDestino {
  const t = new Set(tipologias);
  let riesgo: RiesgoDestino;
  if (t.has('en_lista') || t.has('circular') || (t.has('fan_in') && t.has('reenvio_rapido'))) {
    riesgo = 'alto';
  } else if (t.size > 0) {
    riesgo = 'medio';
  } else {
    riesgo = 'bajo';
  }
  if (!bancoPropio && riesgo === 'alto' && !t.has('en_lista')) return 'medio';
  return riesgo;
}

/** Solo el caso ambiguo justifica una llamada al modelo. */
export function requiereLLMDetective(base: RiesgoDestino): boolean {
  return base === 'medio';
}

export function plantillaHipotesis(tipologias: Tipologia[], riesgo: RiesgoDestino): string {
  const t = new Set(tipologias);
  if (t.has('en_lista')) return 'Cuenta presente en lista de riesgo';
  if (t.has('circular')) return 'Movimiento circular de fondos entre cuentas relacionadas';
  if (t.has('fan_in') && t.has('reenvio_rapido')) {
    return 'Cuenta de paso (posible mula): recibe de varios remitentes nuevos y reenvía rápido';
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

/** Arma la `SalidaDetective` final. El LLM, si participó, solo puede bajar de `medio` a `bajo`. */
export function ensamblarDetective(e: EntradaEnsamblado): SalidaEnsambladoDetective {
  const tipologias = tipologiasMarcadas(e.hallazgos);
  const base = riesgoBase(tipologias, e.hallazgos.perfil?.banco_propio ?? true);

  let riesgo: RiesgoDestino = base;
  let hipotesis = plantillaHipotesis(tipologias, base);
  let evidencia = e.evidencia;

  if (base === 'medio' && e.llm) {
    riesgo = e.llm.riesgo_destino; // el esquema ya impide 'alto'
    hipotesis = e.llm.hipotesis;
    const citadas = e.llm.evidencia.filter((id) => e.evidencia.includes(id));
    if (citadas.length > 0) evidencia = citadas;
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
