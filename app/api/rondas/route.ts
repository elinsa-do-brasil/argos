import { MENSAGEM_PRAZO_ENCERRADO, rondaSchema } from "@/lib/ronda";
import {
  atualizarRonda,
  criarRonda,
  listarRondas,
  situacaoEdicao,
} from "@/lib/ronda-db";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await listarRondas());
  } catch {
    return Response.json(
      { error: "Não foi possível carregar as rondas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const parsed = rondaSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success)
      return Response.json(
        { error: "Dados da ronda inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    const edicao = await situacaoEdicao(parsed.data.id);
    if (edicao) {
      if (edicao.encerrada)
        return Response.json(
          { error: MENSAGEM_PRAZO_ENCERRADO },
          { status: 409 },
        );
      await atualizarRonda(parsed.data.id, parsed.data);
      return Response.json({ id: parsed.data.id });
    }
    const created = await criarRonda(parsed.data);
    return Response.json(created, { status: 201 });
  } catch {
    return Response.json(
      { error: "Não foi possível salvar a ronda." },
      { status: 500 },
    );
  }
}
