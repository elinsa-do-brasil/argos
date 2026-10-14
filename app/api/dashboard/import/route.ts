import { createHash } from "node:crypto";
import { z } from "zod";
import { parsearRondaTXT } from "@/lib/dashboard-txt";
import { prisma } from "@/lib/prisma";
import { criarRonda } from "@/lib/ronda-db";

export const runtime = "nodejs";

const entrada = z.object({
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        text: z.string().min(1).max(1_000_000),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(request: Request) {
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Arquivos inválidos. Envie até 50 TXT de 1 MB cada." },
      { status: 400 },
    );
  let adicionados = 0,
    duplicados = 0;
  const erros: string[] = [];
  for (const file of parsed.data.files) {
    if (!/\.txt$/i.test(file.name)) {
      erros.push(`${file.name}: arquivo não é TXT.`);
      continue;
    }
    try {
      const hashTXT = createHash("sha256").update(file.text).digest("hex");
      const { ronda, origemId } = parsearRondaTXT(file.text, file.name);
      const existente = await prisma.ronda
        .findFirst({
          where: { OR: [{ hashTXT }, ...(origemId ? [{ id: origemId }] : [])] },
          select: { id: true },
        })
        .catch(() => {
          throw new Error("Falha ao consultar o banco.");
        });
      if (existente) {
        duplicados++;
        continue;
      }
      await criarRonda(ronda, {
        arquivoOrigem: file.name,
        conteudoTXT: file.text,
        hashTXT,
      }).catch(() => {
        throw new Error("Falha ao salvar no banco.");
      });
      adicionados++;
    } catch (error) {
      erros.push(
        `${file.name}: ${error instanceof Error ? error.message : "falha ao importar"}`,
      );
    }
  }
  return Response.json({ adicionados, duplicados, erros });
}
