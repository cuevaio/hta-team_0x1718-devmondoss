import { describe, it, expect } from 'vitest';
import { decide, type EntradaPolicy } from '@/lib/policy/engine';

/**
 * Policy Engine — doc 19 §4.
 *
 * Lo que más importa aquí no es que cada regla funcione aislada, sino que el
 * ORDEN sea el correcto: "la primera regla que aplica gana". Un reordenamiento
 * accidental cambiaría decisiones sobre dinero sin romper ningún otro test.
 */

const base: EntradaPolicy = { mulaEnMemoria: false, score: 0 };

describe('P1 — mula confirmada en Memoria (CU-03)', () => {
  it('escala sin mirar nada más', () => {
    const r = decide({ ...base, mulaEnMemoria: true, score: 0 });
    expect(r.regla).toBe('P1');
    expect(r.accion).toBe('ESCALAR');
  });

  it('gana sobre P2: ser beneficiario habitual no salva a una mula confirmada', () => {
    const r = decide({ ...base, mulaEnMemoria: true, atajo: 'P2' });
    expect(r.regla).toBe('P1');
  });

  it('gana sobre P3: aunque el score sea bajo', () => {
    const r = decide({ ...base, mulaEnMemoria: true, score: 0, riesgoDestino: 'bajo' });
    expect(r.regla).toBe('P1');
  });
});

describe('P2 — beneficiario habitual (el hotel de Lucía, CU-04)', () => {
  it('permite aunque el cliente no esté alcanzable', () => {
    const r = decide({ ...base, atajo: 'P2', score: 4, estadoUsuario: 'sin_respuesta' });
    expect(r.regla).toBe('P2');
    expect(r.accion).toBe('PERMITIR');
  });

  it('gana sobre P7: el pago recurrente no se pausa por silencio del titular', () => {
    const r = decide({ ...base, atajo: 'P2', estadoUsuario: 'canal_comprometido', score: 6 });
    expect(r.regla).toBe('P2');
    expect(r.accion).toBe('PERMITIR');
  });
});

describe('P3 — score bajo', () => {
  it('permite con score 0–2', () => {
    for (const score of [0, 1, 2]) {
      const r = decide({ ...base, score });
      expect(r.regla, `score ${score}`).toBe('P3');
      expect(r.accion).toBe('PERMITIR');
    }
  });

  it('no aplica con score 3 o más', () => {
    expect(decide({ ...base, score: 3, riesgoDestino: 'bajo' }).regla).not.toBe('P3');
  });
});

describe('Estados inalcanzables — endurecimiento de P3', () => {
  /**
   * El doc 19 §4 pone P3 (score bajo → PERMITIR) antes de P4, y el doc §2 dice
   * que con score 0–2 se permite SIN IA. Por lo tanto "score bajo + Detective
   * dijo alto" no puede ocurrir en el pipeline.
   *
   * Pero `decide()` es pública. Si alguien la llama con esa combinación, el
   * orden literal del doc liberaría el dinero. Se endurece P3 para fallar
   * seguro. Esto NO cambia ningún comportamiento alcanzable.
   */
  it('score bajo + destino alto no libera dinero, aunque el doc ponga P3 antes de P4', () => {
    const r = decide({ ...base, score: 0, riesgoDestino: 'alto' });
    expect(r.accion).not.toBe('PERMITIR');
  });

  it('con score bajo y destino NO alto, P3 sigue siendo la regla del doc', () => {
    expect(decide({ ...base, score: 1 }).regla).toBe('P3');
    expect(decide({ ...base, score: 1, riesgoDestino: 'bajo' }).regla).toBe('P3');
    expect(decide({ ...base, score: 1, riesgoDestino: 'medio' }).regla).toBe('P3');
  });
});

describe('P4 — destino alto + cliente en estado no seguro (CU-01)', () => {
  it.each(['manipulacion_probable', 'sin_respuesta', 'canal_comprometido'] as const)(
    'escala con estado %s',
    (estadoUsuario) => {
      const r = decide({ ...base, score: 7, riesgoDestino: 'alto', estadoUsuario });
      expect(r.regla).toBe('P4');
      expect(r.accion).toBe('ESCALAR');
    },
  );
});

describe('P5 — destino alto y el cliente no desmiente (coerción R7, o Puerta B)', () => {
  it('escala cuando no hay Guardián: Puerta B no tiene cliente a quien preguntar', () => {
    const r = decide({ ...base, score: 5, riesgoDestino: 'alto' });
    expect(r.regla).toBe('P5');
    expect(r.accion).toBe('ESCALAR');
  });

  it('P4 y P5 juntos cubren TODO destino alto: nunca cae a P10 por omisión', () => {
    const estados = [
      undefined, 'confirmado_seguro', 'manipulacion_probable',
      'sin_respuesta', 'canal_comprometido', 'no_consultado',
    ] as const;
    for (const estadoUsuario of estados) {
      const r = decide({ ...base, score: 5, riesgoDestino: 'alto', estadoUsuario });
      expect(['P4', 'P5'], `estado=${estadoUsuario}`).toContain(r.regla);
    }
  });

  it('mantiene la pausa: no se cree la confirmación cuando el destino es mula', () => {
    const r = decide({
      ...base,
      score: 7,
      riesgoDestino: 'alto',
      estadoUsuario: 'confirmado_seguro',
    });
    expect(r.regla).toBe('P5');
    expect(r.accion).toBe('ESCALAR');
    expect(r.motivo).toMatch(/coerción/i);
  });

  it('no se adelanta a P4: con estado no seguro gana P4', () => {
    const r = decide({
      ...base,
      score: 7,
      riesgoDestino: 'alto',
      estadoUsuario: 'manipulacion_probable',
    });
    expect(r.regla).toBe('P4');
  });
});

describe('P6 — manipulación probable con destino bajo/medio', () => {
  it('verifica con cooldown', () => {
    const r = decide({
      ...base,
      score: 5,
      riesgoDestino: 'medio',
      estadoUsuario: 'manipulacion_probable',
    });
    expect(r.regla).toBe('P6');
    expect(r.accion).toBe('VERIFICAR');
  });

  it('cede ante P4 cuando el destino es alto', () => {
    const r = decide({
      ...base,
      score: 5,
      riesgoDestino: 'alto',
      estadoUsuario: 'manipulacion_probable',
    });
    expect(r.regla).toBe('P4');
  });
});

describe('P7 — el silencio no es aprobación (CU-04)', () => {
  it.each(['sin_respuesta', 'canal_comprometido'] as const)('pausa con estado %s', (estado) => {
    const r = decide({ ...base, score: 6, riesgoDestino: 'medio', estadoUsuario: estado });
    expect(r.regla).toBe('P7');
    expect(r.accion).toBe('PAUSAR');
  });

  it('nunca permite por falta de respuesta', () => {
    const r = decide({ ...base, score: 6, estadoUsuario: 'sin_respuesta' });
    expect(r.accion).not.toBe('PERMITIR');
  });
});

describe('P8 — destino bajo y cliente sin alertas (CU-05, Bodega)', () => {
  it('permite el pago a la bodega', () => {
    const r = decide({
      ...base,
      score: 4,
      riesgoDestino: 'bajo',
      estadoUsuario: 'no_consultado',
    });
    expect(r.regla).toBe('P8');
    expect(r.accion).toBe('PERMITIR');
  });

  it('permite también si el Guardián no se invocó (CU-05: no molestar al cliente)', () => {
    const r = decide({ ...base, score: 4, riesgoDestino: 'bajo' });
    expect(r.regla).toBe('P8');
    expect(r.accion).toBe('PERMITIR');
  });

  it('NO permite si el cliente muestra manipulación', () => {
    const r = decide({
      ...base,
      score: 4,
      riesgoDestino: 'bajo',
      estadoUsuario: 'manipulacion_probable',
    });
    expect(r.regla).toBe('P6');
    expect(r.accion).toBe('VERIFICAR');
  });
});

describe('P9 — destino medio y cliente sin alertas', () => {
  it('verifica con cooldown corto', () => {
    const r = decide({
      ...base,
      score: 4,
      riesgoDestino: 'medio',
      estadoUsuario: 'confirmado_seguro',
    });
    expect(r.regla).toBe('P9');
    expect(r.accion).toBe('VERIFICAR');
  });
});

describe('P10 — modo seguro ante degradación', () => {
  it('score alto + degradado → pausa con revisión humana', () => {
    const r = decide({ ...base, score: 7, degradado: true });
    expect(r.regla).toBe('P10');
    expect(r.accion).toBe('PAUSAR');
  });

  it('score no alto + degradado → verificar', () => {
    const r = decide({ ...base, score: 3, degradado: true });
    expect(r.regla).toBe('P10');
    expect(r.accion).toBe('VERIFICAR');
  });

  it('degradado NUNCA permite, ni con score 0', () => {
    const r = decide({ ...base, score: 0, degradado: true });
    expect(r.accion).not.toBe('PERMITIR');
  });

  it('un caso sin salidas de agentes y score alto no se libera por omisión', () => {
    const r = decide({ ...base, score: 7 });
    expect(r.accion).toBe('PAUSAR');
    expect(r.regla).toBe('P10');
  });
});

describe('Invariantes de seguridad del Policy Engine', () => {
  it('siempre devuelve una regla P1..P10 y una acción válida', () => {
    const escenarios: EntradaPolicy[] = [
      { mulaEnMemoria: false, score: 0 },
      { mulaEnMemoria: true, score: 9 },
      { mulaEnMemoria: false, score: 5, riesgoDestino: 'alto', estadoUsuario: 'sin_respuesta' },
      { mulaEnMemoria: false, score: 4, riesgoDestino: 'bajo' },
      { mulaEnMemoria: false, score: 3, degradado: true },
      { mulaEnMemoria: false, score: 12, atajo: 'P2' },
    ];
    for (const e of escenarios) {
      const r = decide(e);
      expect(r.regla).toMatch(/^P([1-9]|10)$/);
      expect(['PERMITIR', 'PAUSAR', 'VERIFICAR', 'ESCALAR']).toContain(r.accion);
      expect(r.motivo.length).toBeGreaterThan(0);
    }
  });

  it('nunca permite cuando el destino es de riesgo alto', () => {
    const estados = [
      undefined,
      'confirmado_seguro',
      'manipulacion_probable',
      'sin_respuesta',
      'canal_comprometido',
      'no_consultado',
    ] as const;
    for (const estadoUsuario of estados) {
      for (const score of [0, 3, 5, 9]) {
        const r = decide({ ...base, score, riesgoDestino: 'alto', estadoUsuario });
        // Única excepción legítima del doc: P2, beneficiario habitual sin compromiso.
        if (r.regla === 'P2') continue;
        expect(r.accion, `estado=${estadoUsuario} score=${score} → ${r.regla}`).not.toBe(
          'PERMITIR',
        );
      }
    }
  });

  it('es determinista: la misma entrada da la misma salida', () => {
    const e: EntradaPolicy = {
      mulaEnMemoria: false,
      score: 7,
      riesgoDestino: 'alto',
      estadoUsuario: 'manipulacion_probable',
    };
    expect(decide(e)).toEqual(decide(e));
  });
});
