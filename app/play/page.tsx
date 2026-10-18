import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import Juego from "@/components/juego/juego";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Te están robando | Demo jugable",
  description: "Vive una estafa desde los dos lados y mira cómo reacciona el sistema de agentes. Datos 100% sintéticos.",
};

export default function PlayPage() {
  return (
    <div className={pixel.variable}>
      <Juego />
    </div>
  );
}
