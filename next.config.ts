import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La raíz es este repo. Sin esto, un lockfile suelto en una carpeta superior
  // (p. ej. ~/pnpm-lock.yaml) hace que Next infiera una raíz equivocada.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
