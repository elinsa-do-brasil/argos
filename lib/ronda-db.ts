import "server-only";
import { type FotoOcorrencia, lerFotosSalvas } from "@/lib/foto";
import {
  ErroArmazenamentoFotos,
  enviarFotoR2,
  excluirFotosR2,
} from "@/lib/foto-r2";
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
      fotos: lerFotosSalvas(a.fotosJson),
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
    fotosJson: JSON.stringify(a.fotos ?? []),
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

async function limparFotos(chaves: string[]) {
  try {
    await excluirFotosR2(chaves);
  } catch (erro) {
    console.error("Não foi possível limpar fotos do R2:", erro);
  }
}

async function prepararFotos(
  ronda: RondaInput,
  anteriores = new Map<string, FotoOcorrencia[]>(),
) {
  const enviadas: string[] = [];
  const utilizadas = new Set<string>();
  try {
    const ambientes = [];
    for (const ambiente of ronda.ambientes) {
      if (ambiente.fotos === undefined) {
        for (const foto of anteriores.get(ambiente.id) ?? []) {
          if ("chave" in foto) utilizadas.add(foto.chave);
        }
        ambientes.push(ambiente);
        continue;
      }
      const fotos: FotoOcorrencia[] = [];
      for (const foto of ambiente.fotos) {
        if ("chave" in foto) {
          const pertence = (anteriores.get(ambiente.id) ?? []).some(
            (anterior) =>
              anterior.id === foto.id &&
              "chave" in anterior &&
              anterior.chave === foto.chave,
          );
          if (!pertence || utilizadas.has(foto.chave)) {
            throw new ErroArmazenamentoFotos(
              "Uma foto salva não pertence a esta ocorrência. Recarregue a ronda.",
            );
          }
          utilizadas.add(foto.chave);
          fotos.push(foto);
          continue;
        }
        const chave = `rondas/${ronda.id}/${ambiente.id}/${crypto.randomUUID()}.jpg`;
        await enviarFotoR2(chave, foto.dataUrl);
        enviadas.push(chave);
        utilizadas.add(chave);
        fotos.push({ id: foto.id, nome: foto.nome, chave });
      }
      ambientes.push({ ...ambiente, fotos });
    }
    const removidas = [...anteriores.values()].flatMap((fotos) =>
      fotos.flatMap((foto) =>
        "chave" in foto && !utilizadas.has(foto.chave) ? [foto.chave] : [],
      ),
    );
    return { ronda: { ...ronda, ambientes }, enviadas, removidas };
  } catch (erro) {
    await limparFotos(enviadas);
    throw erro;
  }
}
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
  const preparadas = await prepararFotos(ronda);
  try {
    return await prisma.ronda.create({
      data: {
        ...dadosRonda(preparadas.ronda),
        ...origem,
        ambientes: { create: dadosAmbientes(preparadas.ronda) },
      },
      select: { id: true },
    });
  } catch (erro) {
    await limparFotos(preparadas.enviadas);
    throw erro;
  }
}
export async function atualizarRonda(id: string, ronda: RondaInput) {
  const anteriores = await prisma.ambiente.findMany({
    where: { rondaId: id },
    select: { id: true, fotosJson: true },
  });
  const fotosAnteriores = new Map(
    anteriores.map((a) => [a.id, lerFotosSalvas(a.fotosJson)]),
  );
  const preparadas = await prepararFotos(ronda, fotosAnteriores);
  try {
    await prisma.$transaction(async (tx) => {
      const existente = await tx.ronda.findUnique({
        where: { id },
        select: { finalizadoEm: true },
      });
      // Clientes antigos que não enviam o campo fotos preservam as fotos já salvas.
      const fotosJsonAnteriores = new Map(
        anteriores.map((a) => [a.id, a.fotosJson]),
      );
      const dados = dadosRonda(preparadas.ronda);
      await tx.ronda.update({
        where: { id },
        data: {
          ...dados,
          finalizadoEm:
            dados.finalizadoEm &&
            (existente?.finalizadoEm ?? dados.finalizadoEm),
        },
      });
      await tx.ambiente.deleteMany({ where: { rondaId: id } });
      await tx.ambiente.createMany({
        data: preparadas.ronda.ambientes.map((a, ordem) => ({
          id: a.id,
          rondaId: id,
          nome: a.nome,
          ordem,
          observacao: a.observacao,
          prioridade: a.prioridade,
          localizacao: a.localizacao,
          fotosJson:
            a.fotos === undefined
              ? (fotosJsonAnteriores.get(a.id) ?? "[]")
              : JSON.stringify(a.fotos),
        })),
      });
      await tx.tarefa.createMany({
        data: preparadas.ronda.ambientes.flatMap((a) =>
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
  } catch (erro) {
    await limparFotos(preparadas.enviadas);
    throw erro;
  }
  await limparFotos(preparadas.removidas);
}
