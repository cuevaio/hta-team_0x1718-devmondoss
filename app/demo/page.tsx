import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PanelBackend from "@/components/backend/panel";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Mule Zero | Backend",
  description: "La suite en vivo: cada prueba corre por el pipeline real y muestra qué hizo cada agente. Datos 100% sintéticos.",
};

/** Panel del backend para presentar: la suite en vivo (el juego está en /play y el monitor en /monitor). */
export default function DemoPage() {
  return (
    <div className={`${geist.variable} ${mono.variable}`}>
      <PanelBackend />
    </div>
  );
}
