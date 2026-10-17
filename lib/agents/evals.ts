import { crearAgentes } from './index';
import { investigar, continuarGuardian, auditar, debeAuditar } from './orquestador';
import { riesgoBase, tipologiasMarcadas, type Hallazgos } from './decisiones/detective';
import { casoDe, crearCtx, crearRunAgentFalso } from './simulacion';
import type { Caso, NombreAgente } from '@/lib/contracts';

/**
 * Evals de los agentes que NO necesitan API key. Datos 100% sintéticos.
 *   E7 — falsos positivos: "solo fan-in" vs. la tabla del Detective (fan-in + reenvío).
 *   Gasto — llamadas de LLM por escenario, para verificar AGENT_PLAYBOOKS §7.
 * E5 (1 agente vs. multiagente) necesita el LLM real: pendiente de ANTHROPIC_API_KEY.
 */

// ─────────────── E7 ───────────────

export interface ResultadoE7 {
  poblacion: { mulas: number; comercios: number; personas: number };
  soloFanIn: { mulasDetectadas: number; legitimasMarcadas: number };
  detective: { mulasDetectadas: number; legitimasMarcadas: number };
}

/** Población sintética determinista: mulas, comercios con mucho fan-in y personas normales. */
export function poblacionSintetica(n = { mulas: 20, comercios: 60, personas: 200 }) {
  const cuentas: { cuenta: string; esMula: boolean; h: Hallazgos }[] = [];
  const add = (cuenta: string, esMula: boolean, remitentes: number, pct: number) =>
    cuentas.push({
      cuenta,
      esMula,
      h: {
        fan_in: { cuenta, remitentes_nuevos: remitentes, ventana_horas: 48, marcado: remitentes >= 5 },
        reenvio: { cuenta, porcentaje_reenviado: pct, ventana_horas: 2, destinos: [], marcado: pct >= 0.7 },
      },
    });
  for (let i = 0; i < n.mulas; i++) add(`MULA-${i}`, true, 6 + (i % 12), 0.75 + (i % 5) * 0.05);
  for (let i = 0; i < n.comercios; i++) add(`COM-${i}`, false, 8 + (i % 40), (i % 10) / 100);
  for (let i = 0; i < n.personas; i++) add(`PER-${i}`, false, i % 6, (i % 7) / 10);
  return cuentas;
}

export function e7FalsosPositivos(): ResultadoE7 {
  const pob = poblacionSintetica();
  const r: ResultadoE7 = {
    poblacion: {
      mulas: pob.filter((c) => c.esMula).length,
      comercios: pob.filter((c) => c.cuenta.startsWith('COM')).length,
      personas: pob.filter((c) => c.cuenta.startsWith('PER')).length,
    },
    soloFanIn: { mulasDetectadas: 0, legitimasMarcadas: 0 },
    detective: { mulasDetectadas: 0, legitimasMarcadas: 0 },
  };
  for (const c of pob) {
    const fanIn = !!c.h.fan_in?.marcado;
    const alto = riesgoBase(tipologiasMarcadas(c.h)) === 'alto';
    if (c.esMula) {
      if (fanIn) r.soloFanIn.mulasDetectadas++;
      if (alto) r.detective.mulasDetectadas++;
    } else {
      if (fanIn) r.soloFanIn.legitimasMarcadas++;
      if (alto) r.detective.legitimasMarcadas++;
    }
  }
  return r;
}

// ─────────────── Gasto por escenario ───────────────

export interface FilaGasto {
  escenario: string;
  llamadas: Record<NombreAgente, number>;
  total: number;
}

const m01: Hallazgos = {
  perfil: { cuenta: 'M-01', banco_propio: true, antiguedad_dias: 12, tipo: 'persona' },
  listas: { cuenta: 'M-01', en_lista: false, listas: [] },
  fan_in: { cuenta: 'M-01', remitentes_nuevos: 14, ventana_horas: 48, marcado: true },
  reenvio: { cuenta: 'M-01', porcentaje_reenviado: 0.91, ventana_horas: 2, destinos: ['M-02', 'M-03'], marcado: true },
};
const bodega: Hallazgos = {
  perfil: { cuenta: 'BODEGA', banco_propio: true, antiguedad_dias: 900, tipo: 'comercio' },
  listas: { cuenta: 'BODEGA', en_lista: false, listas: [] },
  fan_in: { cuenta: 'BODEGA', remitentes_nuevos: 40, ventana_horas: 48, marcado: true },
  reenvio: { cuenta: 'BODEGA', porcentaje_reenviado: 0.05, ventana_horas: 2, destinos: [], marcado: false },
};
const ambigua: Hallazgos = { ...bodega, perfil: { cuenta: 'X-77', banco_propio: true, antiguedad_dias: 15, tipo: 'persona' } };

const LLM_FALSO = {
  detective: { riesgo_destino: 'bajo', hipotesis: 'Comercio con alto volumen y sin reenvío', evidencia: [] },
  guardian: { respuesta: 'si', senales_extra: [] },
  auditor: {
    resumen: 'Resumen del caso.',
    hipotesis: 'indeterminada',
    recomendacion: 'escalar',
    indices_afirmaciones: [0],
    acciones: ['mantener_pausa'],
    confianza: 'media',
  },
};

async function correr(nombre: string, caso: Caso, h: Hallazgos | undefined, respuesta?: string, decision?: 'PERMITIR' | 'ESCALAR' | 'PAUSAR'): Promise<FilaGasto> {
  const pack = crearCtx({ hallazgos: h, canal: { comprometidos: caso.nivel0.senales.includes('dispositivo_nuevo') ? ['app'] : [] } });
  const { runAgent, calls } = crearRunAgentFalso(LLM_FALSO);
  const agentes = crearAgentes({ runAgent });
  const inv = await investigar(caso, pack.ctx, agentes);
  let c: Caso = { ...caso, evidencia: [...pack.ledger.todas], salidas: { ...inv.salidas } };
  if (inv.turnoGuardian && !inv.turnoGuardian.terminado && respuesta !== undefined) {
    const t = await continuarGuardian(c, pack.ctx, agentes, respuesta);
    c = { ...c, evidencia: [...pack.ledger.todas], salidas: { ...c.salidas, guardian: t.turno?.salida } };
  }
  if (decision) c = { ...c, decision: { accion: decision, regla: 'P4', t: new Date().toISOString() } };
  if (debeAuditar(c)) await auditar(c, pack.ctx, agentes);

  const llamadas = { coordinador: 0, detective: 0, guardian: 0, auditor: 0 } as Record<NombreAgente, number>;
  for (const k of calls) llamadas[k.nombre as NombreAgente]++;
  return { escenario: nombre, llamadas, total: calls.length };
}

export async function gastoPorEscenario(): Promise<FilaGasto[]> {
  return Promise.all([
    correr('Transferencia normal (score ≤ 2, no llega a agentes)', casoDe({ destino: 'AMIGO', senales: [], score: 0, atajo: 'P2' }), undefined),
    correr('Rosa — estafa + mula (responde «Sí, el banco»)', casoDe({ destino: 'M-01', senales: ['beneficiario_nuevo', 'monto_atipico', 'llamada_activa'], score: 7 }), m01, 'Sí, el banco', 'ESCALAR'),
    correr('Rosa — responde en texto libre', casoDe({ destino: 'M-01', senales: ['beneficiario_nuevo', 'monto_atipico', 'llamada_activa'], score: 7 }), m01, 'me llamaron del banco y me dijeron que mueva todo', 'ESCALAR'),
    correr('Jorge — mula ya en Memoria', casoDe({ origen: 'jorge', destino: 'M-01', senales: ['beneficiario_nuevo'], score: 4, atajo: 'P1' }), m01),
    correr('Bodega — falso positivo evitado', casoDe({ destino: 'BODEGA', senales: ['beneficiario_nuevo', 'monto_atipico'], score: 4 }), bodega, undefined, 'PERMITIR'),
    correr('Alerta AML con patrón claro (M-01)', casoDe({ destino: 'M-01', puerta: 'alerta_aml' }), m01),
    correr('Alerta AML ambigua', casoDe({ destino: 'X-77', puerta: 'alerta_aml' }), ambigua),
  ]);
}
