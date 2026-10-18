import { describe, it, expect, beforeEach } from 'vitest';
import type { AgentsApi, Transaccion } from '@/lib/contracts';
import { estadisticas, evaluarAlerta, evaluarTransferencia } from '@/lib/pipeline';
import { obtenerAgentes } from '@/lib/agents';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';
import { repo } from '@/lib/data/repo';
import { Registro, registro, ttpaDe } from '@/lib/observability';
import { POST as reset } from '@/app/api/demo/reset/route';

/**
 * Observabilidad sobre el pipeline real (doc 19 §9, doc 14).
 *
 * Lo que se verifica aquí son las afirmaciones del pitch que antes no se
 * medían: que la latencia de los agentes no expone dinero (TTPA), que el
 * expediente no retrasa la decisión, y que el registro no guarda lo que el
 * cliente escribe.
 */

const tx = (origen: string, destino: string, monto: number): Transaccion => ({
  origen,
  destino,
  monto,
  moneda: 'PEN',
});

/** Fuerza el modo simulado aunque haya una API key local: los tests nunca gastan. */
const SIN_API_KEY: NodeJS.ProcessEnv = { NODE_ENV: 'test' };

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Los agentes simulados de Tony, con latencia artificial. */
function agentesLentos(ms: { investigacion?: number; auditor?: number }): AgentsApi {
  const base = obtenerAgentes(SIN_API_KEY);
  return {
    coordinador: async (c, ctx) => (await dormir(ms.investigacion ?? 0), base.coordinador(c, ctx)),
    detective: async (c, ctx) => (await dormir(ms.investigacion ?? 0), base.detective(c, ctx)),
    guardianTurno: async (c, ctx, m) => base.guardianTurno(c, ctx, m),
    auditor: async (c, ctx) => (await dormir(ms.auditor ?? 0), base.auditor(c, ctx)),
  };
}

const ROSA = {
  contexto: { llamada_activa_o_acceso_remoto: true },
  respuestaCliente: 'sí, me está guiando un asesor del banco',
};

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
  registro.limpiar();
});

describe('TTPA medido, no supuesto', () => {
  it('la latencia de los agentes no retrasa la pausa preventiva', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      ...ROSA,
      agentes: agentesLentos({ investigacion: 120 }),
    });
    const ttpa = ttpaDe(caso)!;
    const creado = Date.parse(caso.timeline[0].t);
    const decidido = Date.parse(caso.decision!.t);

    expect(caso.decision?.accion).toBe('ESCALAR');
    expect(decidido - creado).toBeGreaterThanOrEqual(100); // la decisión sí esperó a los agentes
    expect(ttpa).toBeLessThan(100); // el dinero no
  });

  it('el expediente no retrasa la hora de la decisión', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      ...ROSA,
      agentes: agentesLentos({ auditor: 120 }),
    });
    const expediente = caso.timeline.find((e) => e.evento === 'expediente');
    expect(expediente).toBeDefined();
    // Antes, finalizar() reescribía decision.t después del Auditor.
    expect(Date.parse(expediente!.t) - Date.parse(caso.decision!.t)).toBeGreaterThanOrEqual(100);
  });

  it('el timeline conserva el orden documentado en API.md (… expediente → decision)', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), ROSA);
    const eventos = caso.timeline.map((e) => e.evento);
    expect(eventos.indexOf('expediente')).toBeLessThan(eventos.lastIndexOf('decision'));
  });
});

describe('Registro estructurado (doc 19 §9)', () => {
  it('registra cada agente que corrió y la decisión con su regla', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), ROSA);
    const delCaso = registro.todas().filter((e) => e.caso === caso.id);
    const agentes = new Set(delCaso.flatMap((e) => (e.tipo === 'agente' ? [e.agente] : [])));

    expect(agentes).toEqual(new Set(['coordinador', 'detective', 'guardian', 'auditor']));
    expect(delCaso.at(-1)).toMatchObject({ tipo: 'decision', regla: 'P4', accion: 'ESCALAR', degradado: false });
  });

  it('las llamadas registradas suman lo mismo que el contador del caso', async () => {
    const { caso } = await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), ROSA);
    const suma = registro
      .todas()
      .reduce((s, e) => s + (e.tipo === 'agente' && e.caso === caso.id ? e.llamadas : 0), 0);
    expect(suma).toBe(caso.ia.llamadas);
  });

  it('NO guarda lo que escribe el cliente (privacidad, R5)', async () => {
    await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), ROSA);
    const todo = JSON.stringify(registro.todas()).toLowerCase();
    expect(todo).not.toContain('asesor');
    expect(todo).not.toContain('me está guiando');
  });

  it('solo tiene campos de una lista cerrada: ni atributos de la persona (R1) ni texto libre', async () => {
    await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), ROSA);
    await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    const PERMITIDOS = new Set([
      'tipo', 't', 'caso', 'agente', 'llamadas', 'tokens', 'ms', 'resultado',
      'regla', 'accion', 'degradado', 'llamadas_ia_del_caso',
    ]);
    for (const e of registro.todas()) {
      for (const campo of Object.keys(e)) expect(PERMITIDOS, `campo «${campo}»`).toContain(campo);
    }
  });

  it('un agente que falla queda como error y la decisión como degradada', async () => {
    const base = obtenerAgentes(SIN_API_KEY);
    await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), {
      ...ROSA,
      agentes: {
        ...base,
        detective: async () => {
          throw new Error('timeout simulado');
        },
      },
    });
    const det = registro.todas().find((e) => e.tipo === 'agente' && e.agente === 'detective');
    expect(det).toMatchObject({ resultado: 'error' });
    expect(registro.todas().at(-1)).toMatchObject({ tipo: 'decision', regla: 'P10', degradado: true });
  });

  it('Jorge (P1) registra la decisión sin ninguna llamada de agente', async () => {
    memoria.confirm(
      'M-01',
      crearVeredicto({ cuenta: 'M-01', veredicto: 'mula_confirmada', validado_por: 'a1', expediente: 'X', hoy: repo.ahora() }),
    );
    const { caso } = await evaluarTransferencia(tx('C-JORGE', 'M-01', 2200));
    const delCaso = registro.todas().filter((e) => e.caso === caso.id);
    expect(delCaso).toHaveLength(1);
    expect(delCaso[0]).toMatchObject({ tipo: 'decision', regla: 'P1', llamadas_ia_del_caso: 0 });
  });

  it('está acotado: no crece sin límite en un proceso largo', () => {
    const r = new Registro(3);
    for (let i = 0; i < 10; i++) r.agente(`C-${i}`, 'detective', undefined, 'ok');
    expect(r.cantidad).toBe(3);
    expect(r.todas().map((e) => e.caso)).toEqual(['C-7', 'C-8', 'C-9']);
  });

  it('/api/demo/reset también vacía el registro', async () => {
    await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), ROSA);
    expect(registro.cantidad).toBeGreaterThan(0);
    await reset(new Request('http://test/api/demo/reset', { method: 'POST' }));
    expect(registro.cantidad).toBe(0);
  });
});

describe('/api/stats sobre la secuencia del demo', () => {
  async function secuenciaDemo() {
    await evaluarTransferencia(tx('C-ROSA', 'M-01', 4800), ROSA);
    const alerta = await evaluarAlerta('M-01', 'fan-in con reenvío inmediato');
    memoria.confirm(
      'M-01',
      crearVeredicto({ cuenta: 'M-01', veredicto: 'mula_confirmada', validado_por: 'analista_01', expediente: alerta.caso.id, hoy: repo.ahora() }),
    );
    await evaluarTransferencia(tx('C-JORGE', 'M-01', 2200));
    await evaluarTransferencia(tx('C-JORGE', 'B-PEPE', 2000));
    await evaluarTransferencia(tx('C-LUCIA', 'M-02', 3000), { contexto: { dispositivo_nuevo_24h: true } });
    await evaluarTransferencia(tx('C-LUCIA', 'H-SOL', 650));
  }

  it('mantiene las claves históricas y agrega las nuevas', async () => {
    await secuenciaDemo();
    const s = estadisticas();
    expect(s.transacciones_evaluadas).toBe(6);
    expect(s.mulas_en_memoria).toBe(1);
    expect(s.nota_datos).toMatch(/SINT[ÉE]TICOS/i);
    expect(s.metricas).toBeDefined();
    expect(s.registro_reciente.length).toBeLessThanOrEqual(20);
  });

  it('todas las afirmaciones de los expedientes citan evidencia que existe', async () => {
    await secuenciaDemo();
    const t = estadisticas().metricas.trazabilidad;
    expect(t.expedientes).toBeGreaterThan(0);
    expect(t.pct_afirmaciones_citadas).toBe(1);
    expect(t.citas_inexistentes).toBe(0);
  });

  it('el ahorro de Jorge se estima con lo que costó investigar M-01', async () => {
    await secuenciaDemo();
    const previosM01 = storeCasos
      .todos()
      .filter((c) => c.transaccion.destino === 'M-01' && c.decision?.regla !== 'P1' && c.ia.llamadas > 0);
    const esperado = previosM01.reduce((s, c) => s + c.ia.llamadas, 0) / previosM01.length;

    const e = estadisticas().metricas.eficiencia_ia;
    expect(e.resueltos_por_memoria).toBe(1);
    expect(e.llamadas_evitadas_por_memoria.casos_p1_con_base).toBe(1);
    expect(e.llamadas_evitadas_por_memoria.estimado).toBeCloseTo(esperado, 2);
  });

  it('los casos con pausa preventiva tienen TTPA medido', async () => {
    await secuenciaDemo();
    const { con_pausa_preventiva } = estadisticas().metricas.ttpa;
    expect(con_pausa_preventiva.casos).toBeGreaterThanOrEqual(3);
    expect(con_pausa_preventiva.p50_ms).not.toBeNull();
  });
});
