import { rondaSchema } from "@/lib/ronda";
import { atualizarRonda, buscarRonda } from "@/lib/ronda-db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id))
      return Response.json({ error: "ID inválido." }, { status: 400 });
    const ronda = await buscarRonda(id);
    return ronda
      ? Response.json(ronda)
      : Response.json({ error: "Ronda não encontrada." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "Não foi possível carregar a ronda." },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const parsed = rondaSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.id !== id)
      return Response.json(
        { error: "Dados da ronda inválidos." },
        { status: 400 },
      );
    if (!(await buscarRonda(id)))
      return Response.json({ error: "Ronda não encontrada." }, { status: 404 });
    await atualizarRonda(id, parsed.data);
    return Response.json({ id });
  } catch {
    return Response.json(
      { error: "Não foi possível atualizar a ronda." },
      { status: 500 },
    );
  }
}
