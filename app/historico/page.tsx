import type { Metadata } from "next";
import { HistoricoRondas } from "@/components/historico-rondas";
import { listarRondas } from "@/lib/ronda-db";

export const metadata: Metadata = {
  title: "Histórico de rondas | Argos",
  description: "Agenda do plantão noturno e rondas salvas.",
};

export const dynamic = "force-dynamic";

export default async function HistoricoPage() {
  const rondas = await listarRondas();
  return (
    <HistoricoRondas
      rondas={rondas.map(({ atualizadoEm: _atualizadoEm, ...r }) => r)}
    />
  );
}
