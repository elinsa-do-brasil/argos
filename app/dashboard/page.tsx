import type { Metadata } from "next";
import { DashboardFacilities } from "@/components/dashboard-facilities";
import { carregarDashboard } from "@/lib/dashboard-data";

export const metadata: Metadata = {
  title: "Dashboard de Facilities | Argos",
  description: "Histórico de rondas, tarefas e ocorrências de Facilities.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const rondas = await carregarDashboard();
  return <DashboardFacilities rondas={rondas} />;
}
