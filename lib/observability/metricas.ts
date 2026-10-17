import type { Caso, DecisionAccion } from '@/lib/contracts';
import { validarCitasAuditor } from '@/lib/contracts';
import { retieneDinero } from '@/lib/cases/store';

/**
 * Métricas del doc 14, calculadas SOLO desde los casos registrados.
 *
 * Funciones puras: reciben `Caso[]` y no leen ningún store, así se testean
 * sin estado global.
 *
 * Reglas de honestidad:
 *  - Un cociente sin denominador es `null`, no 0: "no medido" no es "cero".
 *  - Lo que exige una etiqueta de verdad (¿era fraude de verdad?) no se
 *    calcula aquí: el caso no la tiene. La tasa de falsos positivos sale de
 *    los evals de Tony (E7) sobre población etiquetada.
 *  - Las latencias son las del proceso que corrió. En modo simulado no hay
 *    LLM, así que no miden la latencia de un modelo real.
 *
 * Dueño: Ale_dev.
 */

const ratio = (a: number, b: number): number | null =>
  b === 0 ? null : Math.round((a / b) * 1000) / 1000;

const redondear6 = (n: number) => Math.round(n * 1e6) / 1e6;

function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const i = Math.min(orden.length - 1, Math.ceil((p / 100) * orden.length) - 1);
  return orden[Math.max(0, i)];
}

function contarPor(casos: Caso[], clave: (c: Caso) => string): Record<string, number> {
  return casos.reduce<Record<string, number>>((acc, c) => {
    const k = clave(c);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

// ── Embudo (forma histórica de /api/stats: no cambiar las claves) ──

export function embudo(casos: Caso[]) {
  return {
    transacciones_evaluadas: casos.length,
    sospechosas: casos.filter((c) => c.nivel0.score >= 3).length,
    con_llamadas_de_ia: casos.filter((c) => c.ia.llamadas > 0).length,
    llamadas_de_ia_totales: casos.reduce((s, c) => s + c.ia.llamadas, 0),
    costo_estimado_total: redondear6(casos.reduce((s, c) => s + c.ia.costo_estimado, 0)),
    por_regla: contarPor(casos, (c) => c.decision?.regla ?? 'sin_decision'),
  };
}

// ── Eficiencia de IA (doc 14) ──────────────────────────────────

/**
 * Doc 14 E6 — llamadas que la Memoria evitó. Es una ESTIMACIÓN y se publica
 * con su base para poder recalcularla.
 *
 * Contrafactual: un caso resuelto por P1 habría costado lo que costó
 * investigar ESA MISMA cuenta destino antes (promedio de los casos previos,
 * no resueltos por P1, que sí gastaron IA). No se usa el promedio global: una
 * bodega barata abarataría artificialmente lo que cuesta investigar una mula.
 * Un caso P1 sin investigación previa comparable no se estima.
 */
export function llamadasEvitadasPorMemoria(casos: Caso[]) {
  let estimado = 0;
  let conBase = 0;
  casos.forEach((c, i) => {
    if (c.decision?.regla !== 'P1') return;
    const previos = casos
      .slice(0, i)
      .filter(
        (p) =>
          p.transaccion.destino === c.transaccion.destino &&
          p.decision?.regla !== 'P1' &&
          p.ia.llamadas > 0,
      );
    if (previos.length === 0) return;
    conBase++;
    estimado += previos.reduce((s, p) => s + p.ia.llamadas, 0) / previos.length;
  });
  const p1 = casos.filter((c) => c.decision?.regla === 'P1').length;
  return {
    estimado: conBase === 0 ? null : Math.round(estimado * 100) / 100,
    casos_p1: p1,
    casos_p1_con_base: conBase,
    base: 'por cada caso P1: promedio de llamadas de IA de los casos previos al mismo destino',
  };
}

export function eficienciaIA(casos: Caso[]) {
  const decididos = casos.filter((c) => c.decision);
  const conIA = casos.filter((c) => c.ia.llamadas > 0);
  const porMemoria = decididos.filter((c) => c.decision?.regla === 'P1');
  const llamadasConIA = conIA.reduce((s, c) => s + c.ia.llamadas, 0);

  return {
    pct_transacciones_con_ia: ratio(conIA.length, casos.length),
    llamadas_por_caso_con_ia:
      conIA.length === 0 ? null : Math.round((llamadasConIA / conIA.length) * 100) / 100,
    tokens_totales: casos.reduce((s, c) => s + c.ia.tokens, 0),
    casos_resueltos_sin_ia: decididos.filter((c) => c.ia.llamadas === 0).length,
    resueltos_por_memoria: porMemoria.length,
    /** La Memoria se consulta en todo caso, así que el denominador es el total decidido. */
    hit_rate_memoria: ratio(porMemoria.length, decididos.length),
    llamadas_evitadas_por_memoria: llamadasEvitadasPorMemoria(casos),
  };
}

// ── Modo seguro (doc 14: "tasa de fallos de agente que caen al modo seguro") ──

const EVENTOS_DE_FALLA = new Set(['error_agentes', 'error_auditor', 'presupuesto_excedido']);

export function modoSeguro(casos: Caso[]) {
  const conFalla = casos.filter((c) => c.timeline.some((e) => EVENTOS_DE_FALLA.has(e.evento)));
  const p10 = casos.filter((c) => c.decision?.regla === 'P10');
  return {
    casos_con_falla_de_agente: conFalla.length,
    decididos_por_p10: p10.length,
    tasa_modo_seguro: ratio(p10.length, casos.filter((c) => c.decision).length),
  };
}

// ── Fricción ───────────────────────────────────────────────────

export function friccion(casos: Caso[]) {
  const decididos = casos.filter((c) => c.decision);
  const retenidos = decididos.filter((c) => retieneDinero(c.decision!.accion));
  return {
    permitidos: decididos.length - retenidos.length,
    retenidos: retenidos.length,
    tasa_de_retencion: ratio(retenidos.length, decididos.length),
    por_accion: contarPor(decididos, (c) => c.decision!.accion) as Partial<
      Record<DecisionAccion, number>
    >,
    /** Cuántas preguntas se le hicieron al cliente: cada una es fricción. */
    preguntas_al_cliente: casos.reduce(
      (s, c) => s + c.timeline.filter((e) => e.evento === 'pregunta').length,
      0,
    ),
  };
}

// ── Trazabilidad del expediente (doc 14: "% recomendaciones con evidencia completa") ──

export function trazabilidad(casos: Caso[]) {
  const auditados = casos.filter((c) => c.salidas.auditor);
  let afirmaciones = 0;
  let sinRespaldo = 0;
  let idsInexistentes = 0;
  let completos = 0;

  for (const c of auditados) {
    const salida = c.salidas.auditor!;
    const v = validarCitasAuditor(salida, c.evidencia);
    afirmaciones += salida.afirmaciones.length;
    sinRespaldo += v.afirmacionesSinRespaldo.length;
    idsInexistentes += v.idsInexistentes.length;
    if (v.valido) completos++;
  }

  return {
    expedientes: auditados.length,
    expedientes_con_evidencia_completa: completos,
    afirmaciones,
    afirmaciones_con_cita_valida: afirmaciones - sinRespaldo,
    pct_afirmaciones_citadas: ratio(afirmaciones - sinRespaldo, afirmaciones),
    /** Citas a un id E-xx que no existe en el caso: alucinaciones detectadas. */
    citas_inexistentes: idsInexistentes,
  };
}

// ── TTPA (doc 14: Time To Protective Action) ──────────────────

const tuvoPausa = (c: Caso) => c.timeline.some((e) => e.evento === 'pausa_preventiva');

/**
 * TTPA de un caso = t(primera acción que retiene el dinero) − t(caso creado).
 *
 * La acción protectora es la pausa preventiva si la hubo; si no, la decisión
 * (cuando retiene). Un caso PERMITIDO no tiene acción protectora: no se mide.
 *
 * El caso nace cuando llega la transacción con sus señales: es la "primera
 * señal material de riesgo" que ve esta capa.
 */
export function ttpaDe(caso: Caso): number | null {
  if (!caso.decision || !retieneDinero(caso.decision.accion)) return null;
  const creado = caso.timeline.find((e) => e.evento === 'caso_creado');
  if (!creado) return null;
  const pausa = caso.timeline.find((e) => e.evento === 'pausa_preventiva');
  const t = Date.parse(pausa?.t ?? caso.decision.t) - Date.parse(creado.t);
  return Number.isFinite(t) ? Math.max(0, t) : null;
}

export function ttpa(casos: Caso[]) {
  const medir = (grupo: Caso[]) => {
    const ms = grupo.map(ttpaDe).filter((x): x is number => x !== null);
    return { casos: ms.length, p50_ms: percentil(ms, 50), max_ms: percentil(ms, 100) };
  };
  return {
    con_pausa_preventiva: medir(casos.filter(tuvoPausa)),
    sin_pausa_preventiva: medir(casos.filter((c) => !tuvoPausa(c))),
    nota: 'ms del proceso que corrió; en modo simulado no incluye la latencia de un modelo real',
  };
}

// ── Todo junto ─────────────────────────────────────────────────

export function metricas(casos: Caso[]) {
  return {
    eficiencia_ia: eficienciaIA(casos),
    modo_seguro: modoSeguro(casos),
    friccion: friccion(casos),
    trazabilidad: trazabilidad(casos),
    ttpa: ttpa(casos),
  };
}
