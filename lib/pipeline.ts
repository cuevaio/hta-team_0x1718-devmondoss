import type {
  AgentsApi,
  Caso,
  ContextoOperacion,
  Transaccion,
} from '@/lib/contracts';
import { aplicarConsistenciaDetective, MAX_LLAMADAS_POR_CASO } from '@/lib/contracts';
import { evaluateRules, requierePausaPreventiva } from '@/lib/rules/level0';
import { decide } from '@/lib/policy/engine';
import { memoria } from '@/lib/memory/store';
import { repo } from '@/lib/data/repo';
import { analytics } from '@/lib/analytics';
import { storeCasos, type CasoVivo } from '@/lib/cases/store';
import { construirToolContext, nuevoBuzon, type BuzonMensajes } from '@/lib/tool-context';
import {
  acumularIA,
  auditar,
  continuarGuardian,
  debeAuditar,
  investigar,
  obtenerAgentes,
} from '@/lib/agents';
import { MAX_TURNOS as MAX_TURNOS_GUARDIAN } from '@/lib/agents/decisiones/guardian';

/**
 * Pipeline de orquestación.
 *
 * Fuente: doc 19 §1. El orden NO es negociable:
 *
 *   reglas → [PAUSA PREVENTIVA] → Memoria → Coordinador
 *          → Guardián ∥ Detective → Policy → Auditor (asíncrono)
 *
 * Dos propiedades que el orden garantiza:
 *  - **TTPA ≈ 0**: con score alto se pausa ANTES de llamar a cualquier agente,
 *    así la latencia del LLM no expone dinero (CU-01, criterio de aceptación).
 *  - **El expediente no bloquea la pausa**: el Auditor corre después de que la
 *    decisión ya está tomada (CU-02, criterio de aceptación).
 *
 * Dueño: Ale_dev. Los agentes los provee Tony vía `AgentsApi`.
 */

export interface OpcionesPipeline {
  /** Implementación de agentes. Por defecto, los de Tony (`obtenerAgentes`: Claude o simulado). */
  agentes?: AgentsApi;
  /** Respuesta del cliente al Guardián, si el escenario la define. */
  respuestaCliente?: string;
  /** Contexto de la operación. Si no se pasa, se deriva de los datos. */
  contexto?: Partial<ContextoOperacion>;
  /** Fuerza el modo degradado para probar P10. */
  degradado?: boolean;
}

export interface ResultadoPipeline {
  caso: Caso;
  buzon: BuzonMensajes;
}

/**
 * Deriva el contexto de la operación desde los datos semilla.
 *
 * Solo mira propiedades de la OPERACIÓN (beneficiario, monto, dispositivo,
 * canal). Nunca atributos de la persona — doc 15, R1.
 */
export function derivarContexto(
  tx: Transaccion,
  override: Partial<ContextoOperacion> = {},
): ContextoOperacion {
  const cliente = repo.clientePorCuenta(tx.origen);
  const habitual = cliente?.beneficiarios_habituales.includes(tx.destino) ?? false;
  const yaTransfirio = repo.yaTransfirio(tx.origen, tx.destino);

  return {
    beneficiario_nuevo: !yaTransfirio && !habitual,
    monto_vs_promedio_90d: cliente ? tx.monto / cliente.promedio_90d : 1,
    dispositivo_nuevo_24h: false,
    cambio_sim_o_clave_72h: false,
    llamada_activa_o_acceso_remoto: false,
    horario_atipico: false,
    beneficiario_habitual: habitual,
    ...override,
  };
}

/** Puerta A — una transferencia del cliente. */
export async function evaluarTransferencia(
  tx: Transaccion,
  opciones: OpcionesPipeline = {},
): Promise<ResultadoPipeline> {
  const vivo = storeCasos.crear('transferencia', tx);
  return ejecutar(vivo, opciones);
}

/** Puerta B — una alerta AML. No hay cliente al otro lado: sin Guardián. */
export async function evaluarAlerta(
  cuenta: string,
  motivo: string,
  opciones: OpcionesPipeline = {},
): Promise<ResultadoPipeline> {
  const tx: Transaccion = { origen: 'monitoreo', destino: cuenta, monto: 1, moneda: 'PEN' };
  const vivo = storeCasos.crear('alerta_aml', tx);
  storeCasos.registrarEvento(vivo.caso.id, 'monitoreo', 'alerta_recibida', { motivo });
  return ejecutar(vivo, opciones);
}

async function ejecutar(vivo: CasoVivo, opciones: OpcionesPipeline): Promise<ResultadoPipeline> {
  const { caso, ledger } = vivo;
  const agentes = opciones.agentes ?? obtenerAgentes();
  const buzon = nuevoBuzon();
  const ctx = construirToolContext(ledger, buzon);
  const id = caso.id;
  const esAlerta = caso.puerta === 'alerta_aml';

  // ── 1. Reglas nivel 0 (sin IA) ──────────────────────────────
  if (!esAlerta) {
    caso.nivel0 = evaluateRules(caso.transaccion, derivarContexto(caso.transaccion, opciones.contexto));
  } else {
    // Una alerta AML entra ya marcada como sospechosa; no tiene señales de cliente.
    caso.nivel0 = { senales: ['alerta_aml'], score: 5 };
  }
  storeCasos.registrarEvento(id, 'reglas', 'nivel0_evaluado', caso.nivel0);

  // ── 2. Pausa preventiva: ANTES de cualquier llamada de IA ───
  if (requierePausaPreventiva(caso.nivel0.score)) {
    storeCasos.registrarEvento(id, 'sistema', 'pausa_preventiva', {
      score: caso.nivel0.score,
      nota: 'el dinero queda retenido antes de consultar a ningún agente (TTPA ≈ 0)',
    });
  }

  // ── 3. Memoria primero: P1 sin gastar IA (CU-03) ────────────
  const mulaEnMemoria = memoria.esMulaConfirmada(caso.transaccion.destino, repo.ahora());
  if (mulaEnMemoria) {
    storeCasos.registrarEvento(id, 'memoria', 'mula_confirmada', {
      cuenta: caso.transaccion.destino,
    });
    return finalizar(vivo, buzon, decide({ mulaEnMemoria: true, score: caso.nivel0.score }));
  }

  // ── 4. Atajos deterministas: P2 y P3 tampoco gastan IA ──────
  const preliminar = decide({
    mulaEnMemoria: false,
    atajo: caso.nivel0.atajo,
    score: caso.nivel0.score,
  });
  if (preliminar.regla === 'P2' || preliminar.regla === 'P3') {
    storeCasos.registrarEvento(id, 'policy', 'atajo_determinista', preliminar);
    return finalizar(vivo, buzon, preliminar);
  }

  // ── 5. Investigación: Coordinador → Guardián ∥ Detective ────
  //
  // Se usa el orquestador de Tony (lib/agents/orquestador.ts), no la AgentsApi
  // directa: nunca lanza, y si un agente falla deja su salida ausente y lo
  // reporta en `errores`, con lo que la Policy aplica P10. Ver lib/agents/README.md.
  let degradado = opciones.degradado ?? false;

  // `investigar` documenta que nunca lanza, pero puede lanzar de forma
  // SINCRÓNICA si el AgentsApi no cumple la interfaz (por ejemplo, un método
  // ausente: `agentes.detective is not a function`). En una decisión sobre
  // dinero eso no puede tumbar la request: se captura y se degrada a P10.
  let inv: Awaited<ReturnType<typeof investigar>> = {
    salidas: {},
    turnoGuardian: null,
    uso: {},
    errores: [],
  };
  try {
    inv = await investigar(caso, ctx, agentes);
  } catch (error) {
    degradado = true;
    storeCasos.registrarEvento(id, 'sistema', 'error_agentes', {
      agente: 'orquestador',
      mensaje: error instanceof Error ? error.message : String(error),
    });
  }

  caso.salidas = { ...caso.salidas, ...inv.salidas };
  caso.ia = acumularIA(caso.ia, inv.uso);

  if (inv.salidas.coordinador) {
    storeCasos.registrarEvento(id, 'coordinador', 'plan', inv.salidas.coordinador);
  }
  for (const e of inv.errores) {
    degradado = true;
    storeCasos.registrarEvento(id, 'sistema', 'error_agentes', e);
  }

  // CONTRACT (lib/agents/README.md): la evidencia tiene que estar en
  // `caso.evidencia` ANTES de la siguiente llamada — el Guardián reconstruye
  // la conversación desde ahí y el Auditor arma sus afirmaciones desde ahí.
  storeCasos.sincronizarEvidencia(id);

  if (caso.salidas.detective) {
    // Regla de consistencia: `alto` sin tipología marcada baja a `medio`.
    const { data: marcadas } = await ctx.analytics.tipologias_marcadas(caso.transaccion.destino);
    const ajuste = aplicarConsistenciaDetective(caso.salidas.detective, marcadas);
    caso.salidas.detective = ajuste.salida;
    storeCasos.registrarEvento(id, 'detective', 'riesgo_destino', ajuste.salida);
    if (ajuste.ajustado) {
      storeCasos.registrarEvento(id, 'sistema', 'consistencia_aplicada', { motivo: ajuste.motivo });
    }
  }

  // ── 6. Guardián multiturno ──────────────────────────────────
  //
  // `guardianTurno` puede devolver `terminado: false` con una pregunta
  // pendiente. El guion tiene máximo 3 turnos (MAX_TURNOS), así que se itera
  // hasta que termine. Una respuesta vacía significa "no contestó a tiempo",
  // que es lo que cierra la conversación cuando el buzón está vacío: el
  // silencio NO es aprobación.
  // Solo se itera mientras HAYA una respuesta disponible: la del escenario
  // (`respuestaCliente`) o una encolada en el buzón. Si no hay ninguna, el
  // turno queda PENDIENTE y lo continúa `POST /api/cases/[id]/guardian/reply`.
  //
  // Responder '' aquí sería incorrecto: convertiría "todavía no preguntamos"
  // en "el cliente no contestó" dentro de la misma request.
  let turno = inv.turnoGuardian;
  const cliente = clienteDe(caso);

  for (let i = 0; turno && !turno.terminado && i < MAX_TURNOS_GUARDIAN; i++) {
    if (turno.mensaje) {
      storeCasos.registrarEvento(id, 'guardian', 'pregunta', { mensaje: turno.mensaje });
    }

    const respuesta =
      opciones.respuestaCliente ?? (await ctx.mensajes.esperar(cliente, 0)) ?? null;
    if (respuesta === null) break; // sin respuesta disponible: queda pendiente

    let r: Awaited<ReturnType<typeof continuarGuardian>>;
    try {
      r = await continuarGuardian(caso, ctx, agentes, respuesta);
    } catch (error) {
      degradado = true;
      storeCasos.registrarEvento(id, 'sistema', 'error_agentes', {
        agente: 'guardian',
        mensaje: error instanceof Error ? error.message : String(error),
      });
      break;
    }
    caso.ia = acumularIA(caso.ia, { guardian: r.uso });
    if (r.error) {
      degradado = true;
      storeCasos.registrarEvento(id, 'sistema', 'error_agentes', { agente: 'guardian', mensaje: r.error });
      break;
    }
    storeCasos.sincronizarEvidencia(id);
    turno = r.turno;
  }

  if (turno?.terminado && turno.salida) {
    caso.salidas.guardian = turno.salida;
    storeCasos.registrarEvento(id, 'guardian', 'estado_usuario', turno.salida);
  } else if (turno && !turno.terminado) {
    // Queda una pregunta en el aire. No se asume NADA del lado del cliente:
    // sin salida del Guardián, la Policy decide con lo que tiene (con destino
    // de riesgo alto eso escala por P5, que es el lado seguro).
    storeCasos.registrarEvento(id, 'guardian', 'turno_pendiente', { mensaje: turno.mensaje });
  }

  // Presupuesto excedido → modo seguro (doc 19 §7, R13).
  if (caso.ia.llamadas > MAX_LLAMADAS_POR_CASO) {
    degradado = true;
    storeCasos.registrarEvento(id, 'sistema', 'presupuesto_excedido', {
      llamadas: caso.ia.llamadas,
      max: MAX_LLAMADAS_POR_CASO,
    });
  }

  // ── 7. Policy Engine determinista ───────────────────────────
  const resultado = decide({
    mulaEnMemoria: false,
    atajo: caso.nivel0.atajo,
    score: caso.nivel0.score,
    riesgoDestino: caso.salidas.detective?.riesgo_destino,
    estadoUsuario: caso.salidas.guardian?.estado_usuario,
    degradado,
  });

  // ── 8. Auditor: después de decidir, no bloquea la pausa ─────
  //
  // `debeAuditar` lo decide el orquestador: alerta AML, o decisión de
  // PAUSAR/ESCALAR. La acción protectora ya ocurrió mucho antes (pausa
  // preventiva), así que el expediente nunca retiene dinero.
  caso.decision = { accion: resultado.accion, regla: resultado.regla, t: new Date().toISOString() };
  if (debeAuditar(caso)) {
    storeCasos.sincronizarEvidencia(id);
    const a = await auditar(caso, ctx, agentes).catch((error: unknown) => ({
      salida: undefined,
      uso: { llamadas: 0, tokens: 0, ms: 0 },
      error: error instanceof Error ? error.message : String(error),
    }));
    caso.ia = acumularIA(caso.ia, { auditor: a.uso });
    if (a.salida) {
      caso.salidas.auditor = a.salida;
      storeCasos.registrarEvento(id, 'auditor', 'expediente', {
        recomendacion: a.salida.recomendacion,
        afirmaciones: a.salida.afirmaciones.length,
      });
    } else if (a.error) {
      storeCasos.registrarEvento(id, 'sistema', 'error_auditor', {
        mensaje: a.error,
        nota: 'el expediente falló pero la decisión ya estaba tomada',
      });
    }
  }

  return finalizar(vivo, buzon, resultado);
}

function finalizar(
  vivo: CasoVivo,
  buzon: BuzonMensajes,
  resultado: { accion: Caso['decision'] extends undefined ? never : NonNullable<Caso['decision']>['accion']; regla: NonNullable<Caso['decision']>['regla']; motivo: string },
): ResultadoPipeline {
  const { caso } = vivo;
  storeCasos.sincronizarEvidencia(caso.id);
  caso.decision = { accion: resultado.accion, regla: resultado.regla, t: new Date().toISOString() };
  storeCasos.registrarEvento(caso.id, 'policy', 'decision', resultado);
  return { caso, buzon };
}

/**
 * Continúa la conversación del Guardián con la respuesta del cliente.
 *
 * Lo usa `POST /api/cases/[id]/guardian/reply` para el modo de varios turnos:
 * el primer turno lo abre `evaluarTransferencia`, y cada respuesta posterior
 * entra por aquí. Si el Guardián cierra, se vuelve a decidir y, si corresponde,
 * se genera el expediente.
 *
 * El Guardián reconstruye la conversación desde `caso.evidencia`
 * (lib/agents/README.md), así que basta con un buzón nuevo.
 */
export async function responderGuardian(
  casoId: string,
  texto: string,
  opciones: Pick<OpcionesPipeline, 'agentes'> = {},
): Promise<Caso | null> {
  const vivo = storeCasos.get(casoId);
  if (!vivo) return null;

  const { caso, ledger } = vivo;
  const agentes = opciones.agentes ?? obtenerAgentes();
  const buzon = nuevoBuzon();
  const ctx = construirToolContext(ledger, buzon);
  let degradado = false;

  storeCasos.registrarEvento(casoId, 'cliente', 'respuesta_guardian', { texto });
  storeCasos.sincronizarEvidencia(casoId);

  let r: Awaited<ReturnType<typeof continuarGuardian>>;
  try {
    r = await continuarGuardian(caso, ctx, agentes, texto);
  } catch (error) {
    storeCasos.registrarEvento(casoId, 'sistema', 'error_agentes', {
      agente: 'guardian',
      mensaje: error instanceof Error ? error.message : String(error),
    });
    return caso;
  }

  caso.ia = acumularIA(caso.ia, { guardian: r.uso });
  storeCasos.sincronizarEvidencia(casoId);

  if (r.error) {
    degradado = true;
    storeCasos.registrarEvento(casoId, 'sistema', 'error_agentes', {
      agente: 'guardian',
      mensaje: r.error,
    });
  } else if (r.turno?.terminado && r.turno.salida) {
    caso.salidas.guardian = r.turno.salida;
    storeCasos.registrarEvento(casoId, 'guardian', 'estado_usuario', r.turno.salida);
  } else if (r.turno?.mensaje) {
    // Sigue preguntando: la UI muestra el mensaje y vuelve a llamar.
    storeCasos.registrarEvento(casoId, 'guardian', 'pregunta', { mensaje: r.turno.mensaje });
    return caso;
  }

  // El Guardián cerró (o falló): se decide de nuevo con la información nueva.
  const resultado = decide({
    mulaEnMemoria: memoria.esMulaConfirmada(caso.transaccion.destino, repo.ahora()),
    atajo: caso.nivel0.atajo,
    score: caso.nivel0.score,
    riesgoDestino: caso.salidas.detective?.riesgo_destino,
    estadoUsuario: caso.salidas.guardian?.estado_usuario,
    degradado,
  });
  caso.decision = { accion: resultado.accion, regla: resultado.regla, t: new Date().toISOString() };
  storeCasos.registrarEvento(casoId, 'policy', 'decision', resultado);

  if (debeAuditar(caso) && !caso.salidas.auditor) {
    const a = await auditar(caso, ctx, agentes).catch((error: unknown) => ({
      salida: undefined,
      uso: { llamadas: 0, tokens: 0, ms: 0 },
      error: error instanceof Error ? error.message : String(error),
    }));
    caso.ia = acumularIA(caso.ia, { auditor: a.uso });
    if (a.salida) {
      caso.salidas.auditor = a.salida;
      storeCasos.registrarEvento(casoId, 'auditor', 'expediente', {
        recomendacion: a.salida.recomendacion,
        afirmaciones: a.salida.afirmaciones.length,
      });
    }
  }

  return caso;
}

/** Id de cliente dueño de la cuenta origen; '' si no hay (Puerta B). */
function clienteDe(caso: Caso): string {
  return repo.clientePorCuenta(caso.transaccion.origen)?.id ?? '';
}

/** Embudo y consumo de IA para `/api/stats`. */
export function estadisticas() {
  const casos = storeCasos.todos();
  const sospechosas = casos.filter((c) => c.nivel0.score >= 3);
  const conIA = casos.filter((c) => c.ia.llamadas > 0);
  return {
    transacciones_evaluadas: casos.length,
    sospechosas: sospechosas.length,
    con_llamadas_de_ia: conIA.length,
    llamadas_de_ia_totales: casos.reduce((s, c) => s + c.ia.llamadas, 0),
    costo_estimado_total: Math.round(casos.reduce((s, c) => s + c.ia.costo_estimado, 0) * 1e6) / 1e6,
    por_regla: casos.reduce<Record<string, number>>((acc, c) => {
      const r = c.decision?.regla ?? 'sin_decision';
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {}),
    mulas_en_memoria: memoria.cantidad,
    nota_datos: repo.notaDatos(),
  };
}

export { analytics, memoria, storeCasos };
