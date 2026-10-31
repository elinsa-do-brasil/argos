import type { Metadata } from "next";
import { DashboardFacilities } from "@/components/dashboard-facilities";
import { MenuUsuario } from "@/components/menu-usuario";
import { carregarDashboard } from "@/lib/dashboard-data";
import { requireSession } from "@/lib/sextans/session";

export const metadata: Metadata = {
  title: "Dashboard de Facilities | Argos",
  description: "Histórico de rondas, tarefas e ocorrências de Facilities.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user } = await requireSession("/dashboard");
  const rondas = await carregarDashboard();
  return (
    <DashboardFacilities
      rondas={rondas}
      userMenu={<MenuUsuario user={user} />}
    />
  );
}
