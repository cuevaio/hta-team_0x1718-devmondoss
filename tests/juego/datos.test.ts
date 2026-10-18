import { describe, it, expect, beforeEach } from 'vitest';
import { ReglaPolicy } from '@/lib/contracts';
import { evaluarAlerta, evaluarTransferencia, responderGuardian } from '@/lib/pipeline';
import { crearVeredicto, memoria } from '@/lib/memory/store';
import { storeCasos } from '@/lib/cases/store';
import { repo } from '@/lib/data/repo';
import {
  DESTINOS,
  ESTAFA_ROSA,
  PAGO_PROVEEDOR,
  SENALES,
  TACTICAS,
  VICTIMAS,
  actoresDe,
  armarTransferencia,
  explicar,
  preguntaPendiente,
  puntosDe,
  retiene,
} from '@/components/juego/datos';

/**
 * Lo que el demo jugable promete (docs/DEMO_JUEGO.md §3–4), comprobado contra
 * el pipeline real. Si alguien cambia reglas o policy, estos tests dicen si el
 * juego sigue contando la verdad.
 */

beforeEach(() => {
  storeCasos.limpiar();
  memoria.limpiar();
});

describe('traducciones', () => {
  it('toda regla de la Policy tiene explicación humana, sin códigos', () => {
    for (const regla of ReglaPolicy.options) {
      const e = explicar(regla);
      expect(e.titulo.length).toBeGreaterThan(0);
      expect(e.detalle).not.toMatch(/\bP\d+\b|score|E-\d+/);
    }
  });

  it('las señales con puntaje usan los puntajes reales de las reglas', () => {
    expect(puntosDe('llamada_activa')).toBe(3);
    expect(puntosDe('beneficiario_nuevo')).toBe(2);
    expect(puntosDe('alerta_aml')).toBeNull();
    expect(SENALES.llamada_activa).toMatch(/simulad/);
  });

  it('el destino de las jugadas son cuentas que existen en los datos', () => {
    for (const d of DESTINOS) expect(repo.cuentas().some((c) => c.id === d.id)).toBe(true);
    for (const v of VICTIMAS) expect(repo.clientePorCuenta(v.cuenta)).not.toBeNull();
  });
});

describe('armarTransferencia', () => {
  it('traduce la táctica a las señales del canal y la madrugada a horario atípico', () => {
    const body = armarTransferencia(
      { victima: 'lucia', tactica: 'duplicado_chip', destino: 'M-02', monto: 4800, madrugada: true },
      'Zorro',
    );
    expect(body.transaccion).toEqual({ origen: 'C-LUCIA', destino: 'M-02', monto: 4800, moneda: 'PEN' });
    expect(body.contexto).toEqual({
      cambio_sim_o_clave_72h: true,
      dispositivo_nuevo_24h: true,
      horario_atipico: true,
    });
    expect(body.alias).toBe('Zorro');
  });

  it('no muta el contexto de la táctica', () => {
    armarTransferencia({ victima: 'rosa', tactica: 'falso_familiar', destino: 'M-01', monto: 300, madrugada: true }, 'A');
    expect(TACTICAS.find((t) => t.id === 'falso_familiar')!.contexto).toEqual({});
  });

  it('toda combinación de víctima y táctica llega a una decisión del motor', async () => {
    for (const v of VICTIMAS) {
      for (const t of TACTICAS) {
        const body = armarTransferencia({ victima: v.id, tactica: t.id, destino: 'M-01', monto: 4800, madrugada: false }, 'A');
        const { caso } = await evaluarTransferencia(body.transaccion, { contexto: body.contexto });
        expect(caso.decision, `${v.id}/${t.id}`).toBeDefined();
      }
    }
  });
});

describe('ronda B de la víctima', () => {
  it('la estafa de Rosa queda retenida antes del Guardián y con una pregunta pendiente', async () => {
    const { caso } = await evaluarTransferencia(
      { ...ESTAFA_ROSA, moneda: 'PEN' },
      { contexto: { llamada_activa_o_acceso_remoto: true } },
    );
    expect(retiene(caso.decision!.accion)).toBe(true);
    expect(caso.timeline.some((e) => e.evento === 'pausa_preventiva')).toBe(true);
    expect(preguntaPendiente(caso)).toMatch(/teléfono/);
    expect(actoresDe(caso).slice(0, 2)).toEqual(['reglas', 'coordinador']);
  });

  it('decir «no, lo hago yo» no libera el dinero', async () => {
    const { caso } = await evaluarTransferencia(
      { ...ESTAFA_ROSA, moneda: 'PEN' },
      { contexto: { llamada_activa_o_acceso_remoto: true } },
    );
    let actual = caso;
    for (let i = 0; i < 3 && preguntaPendiente(actual); i++) {
      actual = (await responderGuardian(caso.id, 'no, lo hago yo'))!;
    }
    expect(retiene(actual.decision!.accion)).toBe(true);
  });

  it('el pago a Don Pepe pasa sin fricción', async () => {
    const { caso } = await evaluarTransferencia({ ...PAGO_PROVEEDOR, moneda: 'PEN' });
    expect(caso.decision).toMatchObject({ accion: 'PERMITIR', regla: 'P2' });
    expect(caso.ia.llamadas).toBe(0);
  });
});

describe('atacante', () => {
  it('un monto chico a una cuenta nueva pasa: es un hueco real que el juego muestra', async () => {
    const body = armarTransferencia(
      { victima: 'jorge', tactica: 'falso_familiar', destino: 'M-03', monto: 300, madrugada: false },
      'A',
    );
    const { caso } = await evaluarTransferencia(body.transaccion, { contexto: body.contexto });
    expect(caso.decision?.accion).toBe('PERMITIR');
  });

  it('tras confirmar M-01, el mismo hueco cae al instante por la Memoria, sin IA', async () => {
    const alerta = await evaluarAlerta('M-01', 'fan-in');
    memoria.confirm(
      'M-01',
      crearVeredicto({
        cuenta: 'M-01',
        veredicto: 'mula_confirmada',
        validado_por: 'analista_simulacion',
        expediente: alerta.caso.id,
        hoy: repo.ahora(),
      }),
    );
    const body = armarTransferencia(
      { victima: 'jorge', tactica: 'falso_familiar', destino: 'M-01', monto: 300, madrugada: false },
      'A',
    );
    const { caso } = await evaluarTransferencia(body.transaccion, { contexto: body.contexto });
    expect(caso.decision).toMatchObject({ accion: 'ESCALAR', regla: 'P1' });
    expect(caso.ia.llamadas).toBe(0);
    expect(actoresDe(caso)).toEqual(['reglas', 'memoria', 'policy']);
  });
});
