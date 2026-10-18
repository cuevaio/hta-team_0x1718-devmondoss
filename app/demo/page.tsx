import type { Metadata } from "next";
import PanelBackend from "@/components/backend/panel";

export const metadata: Metadata = {
  title: "Mule Zero | Backend",
  description: "La suite en vivo: cada prueba corre por el pipeline real y muestra qué hizo cada agente. Datos 100% sintéticos.",
};

/** Panel del backend para presentar: la suite en vivo (el juego está en /play y el monitor en /monitor). */
export default function DemoPage() {
  return <PanelBackend />;
}
