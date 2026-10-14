import { rondaSchema } from "@/lib/ronda";
import { criarRonda, listarRondas } from "@/lib/ronda-db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    return Response.json(
      await listarRondas(new URL(request.url).searchParams.get("all") === "1"),
    );
  } catch {
    return Response.json(
      { error: "Não foi possível carregar as rondas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const parsed = rondaSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Dados da ronda inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    const created = await criarRonda(parsed.data);
    return Response.json(created, { status: 201 });
  } catch {
    return Response.json(
      { error: "Não foi possível salvar a ronda." },
      { status: 500 },
    );
  }
}
