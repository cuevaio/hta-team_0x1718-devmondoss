import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Transaccion } from '@/lib/contracts';
import { evaluarTransferencia, limpiarMovimientosEnVivo } from '@/lib/pipeline';
import { analytics } from '@/lib/analytics';
import { repo } from '@/lib/data/repo';
import { memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';
import { POST as reset } from '@/app/api/demo/reset/route';

/**
 * Modo juego: `MOVIMIENTOS_EN_VIVO=1` (DEMO_JUEGO §9).
 *
 * Una transferencia PERMITIDA movió dinero y pasa a contar en el fan-in de la
 * cuenta destino. Una retenida no: ese dinero no llegó. Sin la variable, todo
 * es exactamente la semilla.
 */

const tx = (origen: string, destino: string, monto: number): Transaccion => ({
  origen,
  destino,
  monto,
  moneda: 'PEN',
});

const previo = process.env.MOVIMIENTOS_EN_VIVO;
const SEMILLA = repo.movimientos().length;

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
  limpiarMovimientosEnVivo();
  process.env.MOVIMIENTOS_EN_VIVO = '1';
});

afterEach(() => {
  if (previo === undefined) delete process.env.MOVIMIENTOS_EN_VIVO;
  else process.env.MOVIMIENTOS_EN_VIVO = previo;
  limpiarMovimientosEnVivo();
});

describe('sin la variable, nada cambia', () => {
  it('una transferencia permitida no agrega movimientos', async () => {
    delete process.env.MOVIMIENTOS_EN_VIVO;
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-02', 300));
    expect(caso.decision?.accion).toBe('PERMITIR');
    expect(repo.movimientos()).toHaveLength(SEMILLA);
  });
});

describe('con la variable', () => {
  it('lo permitido mueve dinero y crece el fan-in del destino', async () => {
    const antes = analytics.fanIn('M-02').remitentes_nuevos;
    for (const origen of ['C-ROSA', 'C-JORGE', 'C-LUCIA']) {
      const { caso } = await evaluarTransferencia(tx(origen, 'M-02', 300));
      expect(caso.decision?.accion).toBe('PERMITIR');
      expect(caso.timeline.map((e) => e.evento)).toContain('movimiento_registrado');
    }
    expect(repo.movimientosEnVivo()).toHaveLength(3);
    expect(analytics.fanIn('M-02').remitentes_nuevos).toBe(antes + 3);
  });

  it('lo retenido NO mueve dinero: el intento frenado no llega a la mula', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      contexto: { llamada_activa_o_acceso_remoto: true },
      respuestaCliente: 'sí, me está guiando un asesor del banco',
    });
    expect(caso.decision?.accion).toBe('ESCALAR');
    expect(repo.movimientosEnVivo()).toHaveLength(0);
  });

  it('una alerta AML nunca mueve dinero', async () => {
    const { evaluarAlerta } = await import('@/lib/pipeline');
    await evaluarAlerta('B-PEPE', 'x');
    expect(repo.movimientosEnVivo()).toHaveLength(0);
  });

  it('el segundo pago al mismo destino ya no es "beneficiario nuevo"', async () => {
    const primero = await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    const segundo = await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    expect(primero.caso.nivel0.senales).toContain('beneficiario_nuevo');
    expect(segundo.caso.nivel0.senales).not.toContain('beneficiario_nuevo');
  });

  it('la semilla nunca se modifica', async () => {
    await evaluarTransferencia(tx('C-ROSA', 'M-02', 300));
    expect(repo.movimientos()).toHaveLength(SEMILLA + 1);
    limpiarMovimientosEnVivo();
    expect(repo.movimientos()).toHaveLength(SEMILLA);
  });

  it('/api/demo/reset vuelve a la semilla', async () => {
    await evaluarTransferencia(tx('C-ROSA', 'M-02', 300));
    await reset(new Request('http://test/api/demo/reset', { method: 'POST' }));
    expect(repo.movimientosEnVivo()).toHaveLength(0);
    expect(analytics.fanIn('M-02').remitentes_nuevos).toBe(1);
  });

  /**
   * Límite conocido, documentado en TASKS.md para el diseño del juego: con 3
   * víctimas, una mula NUEVA no llega al umbral de fan-in (5) ni reenvía en
   * vivo, así que no se «quema» sola. Si este test empieza a fallar, el
   * diseño cambió: actualizar la nota.
   */
  it('límite: con 3 víctimas, una mula nueva no alcanza el umbral de fan-in', async () => {
    for (const origen of ['C-ROSA', 'C-JORGE', 'C-LUCIA']) {
      await evaluarTransferencia(tx(origen, 'M-02', 300));
    }
    expect(analytics.fanIn('M-02').marcado).toBe(false);
  });
});
