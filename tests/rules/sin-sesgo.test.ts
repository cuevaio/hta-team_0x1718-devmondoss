import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUNTAJES } from '@/lib/rules/level0';
import { repo } from '@/lib/data/repo';

/**
 * Test antisesgo — hace cumplir R1 del doc 15:
 *
 *   "Nunca usar edad, discapacidad o condición socioeconómica como atajo
 *    para 'fraud probability'. Adaptar el canal/protección, no penalizar
 *    identidad."
 *
 * Esto no es decorativo: un sistema antifraude que puntúa a las personas por
 * lo que son, en vez de por lo que ocurre en la operación, discrimina. Y es
 * exactamente el error fácil de cometer cuando se agregan señales "porque
 * mejoran el score".
 *
 * El test falla si alguien introduce un atributo de la persona en el modelo.
 */

const RAIZ = resolve(import.meta.dirname, '../..');

/** Términos que NO deben aparecer como señal ni como campo de datos. */
const TERMINOS_PROHIBIDOS = [
  'edad',
  'anios',
  'adulto_mayor',
  'discapacidad',
  'ciego',
  'sordo',
  'vulnerable',
  'analfabet',
  'ingreso',
  'pobreza',
  'nse',
  'genero',
  'sexo',
  'nacionalidad',
  'etnia',
  'religion',
  'salud',
  'diagnostic',
];

describe('R1 — el score no puede depender de atributos de la persona', () => {
  it('las 6 señales son todas propiedades de la operación, no del cliente', () => {
    // Si esta lista cambia, es una decisión de diseño que exige revisar R1.
    expect(Object.keys(PUNTAJES).sort()).toEqual(
      [
        'beneficiario_nuevo',
        'cambio_sim_o_clave',
        'dispositivo_nuevo',
        'horario_atipico',
        'llamada_activa',
        'monto_atipico',
      ].sort(),
    );
  });

  it('ninguna señal del score usa un término demográfico o de salud', () => {
    for (const senal of Object.keys(PUNTAJES)) {
      for (const prohibido of TERMINOS_PROHIBIDOS) {
        expect(senal.toLowerCase(), `señal "${senal}"`).not.toContain(prohibido);
      }
    }
  });

  it('el motor de reglas no importa datos del cliente: solo recibe el contexto de la operación', () => {
    const fuente = readFileSync(resolve(RAIZ, 'lib/rules/level0.ts'), 'utf8');
    // Si level0 leyera el repositorio de clientes, podría acceder a atributos
    // de la persona. Su única entrada debe ser ContextoOperacion.
    expect(fuente).not.toMatch(/from\s+['"]@\/lib\/data/);
    expect(fuente).not.toMatch(/\brepo\b/);
  });
});

describe('R1 — los datos semilla no contienen atributos sensibles', () => {
  it('ningún cliente tiene campos demográficos, de salud ni socioeconómicos', () => {
    for (const cliente of repo.clientes()) {
      for (const campo of Object.keys(cliente)) {
        for (const prohibido of TERMINOS_PROHIBIDOS) {
          expect(campo.toLowerCase(), `${cliente.id}.${campo}`).not.toContain(prohibido);
        }
      }
    }
  });

  it('el archivo semilla completo no menciona términos sensibles', () => {
    const crudo = readFileSync(resolve(RAIZ, 'lib/data/seed.json'), 'utf8').toLowerCase();
    for (const prohibido of TERMINOS_PROHIBIDOS) {
      // 'nota' describe explícitamente la ausencia de estos campos; se excluye
      // esa línea del chequeo comparando solo las claves y valores de datos.
      const sinNota = crudo.replace(/"nota":\s*"[^"]*"/, '');
      expect(sinNota, prohibido).not.toContain(`"${prohibido}`);
    }
  });

  it('la nota de los datos declara que no hay atributos sensibles', () => {
    expect(repo.notaDatos().toLowerCase()).toContain('demográficos');
  });
});

describe('R3 — se modela capacidad de respuesta, no condición de la persona', () => {
  it('el modelo de cliente habla de canales y alcanzabilidad, no de diagnósticos', () => {
    const cliente = repo.cliente('lucia');
    expect(cliente).not.toBeNull();
    // Lo correcto: "app comprometida" y "no alcanzable" describen la SITUACIÓN.
    expect(cliente!.canales_comprometidos).toContain('app');
    expect(cliente!.alcanzable).toBe(false);
  });

  it('la preferencia de canal es una lista declarada, no una inferencia', () => {
    for (const c of repo.clientes()) {
      expect(Array.isArray(c.canales_disponibles)).toBe(true);
      expect(Array.isArray(c.canales_comprometidos)).toBe(true);
    }
  });
});
