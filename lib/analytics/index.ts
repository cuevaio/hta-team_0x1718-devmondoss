import type { Tipologia } from '@/lib/contracts';
import {
  UMBRALES,
  type ResultadoCiclos,
  type ResultadoEstructuracion,
  type ResultadoFanIn,
  type ResultadoListas,
  type ResultadoPerfil,
  type ResultadoRed,
  type ResultadoReenvio,
  type ResultadoTransfronterizo,
  type TipoCuenta,
} from '@/lib/contracts/analytics';
import type { Canal } from '@/lib/data/types';
import { repo } from '@/lib/data/repo';
import { red } from '@/lib/memory/red';

/**
 * Analytics deterministas.
 *
 * Principio rector del doc 19: **las tools calculan, los agentes razonan sobre
 * resultados ya calculados.** Ningún número de aquí lo produce un LLM.
 *
 * CONTRACT: las formas de retorno son las de `lib/contracts/analytics.ts`, que
 * fijó Tony en AGENT_PLAYBOOKS §6. Los umbrales se importan de allí: no se
 * duplican, para que haya un solo origen.
 *
 * Dueño: Ale_dev. Los agentes de Tony las consumen vía `ToolContext.analytics`.
 */

export { UMBRALES };

/** Cuentas que no son de nuestro banco: no vemos su historial de reenvío (19 §10). */
const PREFIJOS_BANCO_PROPIO = ['C-', 'M-', 'B-', 'H-'];

function esBancoPropio(cuentaId: string): boolean {
  return PREFIJOS_BANCO_PROPIO.some((p) => cuentaId.startsWith(p));
}

function mapearTipo(tipo: string | undefined): TipoCuenta {
  if (tipo === 'comercio') return 'comercio';
  if (tipo === 'persona') return 'persona';
  return 'desconocido';
}

// ─────────────────────────────────────────────────────────────

/** Perfil básico de la cuenta destino. Primer paso del plan del Detective. */
export function perfilCuenta(cuentaId: string): ResultadoPerfil {
  const c = repo.cuenta(cuentaId);
  const propio = esBancoPropio(cuentaId);
  const antiguedad = c
    ? Math.max(
        0,
        Math.floor((repo.ahora().getTime() - new Date(c.abierta).getTime()) / 86_400_000),
      )
    : null;
  return {
    cuenta: cuentaId,
    banco_propio: propio,
    antiguedad_dias: antiguedad,
    tipo: mapearTipo(c?.tipo),
  };
}

/**
 * Remitentes NUEVOS en la ventana.
 *
 * "Nuevo" = no había transferido a esta cuenta antes de la ventana. Es más
 * estricto que contar remitentes distintos: una cuenta con 20 clientes
 * recurrentes no debe marcar fan-in solo por tener muchos.
 */
export function fanIn(
  cuentaId: string,
  horas: number = UMBRALES.fan_in_ventana_horas,
): ResultadoFanIn {
  const ahora = repo.ahora();
  const inicioVentana = new Date(ahora.getTime() - horas * 3_600_000);

  const enVentana = repo.entrantes(cuentaId, horas);
  const previos = new Set(
    repo
      .movimientos()
      .filter((m) => m.destino === cuentaId && new Date(m.t) < inicioVentana)
      .map((m) => m.origen),
  );

  const nuevos = new Set(
    enVentana.map((m) => m.origen).filter((origen) => !previos.has(origen)),
  );

  return {
    cuenta: cuentaId,
    remitentes_nuevos: nuevos.size,
    ventana_horas: horas,
    marcado: nuevos.size >= UMBRALES.fan_in_remitentes_nuevos,
  };
}

/**
 * Qué proporción de lo recibido volvió a salir casi de inmediato.
 *
 * Esta es LA señal que distingue una mula de un negocio de alto volumen:
 * la bodega recibe de muchos y NO reenvía. Sin esta función, CU-05 falla.
 */
export function reenvioRapido(
  cuentaId: string,
  horas: number = UMBRALES.reenvio_ventana_horas,
): ResultadoReenvio {
  const recibido = repo
    .entrantes(cuentaId, UMBRALES.fan_in_ventana_horas)
    .reduce((s, m) => s + m.monto, 0);
  const salida = repo.salientes(cuentaId, horas);
  const reenviado = salida.reduce((s, m) => s + m.monto, 0);
  // Se acota a 1 porque el contrato declara el rango 0..1.
  const pct = recibido > 0 ? Math.min(1, reenviado / recibido) : 0;

  return {
    cuenta: cuentaId,
    porcentaje_reenviado: Math.round(pct * 1000) / 1000,
    ventana_horas: horas,
    destinos: [...new Set(salida.map((m) => m.destino))],
    marcado: pct >= UMBRALES.reenvio_porcentaje,
  };
}

/** Operaciones repetidas justo por debajo del umbral de reporte. */
export function estructuracion(cuentaId: string): ResultadoEstructuracion {
  const umbral = repo.umbralReporte();
  const min = umbral * UMBRALES.estructuracion_banda_min;
  const ops = repo
    .historialSalientes(cuentaId)
    .filter((m) => m.monto >= min && m.monto <= umbral);

  return {
    cuenta: cuentaId,
    operaciones_cercanas_umbral: ops.length,
    marcado: ops.length >= UMBRALES.estructuracion_operaciones,
  };
}

/** Ciclo que vuelve al origen dentro de la profundidad máxima. */
export function ciclos(
  cuentaId: string,
  profundidad: number = UMBRALES.ciclo_profundidad_max,
): ResultadoCiclos {
  const visitados = new Set<string>();

  function buscar(actual: string, camino: string[]): string[] | null {
    if (camino.length > profundidad) return null;
    for (const m of repo.historialSalientes(actual)) {
      if (m.destino === cuentaId && camino.length >= 1) {
        return [...camino, actual, cuentaId];
      }
      if (!visitados.has(m.destino)) {
        visitados.add(m.destino);
        const r = buscar(m.destino, [...camino, actual]);
        if (r) return r;
      }
    }
    return null;
  }

  const ciclo = buscar(cuentaId, []);
  return { cuenta: cuentaId, ciclo, marcado: ciclo !== null };
}

/**
 * Listas de riesgo.
 *
 * En el MVP no hay lista externa: la Memoria se consulta aparte en el pipeline.
 * La firma queda correcta para conectar una lista real sin cambiar el contrato.
 */
export function listasRiesgo(cuentaId: string): ResultadoListas {
  return { cuenta: cuentaId, en_lista: false, listas: [] };
}

/**
 * Red regional: ¿otro banco ya confirmó esta cuenta como mula?
 *
 * Solo veredictos AJENOS y vigentes; los de este banco están en la Memoria.
 * Es un hallazgo con evidencia propia (`red_regional`), así el expediente
 * puede citarlo, pero la Policy lo pesa menos que un veredicto propio (P1R).
 */
export function redRegional(cuentaId: string): ResultadoRed {
  const r = red.deOtroBanco(cuentaId, repo.ahora());
  return {
    cuenta: cuentaId,
    en_red: r !== null,
    emisor: r?.veredicto.emisor ?? null,
    fecha: r?.veredicto.fecha ?? null,
    expediente: r?.veredicto.expediente ?? null,
    tipologias: r?.ficha?.tipologias ?? [],
  };
}

/**
 * ¿La cuenta saca del país lo que recibe, y rápido?
 *
 * Es la mula regional: recibe aquí y en menos de 2 h el dinero ya está en
 * otro país, donde este banco no ve nada más. Mide qué parte de lo recibido
 * (ventana de fan-in) salió hacia cuentas de OTRO país dentro de la ventana
 * de reenvío.
 */
export function reenvioTransfronterizo(
  cuentaId: string,
  horas: number = UMBRALES.reenvio_ventana_horas,
): ResultadoTransfronterizo {
  const pais = repo.paisDe(cuentaId);
  const recibido = repo
    .entrantes(cuentaId, UMBRALES.fan_in_ventana_horas)
    .reduce((s, m) => s + m.monto, 0);
  const alExterior = repo.salientes(cuentaId, horas).filter((m) => repo.paisDe(m.destino) !== pais);
  const monto = alExterior.reduce((s, m) => s + m.monto, 0);
  const pct = recibido > 0 ? Math.min(1, monto / recibido) : 0;
  const destinos = [...new Set(alExterior.map((m) => m.destino))].map((c) => ({ cuenta: c, pais: repo.paisDe(c) }));

  return {
    cuenta: cuentaId,
    pais_cuenta: pais,
    porcentaje_al_exterior: Math.round(pct * 1000) / 1000,
    ventana_horas: horas,
    destinos,
    marcado: pct >= UMBRALES.transfronterizo_porcentaje,
  };
}

/** Cadena de reenvío hacia adelante, hasta N saltos (19 §3: hasta 2 saltos). */
export function cadenaReenvio(cuentaId: string, saltos = 2): string[] {
  const cadena = [cuentaId];
  let actual = cuentaId;
  for (let i = 0; i < saltos; i++) {
    const salida = repo.salientes(actual, UMBRALES.fan_in_ventana_horas);
    if (salida.length === 0) break;
    const mayor = salida.reduce((a, b) => (b.monto > a.monto ? b : a));
    if (cadena.includes(mayor.destino)) break;
    cadena.push(mayor.destino);
    actual = mayor.destino;
  }
  return cadena;
}

// ─────────────────────────────────────────────────────────────
// Lado cliente — insumos del Guardián
// ─────────────────────────────────────────────────────────────

export interface ResultadoDisponibilidad {
  cliente: string;
  alcanzable: boolean;
  canales_disponibles: Canal[];
}

/**
 * ¿El cliente puede participar en una verificación ahora?
 *
 * ⚠️ R1 (doc 15): esto describe la SITUACIÓN, no a la persona. No infiere
 * discapacidad, edad ni condición alguna, y no alimenta el score de riesgo:
 * solo determina si un challenge es viable y por qué canal.
 */
export function disponibilidad(clienteId: string): ResultadoDisponibilidad {
  const c = repo.cliente(clienteId);
  if (!c) return { cliente: clienteId, alcanzable: false, canales_disponibles: [] };
  return {
    cliente: clienteId,
    alcanzable: c.alcanzable,
    canales_disponibles: c.canales_disponibles.filter(
      (canal) => !c.canales_comprometidos.includes(canal),
    ),
  };
}

export interface ResultadoCanales {
  cliente: string;
  seguros: Canal[];
  comprometidos: Canal[];
}

/**
 * Canales usables para verificar.
 *
 * Resuelve FM3 (same-channel verification): nunca se verifica por un canal
 * marcado como comprometido.
 */
export function canalesSeguros(clienteId: string): ResultadoCanales {
  const c = repo.cliente(clienteId);
  if (!c) return { cliente: clienteId, seguros: [], comprometidos: [] };
  return {
    cliente: clienteId,
    seguros: c.canales_disponibles.filter((x) => !c.canales_comprometidos.includes(x)),
    comprometidos: c.canales_comprometidos,
  };
}

// ─────────────────────────────────────────────────────────────

/** Tipologías que las tools marcan. Insumo de la regla de consistencia (19 §3). */
export function tipologiasMarcadas(cuentaId: string): Tipologia[] {
  const marcadas: Tipologia[] = [];
  if (fanIn(cuentaId).marcado) marcadas.push('fan_in');
  if (reenvioRapido(cuentaId).marcado) marcadas.push('reenvio_rapido');
  if (estructuracion(cuentaId).marcado) marcadas.push('estructuracion');
  if (ciclos(cuentaId).marcado) marcadas.push('circular');
  if (listasRiesgo(cuentaId).en_lista) marcadas.push('en_lista');
  if (reenvioTransfronterizo(cuentaId).marcado) marcadas.push('transfronterizo');
  if (redRegional(cuentaId).en_red) marcadas.push('en_red');
  return marcadas;
}

export const analytics = {
  perfilCuenta,
  fanIn,
  reenvioRapido,
  estructuracion,
  ciclos,
  listasRiesgo,
  redRegional,
  reenvioTransfronterizo,
  cadenaReenvio,
  disponibilidad,
  canalesSeguros,
  tipologiasMarcadas,
};

export type Analytics = typeof analytics;
