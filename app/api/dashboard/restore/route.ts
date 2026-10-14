import { createHash } from "node:crypto";
import { parsearRondaTXT } from "@/lib/dashboard-txt";
import { prisma } from "@/lib/prisma";
import { importarRondaLegada, rondaSchema } from "@/lib/ronda";
import { criarRonda } from "@/lib/ronda-db";

export const runtime = "nodejs";

function registro(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    throw new Error("Registro inválido.");
  return valor as Record<string, unknown>;
}

function textoLegado(item: Record<string, unknown>) {
  if (typeof item.conteudoTXT === "string" && item.conteudoTXT.trim())
    return item.conteudoTXT;
  const ambientes = Array.isArray(item.ambientes) ? item.ambientes : [];
  const linhas = [
    `Data: ${item.data ?? ""}`,
    `Base: ${item.base ?? "Paragominas"}`,
    `Responsável: ${item.responsavel ?? "Não informado"}`,
    "Checklist detalhado",
    "",
  ];
  for (const valor of ambientes) {
    const a = registro(valor);
    linhas.push(
      `Ambiente: ${a.nome ?? "Ambiente"}`,
      `Prioridade: ${a.prioridade ?? "Informação"}`,
      `Localização: ${a.localizacao ?? ""}`,
      `Observação: ${a.observacao ?? ""}`,
    );
    if (Array.isArray(a.checklist)) linhas.push(...a.checklist.map(String));
    linhas.push("");
  }
  if (Array.isArray(item.tarefas) && item.tarefas.length)
    linhas.push("Tarefas extras", ...item.tarefas.map(String), "");
  if (Array.isArray(item.observacoesGerais) && item.observacoesGerais.length)
    linhas.push("Observações gerais:", ...item.observacoesGerais.map(String));
  return linhas.join("\n");
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 20_000_000)
    return Response.json({ error: "Backup maior que 20 MB." }, { status: 413 });
  let itens: unknown[];
  try {
    const pacote = JSON.parse(raw);
    itens = Array.isArray(pacote) ? pacote : pacote.rondas;
    if (!Array.isArray(itens) || !itens.length || itens.length > 500)
      throw new Error();
  } catch {
    return Response.json(
      { error: "Backup inválido ou vazio." },
      { status: 400 },
    );
  }
  let adicionados = 0,
    duplicados = 0;
  const erros: string[] = [];
  for (const [index, valor] of itens.entries()) {
    try {
      const item = registro(valor);
      const atual = rondaSchema.safeParse(item);
      let ronda = atual.success ? atual.data : null;
      let origem:
        | { arquivoOrigem: string; conteudoTXT: string; hashTXT: string }
        | undefined;
      if (typeof item.conteudoTXT === "string" && item.conteudoTXT.trim()) {
        const conteudoTXT = item.conteudoTXT;
        origem = {
          arquivoOrigem: String(
            item.arquivoOrigem ?? item.arquivo ?? `ronda-${index + 1}.txt`,
          ).slice(0, 255),
          conteudoTXT,
          hashTXT: createHash("sha256").update(conteudoTXT).digest("hex"),
        };
      }
      if (
        !ronda &&
        Array.isArray(item.ambientes) &&
        item.ambientes.some((a) => a && typeof a === "object" && "tarefas" in a)
      )
        ronda = importarRondaLegada(item);
      if (!ronda) {
        const conteudoTXT = textoLegado(item);
        ronda = parsearRondaTXT(
          conteudoTXT,
          String(item.arquivo ?? `ronda-${index + 1}.txt`),
        ).ronda;
        origem = {
          arquivoOrigem: String(item.arquivo ?? `ronda-${index + 1}.txt`).slice(
            0,
            255,
          ),
          conteudoTXT,
          hashTXT: createHash("sha256").update(conteudoTXT).digest("hex"),
        };
      }
      const existente = await prisma.ronda
        .findFirst({
          where: {
            OR: [
              { id: ronda.id },
              ...(origem ? [{ hashTXT: origem.hashTXT }] : []),
            ],
          },
          select: { id: true },
        })
        .catch(() => {
          throw new Error("Falha ao consultar o banco.");
        });
      if (existente) {
        duplicados++;
        continue;
      }
      await criarRonda(ronda, origem).catch(() => {
        throw new Error("Falha ao salvar no banco.");
      });
      adicionados++;
    } catch (error) {
      erros.push(
        `Registro ${index + 1}: ${error instanceof Error ? error.message : "falha ao restaurar"}`,
      );
    }
  }
  return Response.json({ adicionados, duplicados, erros });
}
