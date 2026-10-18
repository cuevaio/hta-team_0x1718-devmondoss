import { describe, it, expect, beforeAll } from 'vitest';
import type { Caso, ContextoOperacion } from '@/lib/contracts';
import { evaluarTransferencia, responderGuardian } from '@/lib/pipeline';
import { storeCasos } from '@/lib/cases/store';
import { memoria } from '@/lib/memory/store';

/**
 * Matriz del atacante (DEMO_JUEGO §4): táctica × víctima × destino × monto ×
 * respuesta del cliente → 750 combinaciones por el pipeline real.
 *
 * Por qué existe: los tests de casos de uso cubrían el GUION del demo (Rosa
 * siempre hacia M-01, que es alto). Un «falso banco» hacia cualquier OTRA
 * cuenta se liberaba con la pregunta del Guardián en pantalla, y ningún test
 * lo veía. Aquí se verifican invariantes, no casos sueltos.
 */

const TACTICAS: Record<string, Partial<ContextoOperacion>> = {
  falso_banco: { llamada_activa_o_acceso_remoto: true },
  link_falso: { dispositivo_nuevo_24h: true },
  falso_familiar: {},
  app_falsa: { llamada_activa_o_acceso_remoto: true },
  duplicado_chip: { cambio_sim_o_clave_72h: true, dispositivo_nuevo_24h: true },
};
const VICTIMAS = ['C-ROSA', 'C-JORGE', 'C-LUCIA'];
const DESTINOS = ['M-01', 'M-02', 'M-03', 'X-99', 'B-PEPE'];
const MONTOS = [300, 4800];
const RESPUESTAS: (string | null)[] = [null, 'sí', 'no', 'no sé', ''];
const SENAL_CLIENTE = ['llamada_activa', 'dispositivo_nuevo', 'cambio_sim_o_clave'];

interface Fila {
  id: string;
  inicial: NonNullable<Caso['decision']>;
  final: NonNullable<Caso['decision']>;
  pendiente: boolean;
  respuesta: string | null;
  score: number;
  senalCliente: boolean;
  invocado: boolean;
  riesgo?: string;
}

const filas: Fila[] = [];

beforeAll(async () => {
  memoria.limpiar();
  for (const [tactica, contexto] of Object.entries(TACTICAS))
    for (const origen of VICTIMAS)
      for (const destino of DESTINOS)
        for (const monto of MONTOS)
          for (const respuesta of RESPUESTAS) {
            storeCasos.limpiar();
            let { caso } = await evaluarTransferencia({ origen, destino, monto, moneda: 'PEN' }, { contexto });
            const inicial = { ...caso.decision! };
            const pendiente = caso.timeline.some((e) => e.evento === 'turno_pendiente') && !caso.salidas.guardian;
            const invocado = pendiente || Boolean(caso.salidas.guardian);
            if (respuesta !== null && pendiente) {
              for (let i = 0; i < 3 && !caso.salidas.guardian; i++) caso = (await responderGuardian(caso.id, respuesta))!;
            }
            filas.push({
              id: `${tactica} ${origen}→${destino} S/${monto} resp=${JSON.stringify(respuesta)}`,
              inicial,
              final: caso.decision!,
              pendiente,
              respuesta,
              score: caso.nivel0.score,
              senalCliente: caso.nivel0.senales.some((s) => SENAL_CLIENTE.includes(s)),
              invocado,
              riesgo: caso.salidas.detective?.riesgo_destino,
            });
          }
}, 60_000);

const violaciones = (pred: (f: Fila) => boolean) => filas.filter(pred).map((f) => f.id);

describe('matriz del atacante — invariantes sobre 750 combinaciones', () => {
  it('se evaluaron todas', () => {
    expect(filas).toHaveLength(750);
  });

  it('I1: con el Guardián esperando respuesta, NUNCA se libera el dinero', () => {
    expect(violaciones((f) => f.pendiente && f.inicial.accion === 'PERMITIR')).toEqual([]);
  });

  it('I2: si al cliente se le preguntó, un «sí» nunca termina en PERMITIR', () => {
    expect(violaciones((f) => f.invocado && f.respuesta === 'sí' && f.final.accion === 'PERMITIR')).toEqual([]);
  });

  it('I3: si al cliente se le preguntó, «no sé» o el silencio nunca terminan en PERMITIR', () => {
    expect(
      violaciones((f) => f.invocado && (f.respuesta === 'no sé' || f.respuesta === '') && f.final.accion === 'PERMITIR'),
    ).toEqual([]);
  });

  it('I4: un destino de riesgo alto nunca se permite', () => {
    expect(violaciones((f) => f.riesgo === 'alto' && f.final.accion === 'PERMITIR')).toEqual([]);
  });

  it('I5: con score ≥ 5 y señal del cliente, nunca se libera sin preguntarle', () => {
    expect(
      violaciones((f) => f.score >= 5 && f.senalCliente && !f.invocado && f.final.accion === 'PERMITIR'),
    ).toEqual([]);
  });

  /**
   * Límite DOCUMENTADO, no un error: con score 0–2 se permite sin IA (doc 19
   * §2) y el Guardián no se invoca. Es «el hueco honesto» de DEMO_JUEGO §4.
   * Este test lo fija para que nadie lo descubra en vivo: si cambia, que sea
   * una decisión.
   */
  it('hueco honesto: lo que pasa sin preguntar tiene score ≤ 2 (P3) o es habitual (P2)', () => {
    const sinPreguntar = filas.filter((f) => !f.invocado && f.final.accion === 'PERMITIR');
    for (const f of sinPreguntar) expect(['P2', 'P3', 'P8'], f.id).toContain(f.final.regla);
    expect(sinPreguntar.filter((f) => f.final.regla === 'P3').every((f) => f.score <= 2)).toBe(true);
  });
});
