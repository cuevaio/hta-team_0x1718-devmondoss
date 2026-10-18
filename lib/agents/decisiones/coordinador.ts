import type { NombreEspecialista, SalidaCoordinador } from '@/lib/contracts';
import type { Nivel0, Puerta } from '@/lib/contracts';

/**
 * 🧭 Coordinador — tabla de decisión determinista (0 llamadas de LLM).
 * Fuente: docs/context/tony_dev/AGENT_PLAYBOOKS.md §2
 */

export interface BriefingCoordinador {
  puerta: Puerta;
  score: number;
  senales: string[];
  atajo?: Nivel0['atajo'];
  /** El destino está en la Memoria como mula confirmada y vigente. */
  memoria_hit: boolean;
  /** Cuenta destino con historial largo y limpio (lo calcula quien arma el briefing). */
  destino_conocido_limpio: boolean;
  /** Otro banco de la red regional confirmó el destino como mula (vigente). */
  red_hit?: boolean;
  /** El destino está en otro país que el origen (pago interoperable). */
  destino_extranjero?: boolean;
}

const SENALES_CLIENTE = ['llamada_activa', 'dispositivo_nuevo', 'cambio_sim_o_clave'];
const SENALES_DESTINO = ['beneficiario_nuevo', 'monto_atipico'];

export function decidirCoordinador(b: BriefingCoordinador): SalidaCoordinador {
  // C1 — alerta AML: no hay cliente al otro lado
  if (b.puerta === 'alerta_aml') {
    return { salida_temprana: false, invocar: ['detective'], motivo: 'C1: alerta AML, solo investigar cuenta' };
  }
  // C2 — mula conocida: Policy aplica P1 sin gastar IA
  if (b.memoria_hit || b.atajo === 'P1') {
    return { salida_temprana: true, invocar: [], motivo: 'C2: destino en Memoria como mula confirmada' };
  }
  // C2R — mula confirmada por OTRO banco de la red. No hay salida temprana:
  // un veredicto ajeno no basta para escalar (P1R). Se verifica con el cliente
  // y el Detective junta evidencia propia. Va antes de C3: un beneficiario
  // habitual que la red marcó como mula no pasa por el atajo.
  if (b.red_hit) {
    return {
      salida_temprana: false,
      invocar: ['guardian', 'detective'],
      motivo: 'C2R: destino confirmado como mula por otro banco de la red regional; se verifica',
    };
  }
  // C3 — beneficiario habitual: Policy aplica P2
  if (b.atajo === 'P2') {
    return { salida_temprana: true, invocar: [], motivo: 'C3: beneficiario habitual sin señales de compromiso' };
  }

  const invocar = new Set<NombreEspecialista>();
  const motivos: string[] = [];

  // C4 — señales del lado del cliente
  const cliente = b.senales.filter((s) => SENALES_CLIENTE.includes(s));
  if (cliente.length > 0) {
    invocar.add('guardian');
    motivos.push(`C4: ${cliente.join(' + ')}`);
  }
  // C5 — destino sospechoso
  const destino = b.senales.filter((s) => SENALES_DESTINO.includes(s));
  if (!b.destino_conocido_limpio && destino.length > 0) {
    invocar.add('detective');
    motivos.push(`C5: ${destino.join(' + ')}, destino no conocido-limpio`);
  }
  // C5X — destino en otro país: este banco ve poco de esa cuenta, así que
  // siempre se mira (red regional y fan-in desde nuestros clientes).
  if (b.destino_extranjero && !invocar.has('detective')) {
    invocar.add('detective');
    motivos.push('C5X: destino en otro país');
  }
  // C6 — ninguna de las dos pero score alto: ser conservador
  if (invocar.size === 0 && b.score >= 3) {
    invocar.add('guardian');
    invocar.add('detective');
    motivos.push('C6: score ≥ 3 sin patrón claro, se invocan ambos');
  }

  return {
    salida_temprana: false,
    invocar: (['guardian', 'detective'] as const).filter((n) => invocar.has(n)),
    motivo: motivos.length > 0 ? motivos.join(' · ') : 'sin señales relevantes',
  };
}
