import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import Monitor from "@/components/monitor/monitor";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Te están robando | Monitor de agentes",
  description: "Cómo reaccionan los agentes, en vivo, a lo que hacen los jugadores. Datos 100% sintéticos.",
};

export default function MonitorPage() {
  return (
    <div className={pixel.variable}>
      <Monitor />
    </div>
  );
}
