import type { NextConfig } from "next";

/**
 * `API_REMOTA` (opcional): URL de un backend con estado, p. ej. el de Railway.
 *
 * El estado del demo vive en la RAM de un solo proceso (INFRA_Y_ORQUESTACION
 * §4), así que en un hosting serverless como Vercel las rutas `/api/*` no
 * pueden correr ahí. Con esta variable, Vercel sirve las páginas y reenvía
 * toda la API al backend remoto. Sin la variable, todo corre local como antes.
 */
const apiRemota = process.env.API_REMOTA?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // La raíz es este repo. Sin esto, un lockfile suelto en una carpeta superior
  // (p. ej. ~/pnpm-lock.yaml) hace que Next infiera una raíz equivocada.
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    if (!apiRemota) return [];
    // `beforeFiles`: se aplica antes que las rutas de app/api de este despliegue.
    return { beforeFiles: [{ source: "/api/:ruta*", destination: `${apiRemota}/api/:ruta*` }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
