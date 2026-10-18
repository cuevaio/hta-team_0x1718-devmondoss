import type { Metadata } from "next";
import DemoDashboard from "@/components/demo-dashboard";

export const metadata: Metadata = {
  title: "Mule Zero | Demo de la solución",
  description: "El caso de Rosa de punta a punta: pausa, investigación de los agentes, veredicto del analista y memoria. Datos 100% sintéticos.",
};

/** La demo de la solución para presentar (el juego está en /play y el monitor en /monitor). */
export default function DemoPage() {
  return <DemoDashboard />;
}
