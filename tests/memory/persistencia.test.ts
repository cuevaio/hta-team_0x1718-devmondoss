import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoriaRiesgo, crearVeredicto } from '@/lib/memory/store';

/**
 * Persistencia opcional de la Memoria (`MEMORIA_ARCHIVO`, INFRA §4).
 *
 * Lo que importa: que un reinicio del proceso a mitad del demo no borre la
 * mula confirmada, sin abrir una puerta trasera a R10.
 */

const HOY = new Date('2026-10-17T02:13:00Z');
let dir = '';
let archivo = '';

const mula = (cuenta = 'M-01', validado_por = 'analista_01') =>
  crearVeredicto({ cuenta, veredicto: 'mula_confirmada', validado_por, expediente: 'CASO-0002', hoy: HOY });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'afs-memoria-'));
  archivo = join(dir, 'sub', 'memoria.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('sin archivo (por defecto)', () => {
  it('vive solo en RAM y no escribe nada', () => {
    const m = new MemoriaRiesgo();
    m.confirm('M-01', mula());
    expect(m.persistente).toBe(false);
    expect(readdirSync(dir)).toHaveLength(0);
  });
});

describe('con archivo', () => {
  it('sobrevive a un reinicio: CU-03 sigue protegiendo a Jorge', () => {
    new MemoriaRiesgo(archivo).confirm('M-01', mula());
    const reiniciada = new MemoriaRiesgo(archivo);
    expect(reiniciada.esMulaConfirmada('M-01', HOY)).toBe(true);
    expect(reiniciada.carga).toEqual({ cargados: 1, descartados: 0, apartado: null });
  });

  it('crea la carpeta si no existe y no deja el temporal', () => {
    new MemoriaRiesgo(archivo).confirm('M-01', mula());
    expect(existsSync(archivo)).toBe(true);
    expect(existsSync(`${archivo}.tmp`)).toBe(false);
  });

  it('la apelación también persiste', () => {
    const m = new MemoriaRiesgo(archivo);
    m.confirm('M-01', mula());
    m.abrirApelacion('M-01');
    expect(new MemoriaRiesgo(archivo).esMulaConfirmada('M-01', HOY)).toBe(false);
  });

  it('limpiar (el reset del demo) también vacía el archivo', () => {
    const m = new MemoriaRiesgo(archivo);
    m.confirm('M-01', mula());
    m.limpiar();
    expect(new MemoriaRiesgo(archivo).cantidad).toBe(0);
  });

  it('R10 al cargar: un veredicto sin humano, editado a mano, NO entra', () => {
    const valido = mula('M-01');
    const ruta = join(dir, 'memoria.json');
    writeFileSync(
      ruta,
      JSON.stringify([
        valido,
        { ...mula('M-02'), validado_por: '   ' },
        { ...mula('M-03'), validado_por: undefined },
        { cuenta: 'M-04', veredicto: 'mula_confirmada' },
      ]),
    );
    const m = new MemoriaRiesgo(ruta);
    expect(m.carga).toMatchObject({ cargados: 1, descartados: 3 });
    expect(m.esMulaConfirmada('M-01', HOY)).toBe(true);
    for (const c of ['M-02', 'M-03', 'M-04']) expect(m.esMulaConfirmada(c, HOY), c).toBe(false);
  });

  it('un archivo corrupto no tumba el servidor y no se sobrescribe: se aparta', () => {
    const ruta = join(dir, 'memoria.json');
    writeFileSync(ruta, '{ esto no es json');
    const m = new MemoriaRiesgo(ruta);
    expect(m.cantidad).toBe(0);
    expect(m.carga.apartado).toMatch(/memoria\.json\.corrupto-\d+$/);
    expect(readFileSync(m.carga.apartado!, 'utf8')).toBe('{ esto no es json');
  });

  it('un JSON que no es una lista se trata como descartado', () => {
    const ruta = join(dir, 'memoria.json');
    writeFileSync(ruta, JSON.stringify({ 'M-01': mula() }));
    const m = new MemoriaRiesgo(ruta);
    expect(m.cantidad).toBe(0);
    expect(m.carga.descartados).toBe(1);
  });

  it('un veredicto expirado se carga pero no cuenta como vigente', () => {
    const m = new MemoriaRiesgo(archivo);
    m.confirm('M-01', crearVeredicto({ cuenta: 'M-01', veredicto: 'mula_confirmada', validado_por: 'a', expediente: 'X', hoy: HOY, dias: 1 }));
    const despues = new Date('2026-12-01T00:00:00Z');
    expect(new MemoriaRiesgo(archivo).esMulaConfirmada('M-01', despues)).toBe(false);
  });
});
