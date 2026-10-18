import type {
  Caso,
  DecisionAccion,
  EstadoUsuario,
  ReglaPolicy,
  RiesgoDestino,
} from '@/lib/contracts';
import { nivelDeScore } from '@/lib/rules/level0';

/**
 * Policy Engine determinista.
 *
 * Fuente: doc 19 §4. **Se evalúa en orden; la primera regla que aplica gana.**
 *
 * Es determinista a propósito (doc 15, R4): el LLM razona, pero no decide
 * sobre el dinero. Toda decisión queda con su regla, así es explicable y
 * auditable (CU-01/02/03, criterio de aceptación).
 *
 * Dueño: Ale_dev.
 */

export interface EntradaPolicy {
  /** ¿La Memoria tiene a la cuenta destino como mula confirmada y vigente? */
  mulaEnMemoria: boolean;
  /**
   * ¿OTRO banco de la red regional la confirmó como mula (vigente)? Pesa menos
   * que un veredicto propio: retiene, pero no escala por sí solo (P1R).
   */
  mulaEnRed?: boolean;
  /** Atajo de las reglas nivel 0 (P2: beneficiario habitual sin compromiso). */
  atajo?: 'P1' | 'P2';
  score: number;
  /** Salida del Detective, si corrió. */
  riesgoDestino?: RiesgoDestino;
  /** Salida del Guardián, si corrió. */
  estadoUsuario?: EstadoUsuario;
  /**
   * El Guardián le hizo una pregunta al cliente y todavía no hay respuesta.
   * No es lo mismo que «no se invocó» (CU-05, no molestar): aquí hay una señal
   * del lado del cliente sin resolver, y el silencio no es aprobación.
   */
  guardianPendiente?: boolean;
  /** Error, timeout o presupuesto excedido → P10. */
  degradado?: boolean;
}

export interface ResultadoPolicy {
  accion: DecisionAccion;
  regla: ReglaPolicy;
  motivo: string;
}

const ESTADOS_NO_SEGUROS: EstadoUsuario[] = [
  'manipulacion_probable',
  'sin_respuesta',
  'canal_comprometido',
];

const ESTADOS_SIN_ALERTA: EstadoUsuario[] = ['confirmado_seguro', 'no_consultado'];

/**
 * Devuelve la primera regla que aplica.
 *
 * El orden de los `if` ES la especificación. No reordenar sin cambiar el doc 19.
 */
export function decide(entrada: EntradaPolicy): ResultadoPolicy {
  const { mulaEnMemoria, mulaEnRed, score, riesgoDestino, estadoUsuario, guardianPendiente, degradado } = entrada;
  // Un veredicto de la red anula el atajo P2: un beneficiario «de siempre» que
  // otro banco confirmó como mula no pasa sin verificar.
  const atajo = mulaEnRed && entrada.atajo === 'P2' ? undefined : entrada.atajo;

  // P10 se evalúa primero en la práctica porque un sistema degradado no puede
  // confiar en las salidas de los agentes. El doc lo lista al final porque es
  // el caso excepcional, pero su condición es excluyente de P4..P9.
  if (degradado) {
    return score >= 5
      ? {
          accion: 'PAUSAR',
          regla: 'P10',
          motivo: 'sistema degradado (error/timeout/presupuesto) con score alto → revisión humana',
        }
      : {
          accion: 'VERIFICAR',
          regla: 'P10',
          motivo: 'sistema degradado con score no alto → verificación',
        };
  }

  // P1 — destino en Memoria = mula confirmada. 0 llamadas de IA (CU-03).
  if (mulaEnMemoria || atajo === 'P1') {
    return {
      accion: 'ESCALAR',
      regla: 'P1',
      motivo: 'cuenta destino confirmada como mula en la Memoria de riesgo',
    };
  }

  // P1R — mula confirmada por OTRO banco de la red regional.
  //
  // Confianza graduada: un veredicto ajeno no tiene la evidencia de este banco,
  // así que no escala solo. Retiene siempre (nunca PERMITIR) y escala si el
  // cliente está en un estado no seguro. Con destino `alto` según NUESTRO
  // Detective sigue de largo hasta P4/P5, que escalan con evidencia propia.
  if (mulaEnRed && riesgoDestino !== 'alto') {
    const clienteEnRiesgo = estadoUsuario !== undefined && ESTADOS_NO_SEGUROS.includes(estadoUsuario);
    return clienteEnRiesgo
      ? {
          accion: 'ESCALAR',
          regla: 'P1R',
          motivo: `cuenta destino confirmada como mula por otro banco de la red y cliente en estado ${estadoUsuario}`,
        }
      : {
          accion: 'PAUSAR',
          regla: 'P1R',
          motivo: 'cuenta destino confirmada como mula por otro banco de la red; se retiene hasta verificar',
        };
  }

  // P2 — beneficiario habitual/recurrente sin señales de compromiso.
  // Es lo que deja pasar el pago del hotel de Lucía aunque ella no responda (CU-04).
  if (atajo === 'P2') {
    return {
      accion: 'PERMITIR',
      regla: 'P2',
      motivo: 'beneficiario habitual y sin señales de compromiso',
    };
  }

  // P3 — score bajo.
  //
  // ENDURECIMIENTO sobre el doc 19 §4: el doc pone P3 antes de P4, así que un
  // score bajo permitiría incluso con el Detective diciendo `alto`. Esa
  // combinación es INALCANZABLE en el pipeline (doc 19 §2: con score 0–2 se
  // permite sin IA, el Detective no corre), pero `decide()` es una función
  // pública y nada impide llamarla así.
  //
  // En una decisión sobre dinero el default correcto es fallar seguro, así que
  // P3 exige además que no haya un veredicto de riesgo alto. No cambia ningún
  // comportamiento alcanzable; solo evita que una llamada inconsistente libere
  // dinero. Ver tests/policy/engine.test.ts → "Estados inalcanzables".
  if (nivelDeScore(score) === 'bajo' && riesgoDestino !== 'alto' && !mulaEnRed) {
    return { accion: 'PERMITIR', regla: 'P3', motivo: `score ${score} en nivel bajo` };
  }

  // P4 — destino de alto riesgo y cliente en estado no seguro.
  if (riesgoDestino === 'alto' && estadoUsuario && ESTADOS_NO_SEGUROS.includes(estadoUsuario)) {
    return {
      accion: 'ESCALAR',
      regla: 'P4',
      motivo: `destino de riesgo alto y cliente en estado ${estadoUsuario}`,
    };
  }

  // P5 — destino de alto riesgo y el lado del cliente no desmiente nada.
  //
  // El doc 19 §4 escribe la condición como "Guardián `confirmado_seguro`",
  // pensando en el camino de transferencia. Aquí se amplía a **cualquier otro
  // estado**, porque faltaba un caso real: en la **Puerta B (alerta AML) no hay
  // cliente a quien preguntar**, así que `estadoUsuario` queda indefinido y el
  // caso caía hasta P10 pese a tener un destino de riesgo alto.
  //
  // Con esto, P4 y P5 cubren juntos TODO destino `alto`, que es el invariante
  // de seguridad que verifica el test "nunca permite cuando el destino es de
  // riesgo alto". El espíritu de P5 ya era ese: con destino alto se escala
  // aunque el lado del cliente parezca tranquilo (posible coerción, R7).
  if (riesgoDestino === 'alto') {
    return {
      accion: 'ESCALAR',
      regla: 'P5',
      motivo:
        estadoUsuario === 'confirmado_seguro'
          ? 'destino de riesgo alto aunque el cliente confirma; posible coerción'
          : 'destino de riesgo alto sin desmentido del lado del cliente',
    };
  }

  // P6 — manipulación probable con destino bajo/medio.
  if (estadoUsuario === 'manipulacion_probable') {
    return {
      accion: 'VERIFICAR',
      regla: 'P6',
      motivo: 'manipulación probable; cooldown y verificación fuera del canal',
    };
  }

  // P7 — cliente inalcanzable o canal comprometido, destino bajo/medio.
  // El silencio NO es aprobación (CU-04).
  if (
    estadoUsuario === 'sin_respuesta' ||
    estadoUsuario === 'canal_comprometido'
  ) {
    return {
      accion: 'PAUSAR',
      regla: 'P7',
      motivo: `cliente en estado ${estadoUsuario}; pausa hasta verificación por canal seguro`,
    };
  }

  // P7 (extensión) — el Guardián preguntó y el cliente aún no contesta.
  //
  // Sin esto, P8 trataba «pregunta sin responder» igual que «Guardián no
  // invocado» y LIBERABA el dinero: un «falso banco» (llamada activa, score 7)
  // hacia cualquier cuenta sin tipologías pasaba con la pregunta en pantalla.
  // Va después de P4/P5: con destino alto se escala igual. Cuando el cliente
  // responde, `responderGuardian` vuelve a decidir.
  if (guardianPendiente && !estadoUsuario) {
    return {
      accion: 'PAUSAR',
      regla: 'P7',
      motivo: 'esperando la respuesta del cliente; el silencio no es aprobación',
    };
  }

  // P8 — destino de riesgo bajo y cliente sin alertas → se libera (CU-05).
  if (
    riesgoDestino === 'bajo' &&
    (!estadoUsuario || ESTADOS_SIN_ALERTA.includes(estadoUsuario))
  ) {
    return {
      accion: 'PERMITIR',
      regla: 'P8',
      motivo: 'destino de riesgo bajo y cliente sin señales de alerta',
    };
  }

  // P9 — destino de riesgo medio y cliente sin alertas.
  if (
    riesgoDestino === 'medio' &&
    (!estadoUsuario || ESTADOS_SIN_ALERTA.includes(estadoUsuario))
  ) {
    return {
      accion: 'VERIFICAR',
      regla: 'P9',
      motivo: 'destino de riesgo medio; cooldown corto',
    };
  }

  // Sin información suficiente de los agentes y score no bajo: no se asume
  // que esté bien. Se degrada a P10, que es el caso conservador del doc.
  return score >= 5
    ? {
        accion: 'PAUSAR',
        regla: 'P10',
        motivo: 'sin salida concluyente de los agentes y score alto → revisión humana',
      }
    : {
        accion: 'VERIFICAR',
        regla: 'P10',
        motivo: 'sin salida concluyente de los agentes → verificación',
      };
}

/** Conveniencia: decide a partir de un Caso ya armado. */
export function decideCaso(caso: Caso, mulaEnMemoria: boolean, degradado = false, mulaEnRed = false): ResultadoPolicy {
  return decide({
    mulaEnMemoria,
    mulaEnRed,
    atajo: caso.nivel0.atajo,
    score: caso.nivel0.score,
    riesgoDestino: caso.salidas.detective?.riesgo_destino,
    estadoUsuario: caso.salidas.guardian?.estado_usuario,
    degradado,
  });
}
