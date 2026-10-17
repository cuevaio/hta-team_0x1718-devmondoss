import { describe, it, expect } from 'vitest';
import {
  validarCitasAuditor,
  aplicarConsistenciaDetective,
  esMulaProbable,
  type Evidencia,
  type SalidaAuditor,
  type SalidaDetective,
} from '@/lib/contracts';

const evidenciaDelCaso: Evidencia[] = [
  { id: 'E-04', fuente: 'guardian_chat', dato: { guiado: true } },
  { id: 'E-07', fuente: 'fan_in', dato: { remitentes_nuevos: 14, horas: 48 } },
  { id: 'E-08', fuente: 'reenvio_rapido', dato: { pct: 0.91, horas: 2 } },
];

const auditorBase: SalidaAuditor = {
  resumen: 'x',
  hipotesis: 'estafa_vishing + mula',
  recomendacion: 'escalar',
  afirmaciones: [],
  acciones_sugeridas: [],
  confianza: 'alta',
  requiere_revision_manual: false,
};

describe('validarCitasAuditor — control antialucinación (19 §3, R9)', () => {
  it('acepta un expediente donde toda afirmación cita evidencia existente', () => {
    const r = validarCitasAuditor(
      {
        ...auditorBase,
        afirmaciones: [
          { texto: 'Recibió de 14 remitentes nuevos en 48h', evidencia: ['E-07'] },
          { texto: 'Reenvió el 91% en menos de 2h', evidencia: ['E-08'] },
        ],
      },
      evidenciaDelCaso,
    );
    expect(r.valido).toBe(true);
    expect(r.idsInexistentes).toEqual([]);
  });

  it('detecta un id inventado que NO existe en el caso', () => {
    const r = validarCitasAuditor(
      {
        ...auditorBase,
        afirmaciones: [{ texto: 'La cuenta está en lista OFAC', evidencia: ['E-99'] }],
      },
      evidenciaDelCaso,
    );
    expect(r.valido).toBe(false);
    expect(r.idsInexistentes).toEqual(['E-99']);
    expect(r.afirmacionesSinRespaldo).toEqual([0]);
  });

  it('una afirmación con una cita válida y otra inventada sigue marcando el id inventado', () => {
    const r = validarCitasAuditor(
      {
        ...auditorBase,
        afirmaciones: [{ texto: 'Mula en cadena', evidencia: ['E-07', 'E-99'] }],
      },
      evidenciaDelCaso,
    );
    expect(r.valido).toBe(false);
    expect(r.idsInexistentes).toEqual(['E-99']);
    // Tiene al menos un respaldo válido, así que no entra en afirmacionesSinRespaldo.
    expect(r.afirmacionesSinRespaldo).toEqual([]);
  });

  it('reporta el índice de cada afirmación sin respaldo', () => {
    const r = validarCitasAuditor(
      {
        ...auditorBase,
        afirmaciones: [
          { texto: 'ok', evidencia: ['E-04'] },
          { texto: 'inventada', evidencia: ['E-50'] },
          { texto: 'ok', evidencia: ['E-08'] },
          { texto: 'inventada', evidencia: ['E-51'] },
        ],
      },
      evidenciaDelCaso,
    );
    expect(r.afirmacionesSinRespaldo).toEqual([1, 3]);
  });

  it('un expediente sin afirmaciones es válido por vacuidad', () => {
    const r = validarCitasAuditor(auditorBase, evidenciaDelCaso);
    expect(r.valido).toBe(true);
  });
});

describe('aplicarConsistenciaDetective — 19 §3', () => {
  const detectiveBase: SalidaDetective = {
    riesgo_destino: 'alto',
    tipologias: ['fan_in', 'reenvio_rapido'],
    hipotesis: 'cuenta de paso',
    cadena: ['M-01'],
    evidencia: ['E-07'],
  };

  it('baja alto a medio cuando ninguna tool marcó tipología', () => {
    const r = aplicarConsistenciaDetective(detectiveBase, []);
    expect(r.salida.riesgo_destino).toBe('medio');
    expect(r.ajustado).toBe(true);
    expect(r.motivo).toBeDefined();
  });

  it('respeta alto cuando las tools sí marcaron tipología', () => {
    const r = aplicarConsistenciaDetective(detectiveBase, ['fan_in', 'reenvio_rapido']);
    expect(r.salida.riesgo_destino).toBe('alto');
    expect(r.ajustado).toBe(false);
  });

  it('no toca riesgo bajo ni medio aunque no haya tipologías', () => {
    for (const riesgo of ['bajo', 'medio'] as const) {
      const r = aplicarConsistenciaDetective({ ...detectiveBase, riesgo_destino: riesgo }, []);
      expect(r.salida.riesgo_destino).toBe(riesgo);
      expect(r.ajustado).toBe(false);
    }
  });

  it('no muta la salida original', () => {
    const original = { ...detectiveBase };
    aplicarConsistenciaDetective(detectiveBase, []);
    expect(detectiveBase).toEqual(original);
  });
});

describe('esMulaProbable — control de falsos positivos del demo', () => {
  it('fan_in + reenvio_rapido es mula probable (M-01)', () => {
    expect(esMulaProbable(['fan_in', 'reenvio_rapido'])).toBe(true);
  });

  it('fan_in solo NO basta — es el caso de Bodega Don Pepe', () => {
    expect(esMulaProbable(['fan_in'])).toBe(false);
  });

  it('reenvio_rapido solo no basta', () => {
    expect(esMulaProbable(['reenvio_rapido'])).toBe(false);
  });

  it('sin tipologías no es mula', () => {
    expect(esMulaProbable([])).toBe(false);
  });

  it('otras tipologías no sustituyen al par requerido', () => {
    expect(esMulaProbable(['fan_in', 'estructuracion', 'circular'])).toBe(false);
  });
});
