import { describe, it, expect } from 'vitest';
import {
  Caso,
  Evidencia,
  SalidaCoordinador,
  SalidaGuardian,
  SalidaDetective,
  SalidaAuditor,
  Veredicto,
  veredictoVigente,
  DIAS_VIGENCIA_VEREDICTO,
} from '@/lib/contracts';

/**
 * Los ejemplos JSON del doc 19 deben validar tal cual.
 * Si uno de estos tests falla, el contrato con el LLM se desalineó del diseño.
 */

describe('Evidencia', () => {
  it('acepta un id con forma E-01', () => {
    expect(
      Evidencia.safeParse({ id: 'E-07', fuente: 'fan_in', dato: { remitentes_nuevos: 14 } }).success,
    ).toBe(true);
  });

  it('rechaza un id sin la forma E-xx', () => {
    for (const id of ['E1', '7', 'evidencia-7', 'E-7']) {
      expect(Evidencia.safeParse({ id, fuente: 'fan_in', dato: {} }).success).toBe(false);
    }
  });
});

describe('SalidaCoordinador — ejemplo del doc 19 §3', () => {
  it('valida el ejemplo literal', () => {
    const r = SalidaCoordinador.safeParse({
      salida_temprana: false,
      invocar: ['guardian', 'detective'],
      motivo: 'beneficiario nuevo + llamada activa; destino sin historial en Memoria',
    });
    expect(r.success).toBe(true);
  });

  it('rechaza un especialista inexistente', () => {
    const r = SalidaCoordinador.safeParse({
      salida_temprana: false,
      invocar: ['auditor'],
      motivo: 'x',
    });
    expect(r.success).toBe(false);
  });
});

describe('SalidaGuardian — ejemplo del doc 19 §3', () => {
  it('valida el ejemplo literal', () => {
    const r = SalidaGuardian.safeParse({
      estado_usuario: 'manipulacion_probable',
      senales_manipulacion: ['guiado_por_telefono', 'urgencia'],
      canal_usado: 'app',
      evidencia: ['E-04', 'E-05'],
    });
    expect(r.success).toBe(true);
  });

  it('acepta los 5 estados del doc y nada más', () => {
    const validos = [
      'confirmado_seguro',
      'manipulacion_probable',
      'sin_respuesta',
      'canal_comprometido',
      'no_consultado',
    ];
    for (const estado of validos) {
      const r = SalidaGuardian.safeParse({
        estado_usuario: estado,
        senales_manipulacion: [],
        canal_usado: 'app',
        evidencia: [],
      });
      expect(r.success, estado).toBe(true);
    }
    const invalido = SalidaGuardian.safeParse({
      estado_usuario: 'aprobado',
      senales_manipulacion: [],
      canal_usado: 'app',
      evidencia: [],
    });
    expect(invalido.success).toBe(false);
  });
});

describe('SalidaDetective — ejemplo del doc 19 §3', () => {
  it('valida el ejemplo literal', () => {
    const r = SalidaDetective.safeParse({
      riesgo_destino: 'alto',
      tipologias: ['fan_in', 'reenvio_rapido'],
      hipotesis: 'cuenta de paso (mula) en cadena de layering',
      cadena: ['M-01', 'M-02', 'M-03'],
      evidencia: ['E-07', 'E-08', 'E-09'],
    });
    expect(r.success).toBe(true);
  });

  it('rechaza una tipología fuera de las 5 del doc', () => {
    const r = SalidaDetective.safeParse({
      riesgo_destino: 'alto',
      tipologias: ['lavado'],
      hipotesis: 'x',
      cadena: [],
      evidencia: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('SalidaAuditor — ejemplo del doc 19 §3', () => {
  const ejemplo = {
    resumen: 'Transferencia de S/4,800 guiada por llamada hacia cuenta con patrón de mula.',
    hipotesis: 'estafa_vishing + mula',
    recomendacion: 'escalar',
    afirmaciones: [
      { texto: 'La cuenta recibió de 14 remitentes nuevos en 48h', evidencia: ['E-07'] },
      { texto: 'Reenvió el 91% de lo recibido en menos de 2h', evidencia: ['E-08'] },
      { texto: 'La clienta indicó que la estaban guiando por teléfono', evidencia: ['E-04'] },
    ],
    acciones_sugeridas: ['confirmar mula', 'preparar borrador de ROS'],
    confianza: 'alta',
    requiere_revision_manual: false,
  };

  it('valida el ejemplo literal', () => {
    expect(SalidaAuditor.safeParse(ejemplo).success).toBe(true);
  });

  it('rechaza una afirmación sin ninguna evidencia citada', () => {
    const r = SalidaAuditor.safeParse({
      ...ejemplo,
      afirmaciones: [{ texto: 'La cuenta es una mula', evidencia: [] }],
    });
    expect(r.success).toBe(false);
  });
});

describe('Caso — ejemplo del doc 19 §6', () => {
  it('valida el ejemplo literal', () => {
    const r = Caso.safeParse({
      id: 'CASO-0001',
      puerta: 'transferencia',
      transaccion: { origen: 'rosa', destino: 'M-01', monto: 4800, moneda: 'PEN' },
      nivel0: { senales: ['beneficiario_nuevo', 'monto_atipico', 'llamada_activa'], score: 7 },
      evidencia: [{ id: 'E-07', fuente: 'fan_in', dato: { remitentes_nuevos: 14, horas: 48 } }],
      salidas: {},
      decision: { accion: 'PAUSAR', regla: 'P4', t: '2026-10-17T02:13:00Z' },
      timeline: [],
      ia: { llamadas: 6, tokens: 0, costo_estimado: 0 },
    });
    expect(r.success).toBe(true);
  });

  it('rechaza una moneda distinta de PEN', () => {
    const r = Caso.safeParse({
      id: 'CASO-0001',
      puerta: 'transferencia',
      transaccion: { origen: 'rosa', destino: 'M-01', monto: 4800, moneda: 'USD' },
      nivel0: { senales: [], score: 0 },
      evidencia: [],
      salidas: {},
      timeline: [],
      ia: { llamadas: 0, tokens: 0, costo_estimado: 0 },
    });
    expect(r.success).toBe(false);
  });

  it('rechaza una regla de policy fuera de P1..P10', () => {
    const base = {
      id: 'CASO-0001',
      puerta: 'transferencia' as const,
      transaccion: { origen: 'rosa', destino: 'M-01', monto: 100, moneda: 'PEN' as const },
      nivel0: { senales: [], score: 0 },
      evidencia: [],
      salidas: {},
      timeline: [],
      ia: { llamadas: 0, tokens: 0, costo_estimado: 0 },
    };
    expect(
      Caso.safeParse({ ...base, decision: { accion: 'PAUSAR', regla: 'P11', t: 'ahora' } }).success,
    ).toBe(false);
    expect(
      Caso.safeParse({ ...base, decision: { accion: 'PAUSAR', regla: 'P4', t: 'ahora' } }).success,
    ).toBe(true);
  });
});

describe('Veredicto de Memoria', () => {
  const base = {
    cuenta: 'M-01',
    veredicto: 'mula_confirmada' as const,
    validado_por: 'analista_01',
    fecha: '2026-10-17',
    expira: '2027-01-15',
    expediente: 'CASO-0001',
    apelacion_abierta: false,
  };

  it('valida el ejemplo del doc 19 §5', () => {
    expect(Veredicto.safeParse(base).success).toBe(true);
  });

  it('exige validado_por — sin humano no entra a Memoria (R10)', () => {
    expect(Veredicto.safeParse({ ...base, validado_por: '' }).success).toBe(false);
    const sinValidador: Record<string, unknown> = { ...base };
    delete sinValidador.validado_por;
    expect(Veredicto.safeParse(sinValidador).success).toBe(false);
  });

  it('la vigencia expira', () => {
    const hoy = new Date('2026-12-01T00:00:00Z');
    expect(veredictoVigente(base, hoy)).toBe(true);
    expect(veredictoVigente({ ...base, expira: '2026-11-30' }, hoy)).toBe(false);
  });

  it('una apelación abierta suspende la vigencia', () => {
    const hoy = new Date('2026-12-01T00:00:00Z');
    expect(veredictoVigente({ ...base, apelacion_abierta: true }, hoy)).toBe(false);
  });

  it('la vigencia por defecto son 90 días', () => {
    expect(DIAS_VIGENCIA_VEREDICTO).toBe(90);
  });
});
