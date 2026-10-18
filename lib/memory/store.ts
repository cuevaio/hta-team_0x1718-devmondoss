import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DIAS_VIGENCIA_VEREDICTO, Veredicto, veredictoVigente } from '@/lib/contracts';

/**
 * 🧠 Memoria de riesgo.
 *
 * Fuente: doc 19 §5. Es el puente fraude ↔ AML y lo que protege a la
 * siguiente víctima (CU-03).
 *
 * Tres invariantes que el store hace cumplir:
 *  1. Solo entra lo validado por un humano (doc 15, R10) → `validado_por`.
 *  2. Todo veredicto expira (90 días por defecto).
 *  3. El efecto es PAUSAR para verificación, nunca confiscar.
 *
 * Persistencia opcional (INFRA_Y_ORQUESTACION §4): con `MEMORIA_ARCHIVO`, los
 * veredictos se guardan en un JSON y sobreviven a un reinicio del proceso a
 * mitad del demo. Sin la variable, vive solo en RAM, como antes.
 *  - Al cargar, R10 se vuelve a exigir: un veredicto sin `validado_por` o mal
 *    formado se descarta, aunque alguien haya editado el archivo a mano.
 *  - Escritura atómica (temporal + rename): un corte no deja JSON a medias.
 *  - Un archivo ilegible no tumba el servidor: se aparta como `.corrupto-…`
 *    (no se sobrescribe) y la Memoria arranca vacía.
 *
 * Dueño: Ale_dev. Los agentes la ven como solo lectura (`ToolContext.memoria`).
 */

export interface CargaMemoria {
  cargados: number;
  descartados: number;
  apartado: string | null;
}

export class MemoriaRiesgo {
  private registro = new Map<string, Veredicto>();
  /** Resultado de la última carga desde archivo (para `/api/health` y tests). */
  carga: CargaMemoria = { cargados: 0, descartados: 0, apartado: null };

  constructor(private readonly archivo?: string) {
    if (archivo) this.cargar(archivo);
  }

  get persistente(): boolean {
    return Boolean(this.archivo);
  }

  /** Devuelve el veredicto solo si está vigente. Un expirado es como no tenerlo. */
  get(cuenta: string, hoy: Date = new Date()): Veredicto | null {
    const v = this.registro.get(cuenta);
    if (!v) return null;
    return veredictoVigente(v, hoy) ? v : null;
  }

  /**
   * Registra un veredicto validado por un analista.
   *
   * Lanza si no hay validador: es la barrera contra que el sistema se
   * autoalimente con sus propias conclusiones (R10).
   */
  confirm(cuenta: string, veredicto: Veredicto): void {
    if (!veredicto.validado_por?.trim()) {
      throw new Error(
        `Memoria: el veredicto de ${cuenta} no tiene validado_por. ` +
          'Solo entra lo confirmado por un humano (doc 15, R10).',
      );
    }
    if (veredicto.cuenta !== cuenta) {
      throw new Error(
        `Memoria: inconsistencia, se confirma ${cuenta} con un veredicto de ${veredicto.cuenta}.`,
      );
    }
    this.registro.set(cuenta, veredicto);
    this.guardar();
  }

  /** ¿Es mula confirmada y vigente? Es la condición de P1. */
  esMulaConfirmada(cuenta: string, hoy: Date = new Date()): boolean {
    return this.get(cuenta, hoy)?.veredicto === 'mula_confirmada';
  }

  /** Abre una apelación: suspende la vigencia sin borrar el registro. */
  abrirApelacion(cuenta: string): void {
    const v = this.registro.get(cuenta);
    if (v) {
      this.registro.set(cuenta, { ...v, apelacion_abierta: true });
      this.guardar();
    }
  }

  todos(): Veredicto[] {
    return [...this.registro.values()];
  }

  /** Para `/api/demo/reset`. */
  limpiar(): void {
    this.registro.clear();
    this.guardar();
  }

  get cantidad(): number {
    return this.registro.size;
  }

  private cargar(archivo: string): void {
    if (!existsSync(archivo)) return;
    let crudo: unknown;
    try {
      crudo = JSON.parse(readFileSync(archivo, 'utf8'));
    } catch {
      const apartado = `${archivo}.corrupto-${Date.now()}`;
      renameSync(archivo, apartado);
      this.carga = { cargados: 0, descartados: 0, apartado };
      console.warn(`Memoria: ${archivo} ilegible; apartado como ${apartado}. Arranca vacía.`);
      return;
    }
    const lista = Array.isArray(crudo) ? crudo : [];
    let descartados = Array.isArray(crudo) ? 0 : 1;
    for (const item of lista) {
      const v = Veredicto.safeParse(item);
      if (!v.success || !v.data.validado_por.trim()) {
        descartados++;
        continue;
      }
      this.registro.set(v.data.cuenta, v.data);
    }
    this.carga = { cargados: this.registro.size, descartados, apartado: null };
    if (descartados > 0) {
      console.warn(`Memoria: ${descartados} veredicto(s) descartados al cargar ${archivo} (R10 o formato).`);
    }
  }

  private guardar(): void {
    if (!this.archivo) return;
    mkdirSync(dirname(this.archivo), { recursive: true });
    const temporal = `${this.archivo}.tmp`;
    writeFileSync(temporal, JSON.stringify(this.todos(), null, 2), 'utf8');
    renameSync(temporal, this.archivo);
  }
}

/**
 * Construye un veredicto con la expiración calculada.
 * `validado_por` es obligatorio en la firma: no se puede olvidar.
 */
export function crearVeredicto(params: {
  cuenta: string;
  veredicto: Veredicto['veredicto'];
  validado_por: string;
  expediente: string;
  hoy?: Date;
  dias?: number;
}): Veredicto {
  const hoy = params.hoy ?? new Date();
  const dias = params.dias ?? DIAS_VIGENCIA_VEREDICTO;
  const expira = new Date(hoy.getTime() + dias * 86_400_000);
  return {
    cuenta: params.cuenta,
    veredicto: params.veredicto,
    validado_por: params.validado_por,
    fecha: hoy.toISOString().slice(0, 10),
    expira: expira.toISOString().slice(0, 10),
    expediente: params.expediente,
    apelacion_abierta: false,
  };
}

/**
 * Instancia de proceso. Sin base de datos en el MVP (blueprint §2); con
 * `MEMORIA_ARCHIVO`, respaldada en un JSON.
 */
export const memoria = new MemoriaRiesgo(process.env.MEMORIA_ARCHIVO?.trim() || undefined);
