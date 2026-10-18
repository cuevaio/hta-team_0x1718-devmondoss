import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import Consola from "@/components/juego2d/consola";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Te están robando | El barrio no duerme",
  description: "Juego 2D: vive una estafa desde los dos lados y mira cómo reacciona el sistema de agentes. Datos 100% sintéticos.",
  appleWebApp: { capable: true, title: "Te están robando", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b1640",
};

export default function PlayPage() {
  return (
    <div className={pixel.variable}>
      <Consola fuente={pixel.style.fontFamily} />
    </div>
  );
}
