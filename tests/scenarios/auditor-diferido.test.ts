import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evaluarTransferencia } from '@/lib/pipeline';
import { storeCasos } from '@/lib/cases/store';
import { memoria } from '@/lib/memory/store';
import { decide } from '@/lib/policy/engine';
import { debeDiferirAuditor } from '@/lib/diferir';
import { POST as transfers } from '@/app/api/transfers/route';

/**
 * Auditor diferido: con el modelo real, la respuesta sale con la decisión y
 * el expediente llega después por polling. Y la Policy con pregunta pendiente.
 */

const ROSA = {
  transaccion: { origen: 'C-ROSA', destino: 'M-01', monto: 4800, moneda: 'PEN' as const },
  contexto: { llamada_activa_o_acceso_remoto: true },
  respuestaCliente: 'sí, me está guiando un asesor del banco',
};

const previo = process.env.AUDITOR_DIFERIDO;

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
});
afterEach(() => {
  if (previo === undefined) delete process.env.AUDITOR_DIFERIDO;
  else process.env.AUDITOR_DIFERIDO = previo;
});

describe('expediente diferido (pipeline)', () => {
  it('la decisión sale sin esperar al Auditor; el expediente llega después', async () => {
    const pendientes: (() => Promise<void>)[] = [];
    const { caso } = await evaluarTransferencia(ROSA.transaccion, {
      contexto: ROSA.contexto,
      respuestaCliente: ROSA.respuestaCliente,
      diferir: (t) => pendientes.push(t),
    });
    expect(caso.decision).toMatchObject({ accion: 'ESCALAR', regla: 'P4' });
    expect(caso.salidas.auditor).toBeUndefined();
    expect(caso.timeline.map((e) => e.evento)).toContain('expediente_en_curso');

    await pendientes[0]();
    expect(storeCasos.get(caso.id)!.caso.salidas.auditor).toBeDefined();
    expect(caso.decision).toMatchObject({ accion: 'ESCALAR', regla: 'P4' }); // no cambia
  });

  it('sin diferir (demo de consola, tests) se espera al Auditor como siempre', async () => {
    const { caso } = await evaluarTransferencia(ROSA.transaccion, { contexto: ROSA.contexto, respuestaCliente: ROSA.respuestaCliente });
    expect(caso.salidas.auditor).toBeDefined();
  });
});

describe('cuándo diferir', () => {
  it('simulado → no; con Claude → sí; la variable fuerza', () => {
    expect(debeDiferirAuditor({ NODE_ENV: 'test' })).toBe(false);
    expect(debeDiferirAuditor({ NODE_ENV: 'test', ANTHROPIC_API_KEY: 'sk-ant-real' })).toBe(true);
    expect(debeDiferirAuditor({ NODE_ENV: 'test', AUDITOR_DIFERIDO: '1' })).toBe(true);
    expect(debeDiferirAuditor({ NODE_ENV: 'test', ANTHROPIC_API_KEY: 'sk-ant-real', AUDITOR_DIFERIDO: '0' })).toBe(false);
  });

  it('la ruta responde sin expediente y el expediente aparece por polling', async () => {
    process.env.AUDITOR_DIFERIDO = '1';
    const r = await transfers(
      new Request('http://test/api/transfers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(ROSA),
      }),
    );
    const caso = await r.json();
    expect(r.status).toBe(201);
    expect(caso.decision.regla).toBe('P4');
    expect(caso.salidas.auditor).toBeUndefined();
    for (let i = 0; i < 50 && !storeCasos.get(caso.id)!.caso.salidas.auditor; i++) {
      await new Promise((ok) => setTimeout(ok, 5));
    }
    expect(storeCasos.get(caso.id)!.caso.salidas.auditor).toBeDefined();
  });
});

describe('Policy — pregunta del Guardián sin responder', () => {
  it('destino bajo + pregunta pendiente → PAUSAR P7, no PERMITIR P8', () => {
    expect(decide({ mulaEnMemoria: false, score: 7, riesgoDestino: 'bajo', guardianPendiente: true })).toMatchObject({
      accion: 'PAUSAR',
      regla: 'P7',
    });
  });

  it('destino alto + pregunta pendiente → sigue escalando por P5', () => {
    expect(decide({ mulaEnMemoria: false, score: 7, riesgoDestino: 'alto', guardianPendiente: true }).regla).toBe('P5');
  });

  it('CU-05: sin Guardián invocado, la Bodega sigue pasando por P8', () => {
    expect(decide({ mulaEnMemoria: false, score: 4, riesgoDestino: 'bajo' })).toMatchObject({ accion: 'PERMITIR', regla: 'P8' });
  });
});
