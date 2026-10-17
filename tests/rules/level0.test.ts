import { describe, it, expect } from 'vitest';
import {
  evaluateRules,
  nivelDeScore,
  requierePausaPreventiva,
  PUNTAJES,
} from '@/lib/rules/level0';
import type { ContextoOperacion, Transaccion } from '@/lib/contracts';

const tx: Transaccion = { origen: 'C-ROSA', destino: 'M-01', monto: 4800, moneda: 'PEN' };

const ctxLimpio: ContextoOperacion = {
  beneficiario_nuevo: false,
  monto_vs_promedio_90d: 1,
  dispositivo_nuevo_24h: false,
  cambio_sim_o_clave_72h: false,
  llamada_activa_o_acceso_remoto: false,
  horario_atipico: false,
  beneficiario_habitual: false,
};

describe('Puntajes de la tabla del doc 19 §2', () => {
  it('cada señal vale exactamente lo que dice el doc', () => {
    expect(PUNTAJES).toEqual({
      beneficiario_nuevo: 2,
      monto_atipico: 2,
      dispositivo_nuevo: 2,
      cambio_sim_o_clave: 2,
      llamada_activa: 3,
      horario_atipico: 1,
    });
  });

  it('cada señal aislada aporta su puntaje y nada más', () => {
    const casos: Array<[Partial<ContextoOperacion>, number]> = [
      [{ beneficiario_nuevo: true }, 2],
      [{ monto_vs_promedio_90d: 4 }, 2],
      [{ dispositivo_nuevo_24h: true }, 2],
      [{ cambio_sim_o_clave_72h: true }, 2],
      [{ llamada_activa_o_acceso_remoto: true }, 3],
      [{ horario_atipico: true }, 1],
    ];
    for (const [parche, esperado] of casos) {
      const r = evaluateRules(tx, { ...ctxLimpio, ...parche });
      expect(r.score, JSON.stringify(parche)).toBe(esperado);
    }
  });

  it('un contexto limpio da score 0', () => {
    expect(evaluateRules(tx, ctxLimpio).score).toBe(0);
    expect(evaluateRules(tx, ctxLimpio).senales).toEqual([]);
  });
});

describe('Umbral de monto atípico', () => {
  it('exactamente 3× NO es atípico; más de 3× sí', () => {
    expect(evaluateRules(tx, { ...ctxLimpio, monto_vs_promedio_90d: 3 }).score).toBe(0);
    expect(evaluateRules(tx, { ...ctxLimpio, monto_vs_promedio_90d: 3.01 }).score).toBe(2);
  });
});

describe('Niveles de riesgo del doc 19 §2', () => {
  it('0–2 bajo, 3–4 medio, >=5 alto', () => {
    expect([0, 1, 2].map(nivelDeScore)).toEqual(['bajo', 'bajo', 'bajo']);
    expect([3, 4].map(nivelDeScore)).toEqual(['medio', 'medio']);
    expect([5, 6, 7, 12].map(nivelDeScore)).toEqual(['alto', 'alto', 'alto', 'alto']);
  });

  it('la pausa preventiva se dispara solo en nivel alto', () => {
    expect(requierePausaPreventiva(4)).toBe(false);
    expect(requierePausaPreventiva(5)).toBe(true);
  });
});

describe('Escenarios de los casos de uso — scores del doc', () => {
  it('CU-01 Rosa = 7 (beneficiario nuevo + monto atípico + llamada activa)', () => {
    const r = evaluateRules(tx, {
      ...ctxLimpio,
      beneficiario_nuevo: true,
      monto_vs_promedio_90d: 4800 / 420,
      llamada_activa_o_acceso_remoto: true,
    });
    expect(r.score).toBe(7);
    expect(nivelDeScore(r.score)).toBe('alto');
    expect(requierePausaPreventiva(r.score)).toBe(true);
    expect(r.senales).toEqual(['beneficiario_nuevo', 'monto_atipico', 'llamada_activa']);
  });

  it('CU-04 Lucía atacante = 6 (dispositivo nuevo + beneficiario nuevo + monto atípico)', () => {
    const r = evaluateRules(
      { origen: 'C-LUCIA', destino: 'M-01', monto: 3000, moneda: 'PEN' },
      {
        ...ctxLimpio,
        beneficiario_nuevo: true,
        monto_vs_promedio_90d: 3000 / 650,
        dispositivo_nuevo_24h: true,
      },
    );
    expect(r.score).toBe(6);
    expect(requierePausaPreventiva(r.score)).toBe(true);
  });

  it('CU-05 Bodega = 4 (beneficiario nuevo + monto atípico), nivel medio', () => {
    const r = evaluateRules(
      { origen: 'C-JORGE', destino: 'B-PEPE', monto: 2000, moneda: 'PEN' },
      { ...ctxLimpio, beneficiario_nuevo: true, monto_vs_promedio_90d: 2000 / 380 },
    );
    expect(r.score).toBe(4);
    expect(nivelDeScore(r.score)).toBe('medio');
    // Clave para CU-05: score medio NO dispara pausa preventiva.
    expect(requierePausaPreventiva(r.score)).toBe(false);
  });
});

describe('Atajo P2 — beneficiario habitual', () => {
  it('aplica cuando es habitual y no hay señales de compromiso', () => {
    const r = evaluateRules(
      { origen: 'C-LUCIA', destino: 'H-SOL', monto: 650, moneda: 'PEN' },
      { ...ctxLimpio, beneficiario_habitual: true },
    );
    expect(r.atajo).toBe('P2');
  });

  it('NO aplica si el dispositivo es nuevo — un atacante también paga al habitual', () => {
    const r = evaluateRules(tx, {
      ...ctxLimpio,
      beneficiario_habitual: true,
      dispositivo_nuevo_24h: true,
    });
    expect(r.atajo).toBeUndefined();
  });

  it('NO aplica con cambio de SIM reciente', () => {
    const r = evaluateRules(tx, {
      ...ctxLimpio,
      beneficiario_habitual: true,
      cambio_sim_o_clave_72h: true,
    });
    expect(r.atajo).toBeUndefined();
  });

  it('NO aplica con llamada activa — es el vector de CU-01', () => {
    const r = evaluateRules(tx, {
      ...ctxLimpio,
      beneficiario_habitual: true,
      llamada_activa_o_acceso_remoto: true,
    });
    expect(r.atajo).toBeUndefined();
  });

  it('las reglas nivel 0 nunca emiten P1: eso lo decide la Memoria', () => {
    const combinaciones: Partial<ContextoOperacion>[] = [
      {},
      { beneficiario_habitual: true },
      { beneficiario_nuevo: true, llamada_activa_o_acceso_remoto: true },
    ];
    for (const c of combinaciones) {
      expect(evaluateRules(tx, { ...ctxLimpio, ...c }).atajo).not.toBe('P1');
    }
  });
});
