import { z } from 'zod';
import {
  DecisionTomada,
  Evidencia,
  EventoTimeline,
  Nivel0,
  Puerta,
  Transaccion,
  UsoIA,
} from './caso';
import {
  SalidaAuditor,
  SalidaCoordinador,
  SalidaDetective,
  SalidaGuardian,
} from './agentes';

/**
 * Punto de entrada único de los contratos.
 *
 * Importar siempre desde '@/lib/contracts', nunca desde los archivos internos.
 * Eso deja libertad para reorganizar sin romper el código del otro dev.
 */

export const SalidasAgentes = z.object({
  coordinador: SalidaCoordinador.optional(),
  guardian: SalidaGuardian.optional(),
  detective: SalidaDetective.optional(),
  auditor: SalidaAuditor.optional(),
});
export type SalidasAgentes = z.infer<typeof SalidasAgentes>;

/** Objeto Caso completo (19 §6). */
export const Caso = z.object({
  id: z.string().regex(/^CASO-\d{4,}$/, 'id de caso debe tener forma CASO-0001'),
  puerta: Puerta,
  transaccion: Transaccion,
  nivel0: Nivel0,
  evidencia: z.array(Evidencia),
  salidas: SalidasAgentes,
  decision: DecisionTomada.optional(),
  timeline: z.array(EventoTimeline),
  ia: UsoIA,
});
export type Caso = z.infer<typeof Caso>;

export * from './caso';
export * from './agentes';
export * from './memoria';
export * from './analytics';
export * from './validadores';
export type * from './firmas';
