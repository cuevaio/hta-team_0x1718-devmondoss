import { describe, it, expect } from 'vitest';
import type { Caso, DecisionAccion, ReglaPolicy, SalidaAuditor } from '@/lib/contracts';
import {
  embudo,
  llamadasEvitadasPorMemoria,
  metricas,
  modoSeguro,
  trazabilidad,
  ttpaDe,
} from '@/lib/observability';

/**
 * Métricas del doc 14 sobre casos construidos a mano.
 *
 * Son funciones puras: estos tests no tocan ningún store, así cada número se
 * puede verificar contra una cuenta hecha a mano.
 */

const T0 = Date.parse('2026-10-17T02:13:00.000Z');
const en = (ms: number) => new Date(T0 + ms).toISOString();

function caso(p: {
  id?: string;
  destino?: string;
  score?: number;
  llamadas?: number;
  accion?: DecisionAccion;
  regla?: ReglaPolicy;
  decisionMs?: number;
  pausaMs?: number;
  eventos?: string[];
  auditor?: SalidaAuditor;
  evidencia?: string[];
}): Caso {
  const timeline: Caso['timeline'] = [{ t: en(0), actor: 'sistema', evento: 'caso_creado' }];
  if (p.pausaMs !== undefined) {
    timeline.push({ t: en(p.pausaMs), actor: 'sistema', evento: 'pausa_preventiva' });
  }
  for (const evento of p.eventos ?? []) timeline.push({ t: en(1), actor: 'sistema', evento });
  return {
    id: p.id ?? 'CASO-X',
    puerta: 'transferencia',
    transaccion: { origen: 'C-A', destino: p.destino ?? 'M-01', monto: 100, moneda: 'PEN' },
    nivel0: { senales: [], score: p.score ?? 5 },
    evidencia: (p.evidencia ?? []).map((id) => ({ id, fuente: 'test', dato: null })),
    salidas: p.auditor ? { auditor: p.auditor } : {},
    timeline,
    ia: { llamadas: p.llamadas ?? 0, tokens: 0, costo_estimado: 0 },
    ...(p.accion && p.regla
      ? { decision: { accion: p.accion, regla: p.regla, t: en(p.decisionMs ?? 0) } }
      : {}),
  } as Caso;
}

const auditorQueCita = (...citas: string[][]): SalidaAuditor => ({
  resumen: 'r',
  hipotesis: 'h',
  recomendacion: 'escalar',
  afirmaciones: citas.map((evidencia, i) => ({ texto: `afirmación ${i}`, evidencia })),
  acciones_sugeridas: [],
  confianza: 'alta',
  requiere_revision_manual: false,
});

describe('"no medido" no es "cero"', () => {
  it('sin casos, todos los cocientes son null', () => {
    const m = metricas([]);
    expect(m.eficiencia_ia.pct_transacciones_con_ia).toBeNull();
    expect(m.eficiencia_ia.hit_rate_memoria).toBeNull();
    expect(m.eficiencia_ia.llamadas_por_caso_con_ia).toBeNull();
    expect(m.eficiencia_ia.llamadas_evitadas_por_memoria.estimado).toBeNull();
    expect(m.modo_seguro.tasa_modo_seguro).toBeNull();
    expect(m.friccion.tasa_de_retencion).toBeNull();
    expect(m.trazabilidad.pct_afirmaciones_citadas).toBeNull();
    expect(m.ttpa.con_pausa_preventiva.p50_ms).toBeNull();
  });
});

describe('embudo — forma histórica de /api/stats', () => {
  it('conserva exactamente las claves que consumen el demo y la Fase 2', () => {
    expect(Object.keys(embudo([])).sort()).toEqual(
      [
        'con_llamadas_de_ia',
        'costo_estimado_total',
        'llamadas_de_ia_totales',
        'por_regla',
        'sospechosas',
        'transacciones_evaluadas',
      ].sort(),
    );
  });

  it('cuenta sospechosas con score >= 3', () => {
    const e = embudo([caso({ score: 2 }), caso({ score: 3 }), caso({ score: 7 })]);
    expect(e.sospechosas).toBe(2);
  });
});

describe('E6 — llamadas evitadas por la Memoria', () => {
  it('usa lo que costó investigar ESE destino, no el promedio global', () => {
    const casos = [
      caso({ destino: 'M-01', llamadas: 3, accion: 'ESCALAR', regla: 'P4' }),
      caso({ destino: 'B-PEPE', llamadas: 1, accion: 'PERMITIR', regla: 'P8' }),
      caso({ destino: 'M-01', llamadas: 0, accion: 'ESCALAR', regla: 'P1' }),
    ];
    const r = llamadasEvitadasPorMemoria(casos);
    // Promedio global sería (3+1)/2 = 2; lo correcto es 3, lo que costó M-01.
    expect(r.estimado).toBe(3);
    expect(r.casos_p1_con_base).toBe(1);
  });

  it('no estima un P1 sin investigación previa comparable', () => {
    const r = llamadasEvitadasPorMemoria([
      caso({ destino: 'B-PEPE', llamadas: 4, accion: 'PERMITIR', regla: 'P8' }),
      caso({ destino: 'M-01', accion: 'ESCALAR', regla: 'P1' }),
    ]);
    expect(r.estimado).toBeNull();
    expect(r.casos_p1).toBe(1);
    expect(r.casos_p1_con_base).toBe(0);
  });

  it('solo mira casos ANTERIORES: no usa el futuro para justificar el pasado', () => {
    const r = llamadasEvitadasPorMemoria([
      caso({ destino: 'M-01', accion: 'ESCALAR', regla: 'P1' }),
      caso({ destino: 'M-01', llamadas: 5, accion: 'ESCALAR', regla: 'P4' }),
    ]);
    expect(r.estimado).toBeNull();
  });

  it('un P1 previo (0 llamadas) no rebaja el costo de referencia', () => {
    const r = llamadasEvitadasPorMemoria([
      caso({ destino: 'M-01', llamadas: 2, accion: 'ESCALAR', regla: 'P5' }),
      caso({ destino: 'M-01', accion: 'ESCALAR', regla: 'P1' }),
      caso({ destino: 'M-01', accion: 'ESCALAR', regla: 'P1' }),
    ]);
    expect(r.estimado).toBe(4);
    expect(r.casos_p1_con_base).toBe(2);
  });
});

describe('Trazabilidad — % de afirmaciones con evidencia válida', () => {
  it('100% cuando todas las citas existen en el caso', () => {
    const t = trazabilidad([
      caso({ evidencia: ['E-01', 'E-02'], auditor: auditorQueCita(['E-01'], ['E-01', 'E-02']) }),
    ]);
    expect(t.pct_afirmaciones_citadas).toBe(1);
    expect(t.expedientes_con_evidencia_completa).toBe(1);
    expect(t.citas_inexistentes).toBe(0);
  });

  it('detecta una cita inventada: E-99 no existe en el caso', () => {
    const t = trazabilidad([
      caso({ evidencia: ['E-01'], auditor: auditorQueCita(['E-01'], ['E-99']) }),
    ]);
    expect(t.citas_inexistentes).toBe(1);
    expect(t.afirmaciones_con_cita_valida).toBe(1);
    expect(t.pct_afirmaciones_citadas).toBe(0.5);
    expect(t.expedientes_con_evidencia_completa).toBe(0);
  });
});

describe('TTPA — tiempo hasta la acción protectora', () => {
  it('con pausa preventiva, mide hasta la pausa aunque la decisión llegue tarde', () => {
    const c = caso({ accion: 'ESCALAR', regla: 'P4', pausaMs: 2, decisionMs: 4000 });
    expect(ttpaDe(c)).toBe(2);
  });

  it('sin pausa preventiva, mide hasta la decisión que retiene', () => {
    expect(ttpaDe(caso({ accion: 'VERIFICAR', regla: 'P9', decisionMs: 350 }))).toBe(350);
  });

  it('un caso PERMITIDO no tiene acción protectora: no se mide', () => {
    expect(ttpaDe(caso({ accion: 'PERMITIR', regla: 'P8', decisionMs: 10 }))).toBeNull();
  });

  it('separa los casos con pausa de los que no la tuvieron', () => {
    const m = metricas([
      caso({ accion: 'ESCALAR', regla: 'P4', pausaMs: 1, decisionMs: 900 }),
      caso({ accion: 'ESCALAR', regla: 'P4', pausaMs: 3, decisionMs: 900 }),
      caso({ accion: 'VERIFICAR', regla: 'P9', decisionMs: 700 }),
    ]);
    expect(m.ttpa.con_pausa_preventiva).toMatchObject({ casos: 2, max_ms: 3 });
    expect(m.ttpa.sin_pausa_preventiva).toMatchObject({ casos: 1, p50_ms: 700 });
  });
});

describe('Modo seguro', () => {
  it('cuenta los casos con falla de agente y los decididos por P10', () => {
    const m = modoSeguro([
      caso({ accion: 'PAUSAR', regla: 'P10', eventos: ['error_agentes'] }),
      caso({ accion: 'ESCALAR', regla: 'P4', eventos: ['error_auditor'] }),
      caso({ accion: 'PERMITIR', regla: 'P8' }),
    ]);
    expect(m.casos_con_falla_de_agente).toBe(2);
    expect(m.decididos_por_p10).toBe(1);
    expect(m.tasa_modo_seguro).toBe(0.333);
  });
});
