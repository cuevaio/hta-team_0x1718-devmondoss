import type { Partida } from './partidas';
import { TACTICAS } from './partidas';

/**
 * Resumen de las partidas: la tabla de DEMO_JUEGO §6, calculada.
 *
 * Reglas de honestidad (las mismas de lib/observability):
 *  - Siempre se publica el `n`; un cociente sin datos es `null`.
 *  - La frustración es ordinal (😌…😫): distribución y mediana, nunca promedio.
 *  - Los límites que el doc pide «decir en voz alta» viajan en la respuesta.
 *
 * Dueño: Ale_dev.
 */

const ratio = (a: number, b: number): number | null =>
  b === 0 ? null : Math.round((a / b) * 1000) / 1000;

function contar<K extends string>(valores: K[], claves: readonly K[]): Record<K, number> {
  const r = Object.fromEntries(claves.map((k) => [k, 0])) as Record<K, number>;
  for (const v of valores) r[v]++;
  return r;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export const LIMITES_JUEGO = [
  'Muestra chica y no representativa (personas de un evento): resultados indicativos.',
  'Sesgo de juego: quien sabe que juega cae menos que en la vida real; si aun así cae, el dato es conservador.',
  'Orden fijo: la ronda B va después de la A. En B se mide si perdió dinero (depende del sistema), no si detectó la estafa.',
  'El atacante juega con 5 tácticas conocidas: no prueba ataques que no imaginamos.',
] as const;

export function resumenPartidas(todas: Partida[]) {
  const victimas = todas.filter((p): p is Extract<Partida, { rol: 'victima' }> => p.rol === 'victima');
  const atacantes = todas.filter((p): p is Extract<Partida, { rol: 'atacante' }> => p.rol === 'atacante');

  // ── Víctima ──
  const cayeronA = victimas.filter((v) => v.ronda_a.cayo).length;
  // En la ronda B, una transferencia PERMITIDA llegó al estafador: perdió dinero.
  const perdieronB = victimas.filter((v) => v.hechos.some((h) => h.accion === 'PERMITIR')).length;
  const activaria = contar(victimas.map((v) => v.activaria), ['si', 'no', 'no_se'] as const);
  const frustracion = victimas.map((v) => v.ronda_a.frustracion);

  // ── Atacante ──
  const intentos = atacantes.flatMap((a) => a.hechos);
  const logrados = intentos.filter((h) => h.accion === 'PERMITIR');
  const porTactica = Object.fromEntries(
    TACTICAS.map((t) => {
      const de = intentos.filter((h) => h.tactica === t);
      return [t, { intentos: de.length, logrados: de.filter((h) => h.accion === 'PERMITIR').length }];
    }),
  );

  return {
    total_partidas: todas.length,
    victima: {
      n: victimas.length,
      /** H3: cayeron en la ronda «Hoy», aun con la identidad correcta. */
      h3_cayeron_ronda_a: { n: cayeronA, pct: ratio(cayeronA, victimas.length) },
      /** E3: perdieron dinero en la ronda «Con nuestra capa». */
      e3_perdieron_ronda_b: { n: perdieronB, pct: ratio(perdieronB, victimas.length) },
      frustracion_ronda_a: {
        distribucion: contar(frustracion.map(String) as ('1' | '2' | '3' | '4' | '5')[], ['1', '2', '3', '4', '5'] as const),
        mediana: mediana(frustracion),
        escala: '1 😌 … 5 😫 (ordinal)',
      },
      friccion_pausa_molesto: contar(victimas.map((v) => v.ronda_b.pausa_molesto), ['no', 'un_poco', 'mucho'] as const),
      /** H5: aceptarían la protección delegada. */
      h5_activaria: { ...activaria, pct_si: ratio(activaria.si, victimas.length) },
    },
    atacante: {
      n: atacantes.length,
      intentos: intentos.length,
      frenados: intentos.length - logrados.length,
      logrados: logrados.length,
      soles_intentados: intentos.reduce((s, h) => s + h.monto, 0),
      soles_robados: logrados.reduce((s, h) => s + h.monto, 0),
      por_tactica: porTactica,
      /** H8: intentos a una mula ya confirmada, frenados por la Memoria sin IA. */
      h8_frenados_por_memoria: intentos.filter((h) => h.regla === 'P1').length,
      ideas_red_team: atacantes.filter((a) => a.idea).length,
    },
    limites: LIMITES_JUEGO,
  };
}
