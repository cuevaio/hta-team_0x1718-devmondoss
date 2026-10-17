import type { DecisionAccion, NombreAgente, ReglaPolicy, UsoAgente } from '@/lib/contracts';

/**
 * Registro estructurado de llamadas y decisiones — doc 19 §9.
 *
 * Por cada llamada a un agente guarda: agente, llamadas, tokens, latencia y si
 * terminó bien o con error (lo que llevó al modo seguro). Por cada decisión,
 * la regla y la acción. Alimenta el embudo de `/api/stats` y la auditoría.
 *
 * Lo que NO guarda, a propósito:
 *  - Texto escrito por el cliente. Es dato personal y, por R5, nunca se trata
 *    como instrucción; tampoco tiene por qué viajar a un log. El tipo no tiene
 *    campo para él.
 *  - Atributos de la persona (R1). Solo ids de caso y propiedades del cálculo.
 *
 * `modelo` y "tools usadas" (también en §9) viven dentro del runtime de Tony y
 * `UsoAgente` no los expone; se registran cuando el contrato los incluya.
 *
 * Es un buffer acotado en memoria del proceso, como el resto del estado.
 *
 * Dueño: Ale_dev.
 */

export type ActorRegistro = NombreAgente | 'orquestador';

export type EntradaRegistro =
  | {
      tipo: 'agente';
      t: string;
      caso: string;
      agente: ActorRegistro;
      llamadas: number;
      tokens: number;
      ms: number;
      resultado: 'ok' | 'error';
    }
  | {
      tipo: 'decision';
      t: string;
      caso: string;
      regla: ReglaPolicy;
      accion: DecisionAccion;
      degradado: boolean;
      llamadas_ia_del_caso: number;
    };

export const MAX_ENTRADAS_REGISTRO = 500;

export class Registro {
  private entradas: EntradaRegistro[] = [];

  constructor(private readonly max = MAX_ENTRADAS_REGISTRO) {}

  agente(caso: string, agente: ActorRegistro, uso: UsoAgente | undefined, resultado: 'ok' | 'error'): void {
    this.push({
      tipo: 'agente',
      t: new Date().toISOString(),
      caso,
      agente,
      llamadas: uso?.llamadas ?? 0,
      tokens: uso?.tokens ?? 0,
      ms: uso?.ms ?? 0,
      resultado,
    });
  }

  decision(
    caso: string,
    d: { regla: ReglaPolicy; accion: DecisionAccion; degradado: boolean; llamadas_ia_del_caso: number },
  ): void {
    this.push({ tipo: 'decision', t: new Date().toISOString(), caso, ...d });
  }

  /** Copia: quien la lea no puede alterar el registro. */
  todas(): EntradaRegistro[] {
    return this.entradas.map((e) => ({ ...e }));
  }

  recientes(n: number): EntradaRegistro[] {
    return this.todas().slice(-n);
  }

  limpiar(): void {
    this.entradas = [];
  }

  get cantidad(): number {
    return this.entradas.length;
  }

  private push(e: EntradaRegistro): void {
    this.entradas.push(e);
    if (this.entradas.length > this.max) this.entradas.splice(0, this.entradas.length - this.max);
  }
}

export const registro = new Registro();
