import { describe, it, expect, beforeEach } from 'vitest';
import { MemoriaRiesgo, crearVeredicto } from '@/lib/memory/store';
import { LedgerEvidencia } from '@/lib/evidence/ledger';

describe('MemoriaRiesgo — doc 19 §5', () => {
  let mem: MemoriaRiesgo;
  const hoy = new Date('2026-10-17T00:00:00Z');

  beforeEach(() => {
    mem = new MemoriaRiesgo();
  });

  it('una cuenta desconocida devuelve null', () => {
    expect(mem.get('M-99', hoy)).toBeNull();
    expect(mem.esMulaConfirmada('M-99', hoy)).toBe(false);
  });

  it('guarda y recupera un veredicto validado (CU-02 → CU-03)', () => {
    const v = crearVeredicto({
      cuenta: 'M-01',
      veredicto: 'mula_confirmada',
      validado_por: 'analista_01',
      expediente: 'CASO-0001',
      hoy,
    });
    mem.confirm('M-01', v);
    expect(mem.esMulaConfirmada('M-01', hoy)).toBe(true);
  });

  it('R10 — rechaza un veredicto sin validador humano', () => {
    const v = crearVeredicto({
      cuenta: 'M-01',
      veredicto: 'mula_confirmada',
      validado_por: 'analista_01',
      expediente: 'CASO-0001',
      hoy,
    });
    expect(() => mem.confirm('M-01', { ...v, validado_por: '' })).toThrow(/validado_por/);
    expect(() => mem.confirm('M-01', { ...v, validado_por: '   ' })).toThrow(/R10/);
    expect(mem.cantidad).toBe(0);
  });

  it('rechaza un veredicto cuya cuenta no coincide', () => {
    const v = crearVeredicto({
      cuenta: 'M-02',
      veredicto: 'mula_confirmada',
      validado_por: 'analista_01',
      expediente: 'CASO-0001',
      hoy,
    });
    expect(() => mem.confirm('M-01', v)).toThrow(/inconsistencia/i);
  });

  it('un veredicto "descartada" NO es mula confirmada', () => {
    // CU-02: si el analista descarta, la cuenta no entra como mula.
    const v = crearVeredicto({
      cuenta: 'B-PEPE',
      veredicto: 'descartada',
      validado_por: 'analista_01',
      expediente: 'CASO-0002',
      hoy,
    });
    mem.confirm('B-PEPE', v);
    expect(mem.get('B-PEPE', hoy)).not.toBeNull();
    expect(mem.esMulaConfirmada('B-PEPE', hoy)).toBe(false);
  });

  it('el veredicto expira a los 90 días', () => {
    const v = crearVeredicto({
      cuenta: 'M-01',
      veredicto: 'mula_confirmada',
      validado_por: 'analista_01',
      expediente: 'CASO-0001',
      hoy,
    });
    mem.confirm('M-01', v);
    expect(v.expira).toBe('2027-01-15');
    expect(mem.esMulaConfirmada('M-01', new Date('2027-01-15T00:00:00Z'))).toBe(true);
    expect(mem.esMulaConfirmada('M-01', new Date('2027-01-16T00:00:00Z'))).toBe(false);
  });

  it('una apelación abierta suspende la vigencia sin borrar el registro', () => {
    const v = crearVeredicto({
      cuenta: 'M-01',
      veredicto: 'mula_confirmada',
      validado_por: 'analista_01',
      expediente: 'CASO-0001',
      hoy,
    });
    mem.confirm('M-01', v);
    mem.abrirApelacion('M-01');
    expect(mem.esMulaConfirmada('M-01', hoy)).toBe(false);
    expect(mem.todos()).toHaveLength(1);
  });

  it('limpiar() vacía la memoria para el reset del demo', () => {
    mem.confirm(
      'M-01',
      crearVeredicto({
        cuenta: 'M-01',
        veredicto: 'mula_confirmada',
        validado_por: 'a',
        expediente: 'C',
        hoy,
      }),
    );
    mem.limpiar();
    expect(mem.cantidad).toBe(0);
  });
});

describe('LedgerEvidencia — los ids los asigna el sistema, no el LLM', () => {
  it('numera secuencialmente desde E-01', () => {
    const l = new LedgerEvidencia();
    expect(l.registrar('fan_in', { n: 14 }).id).toBe('E-01');
    expect(l.registrar('reenvio_rapido', { pct: 0.91 }).id).toBe('E-02');
    expect(l.cantidad).toBe(2);
  });

  it('existe() reconoce lo propio y rechaza lo inventado', () => {
    const l = new LedgerEvidencia();
    l.registrar('fan_in', {});
    expect(l.existe('E-01')).toBe(true);
    expect(l.existe('E-99')).toBe(false);
  });

  it('cada caso tiene su propia numeración: dos ledgers no se contaminan', () => {
    const a = new LedgerEvidencia();
    const b = new LedgerEvidencia();
    a.registrar('fan_in', {});
    a.registrar('ciclos', {});
    expect(b.registrar('fan_in', {}).id).toBe('E-01');
    expect(b.cantidad).toBe(1);
  });

  it('todas() devuelve una copia: mutarla no altera el ledger', () => {
    const l = new LedgerEvidencia();
    l.registrar('fan_in', {});
    l.todas().push({ id: 'E-99', fuente: 'inyectada', dato: null });
    expect(l.cantidad).toBe(1);
    expect(l.existe('E-99')).toBe(false);
  });

  it('conserva el dato calculado tal cual', () => {
    const l = new LedgerEvidencia();
    const e = l.registrar('fan_in', { remitentes_nuevos: 14, horas: 48 });
    expect(e.dato).toEqual({ remitentes_nuevos: 14, horas: 48 });
    expect(e.fuente).toBe('fan_in');
  });
});
