import type { Metadata } from "next";
import Monitor from "@/components/monitor/monitor";

export const metadata: Metadata = {
  title: "Te están robando | Monitor de agentes",
  description: "Cómo reaccionan los agentes, en vivo, a lo que hacen los jugadores. Datos 100% sintéticos.",
};

export default function MonitorPage() {
  return <Monitor />;
}
