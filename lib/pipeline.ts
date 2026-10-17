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
import { obtenerAgentes } from '@/lib/agents';

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

  // ── 5. Coordinador: decide qué especialistas hacen falta ────
  let degradado = opciones.degradado ?? false;
  try {
    const { salida, uso } = await agentes.coordinador(caso, ctx);
    caso.salidas.coordinador = salida;
    storeCasos.sumarUso(id, uso);
    storeCasos.registrarEvento(id, 'coordinador', 'plan', salida);

    if (!salida.salida_temprana) {
      // ── 6. Guardián ∥ Detective — dos requests CONCURRENTES ──
      // (no es parallel tool use: son dos llamadas distintas al modelo)
      const quiere = new Set(salida.invocar);
      const [guardian, detective] = await Promise.all([
        quiere.has('guardian') && !esAlerta
          ? agentes.guardianTurno(caso, ctx, opciones.respuestaCliente)
          : null,
        quiere.has('detective') ? agentes.detective(caso, ctx) : null,
      ]);

      if (guardian) {
        storeCasos.sumarUso(id, guardian.uso);
        // CONTRACT: guardianTurno devuelve TurnoGuardian. Solo cuando
        // `terminado` es true viene la SalidaGuardian final.
        if (guardian.salida.terminado && guardian.salida.salida) {
          caso.salidas.guardian = guardian.salida.salida;
          storeCasos.registrarEvento(id, 'guardian', 'estado_usuario', guardian.salida.salida);
        } else {
          storeCasos.registrarEvento(id, 'guardian', 'turno_pendiente', {
            mensaje: guardian.salida.mensaje,
          });
        }
      }

      if (detective) {
        storeCasos.sincronizarEvidencia(id);
        // Regla de consistencia: `alto` sin tipología marcada baja a `medio`.
        const { data: marcadas } = await ctx.analytics.tipologias_marcadas(caso.transaccion.destino);
        const ajuste = aplicarConsistenciaDetective(detective.salida, marcadas);
        caso.salidas.detective = ajuste.salida;
        storeCasos.sumarUso(id, detective.uso);
        storeCasos.registrarEvento(id, 'detective', 'riesgo_destino', ajuste.salida);
        if (ajuste.ajustado) {
          storeCasos.registrarEvento(id, 'sistema', 'consistencia_aplicada', {
            motivo: ajuste.motivo,
          });
        }
      }
    }
  } catch (error) {
    degradado = true;
    storeCasos.registrarEvento(id, 'sistema', 'error_agentes', {
      mensaje: error instanceof Error ? error.message : String(error),
    });
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
  if (['PAUSAR', 'ESCALAR'].includes(resultado.accion) || esAlerta) {
    storeCasos.sincronizarEvidencia(id);
    try {
      const { salida, uso } = await agentes.auditor(caso, ctx);
      caso.salidas.auditor = salida;
      storeCasos.sumarUso(id, uso);
      storeCasos.registrarEvento(id, 'auditor', 'expediente', {
        recomendacion: salida.recomendacion,
        afirmaciones: salida.afirmaciones.length,
      });
    } catch (error) {
      storeCasos.registrarEvento(id, 'sistema', 'error_auditor', {
        mensaje: error instanceof Error ? error.message : String(error),
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
