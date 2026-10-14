import "server-only";
import type { DashboardRonda } from "@/lib/dashboard-types";
import { prisma } from "@/lib/prisma";

export async function carregarDashboard(): Promise<DashboardRonda[]> {
  const rondas = await prisma.ronda.findMany({
    orderBy: [{ data: "desc" }, { hora: "desc" }],
    include: {
      ambientes: {
        orderBy: { ordem: "asc" },
        include: { tarefas: { orderBy: { ordem: "asc" } } },
      },
    },
  });
  return rondas.map((r) => ({
    id: r.id,
    data: r.data,
    turno: r.turno as DashboardRonda["turno"],
    hora: r.hora,
    responsavel: r.responsavel,
    base: r.base,
    status: r.status as DashboardRonda["status"],
    plantaoData: r.plantaoData ?? "",
    observacoesGerais: r.observacoesGerais,
    gpsLatitude: r.gpsLatitude,
    gpsLongitude: r.gpsLongitude,
    gpsPrecisao: r.gpsPrecisao,
    gpsCapturadoEm: r.gpsCapturadoEm?.toISOString() ?? null,
    arquivoOrigem: r.arquivoOrigem,
    conteudoTXT: r.conteudoTXT,
    hashTXT: r.hashTXT,
    atualizadoEm: r.atualizadoEm.toISOString(),
    ambientes: r.ambientes.map((a) => ({
      id: a.id,
      nome: a.nome,
      observacao: a.observacao,
      prioridade:
        a.prioridade as DashboardRonda["ambientes"][number]["prioridade"],
      localizacao: a.localizacao,
      tarefas: a.tarefas.map((t) => ({
        id: t.id,
        texto: t.texto,
        concluida: t.concluida,
      })),
    })),
  }));
}
