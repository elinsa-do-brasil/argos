import "server-only";
import { prisma } from "@/lib/prisma";
import { PRAZO_EDICAO_MS, type RondaInput } from "@/lib/ronda";

const include = {
  ambientes: {
    orderBy: { ordem: "asc" as const },
    include: { tarefas: { orderBy: { ordem: "asc" as const } } },
  },
};

export async function listarRondas() {
  return prisma.ronda.findMany({
    orderBy: [{ data: "desc" }, { hora: "desc" }],
    select: {
      id: true,
      data: true,
      hora: true,
      turno: true,
      responsavel: true,
      base: true,
      status: true,
      atualizadoEm: true,
    },
    take: 200,
  });
}

export async function buscarRonda(id: string) {
  const ronda = await prisma.ronda.findUnique({ where: { id }, include });
  if (!ronda) return null;
  const { ambientes, ...dados } = ronda;
  return {
    ...dados,
    plantaoData: dados.plantaoData ?? "",
    gpsCapturadoEm: dados.gpsCapturadoEm?.toISOString() ?? null,
    ambientes: ambientes.map(({ tarefas, ...a }) => ({
      id: a.id,
      nome: a.nome,
      observacao: a.observacao,
      prioridade: a.prioridade,
      localizacao: a.localizacao,
      tarefas: tarefas.map((t) => ({
        id: t.id,
        texto: t.texto,
        concluida: t.concluida,
      })),
    })),
  };
}

function dadosRonda(ronda: RondaInput) {
  const { ambientes: _ambientes, ...dados } = ronda;
  return {
    ...dados,
    plantaoData: dados.plantaoData || null,
    gpsCapturadoEm: dados.gpsCapturadoEm
      ? new Date(dados.gpsCapturadoEm)
      : null,
    finalizadoEm: dados.status === "Finalizada" ? new Date() : null,
  };
}

function dadosAmbientes(ronda: RondaInput) {
  return ronda.ambientes.map((a, ordem) => ({
    id: a.id,
    nome: a.nome,
    ordem,
    observacao: a.observacao,
    prioridade: a.prioridade,
    localizacao: a.localizacao,
    tarefas: {
      create: a.tarefas.map((t, ordemTarefa) => ({
        id: t.id,
        texto: t.texto,
        concluida: t.concluida,
        ordem: ordemTarefa,
      })),
    },
  }));
}

// `null` quando a ronda não existe.
export async function situacaoEdicao(id: string) {
  const ronda = await prisma.ronda.findUnique({
    where: { id },
    select: { criadoEm: true },
  });
  if (!ronda) return null;
  return {
    encerrada: Date.now() >= ronda.criadoEm.getTime() + PRAZO_EDICAO_MS,
  };
}

export async function criarRonda(
  ronda: RondaInput,
  origem?: { arquivoOrigem: string; conteudoTXT: string; hashTXT: string },
) {
  return prisma.ronda.create({
    data: {
      ...dadosRonda(ronda),
      ...origem,
      ambientes: { create: dadosAmbientes(ronda) },
    },
    select: { id: true },
  });
}

export async function atualizarRonda(id: string, ronda: RondaInput) {
  return prisma.$transaction(async (tx) => {
    const existente = await tx.ronda.findUnique({
      where: { id },
      select: { finalizadoEm: true },
    });
    const dados = dadosRonda(ronda);
    await tx.ronda.update({
      where: { id },
      data: {
        ...dados,
        // Preserva o momento da primeira finalização.
        finalizadoEm:
          dados.finalizadoEm && (existente?.finalizadoEm ?? dados.finalizadoEm),
      },
    });
    await tx.ambiente.deleteMany({ where: { rondaId: id } });
    await tx.ambiente.createMany({
      data: ronda.ambientes.map((a, ordem) => ({
        id: a.id,
        rondaId: id,
        nome: a.nome,
        ordem,
        observacao: a.observacao,
        prioridade: a.prioridade,
        localizacao: a.localizacao,
      })),
    });
    await tx.tarefa.createMany({
      data: ronda.ambientes.flatMap((a) =>
        a.tarefas.map((t, ordem) => ({
          id: t.id,
          ambienteId: a.id,
          texto: t.texto,
          ordem,
          concluida: t.concluida,
        })),
      ),
    });
  });
}
