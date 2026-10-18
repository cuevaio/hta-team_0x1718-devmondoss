import { after } from 'next/server';
import { modoAgentes } from '@/lib/agents';

/**
 * ¿Diferir el expediente del Auditor en las rutas HTTP?
 *
 * Con el modelo real, el Auditor (Opus) tarda varios segundos. Si la ruta lo
 * espera, el frontend se queda «cargando» con el dinero ya retenido, y la
 * historia del demo («la pausa es instantánea, el expediente llega después»)
 * no se ve. Diferido, la respuesta sale con la decisión y el expediente
 * aparece por polling.
 *
 * Por defecto se difiere con un modelo real (`claude` u `ollama`, que en una
 * laptop también tarda segundos): en modo simulado el Auditor es
 * instantáneo y esperar mantiene el orden del timeline documentado y los tests
 * deterministas. `AUDITOR_DIFERIDO=1|0` fuerza un modo u otro.
 *
 * Dueño: Ale_dev.
 */
export function debeDiferirAuditor(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AUDITOR_DIFERIDO === '1') return true;
  if (env.AUDITOR_DIFERIDO === '0') return false;
  return modoAgentes(env) !== 'simulado';
}

/**
 * `after()` corre la tarea después de enviar la respuesta. Fuera de una
 * request de Next (tests que llaman al handler directamente) lanza; ahí se
 * ejecuta igual, sin esperarla. Nunca se pierde el expediente.
 */
export function diferirTarea(tarea: () => Promise<void>): void {
  try {
    after(tarea);
  } catch {
    void tarea();
  }
}

/** Lo que las rutas pasan al pipeline: la función de diferir, o nada (esperar). */
export function opcionDiferir(env: NodeJS.ProcessEnv = process.env) {
  return debeDiferirAuditor(env) ? { diferir: diferirTarea } : {};
}
