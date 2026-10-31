import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/sextans/session";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getSession())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const result = await prisma.ronda.deleteMany({
      where: { id, hashTXT: { not: null } },
    });
    return result.count
      ? Response.json({ removido: true })
      : Response.json({ error: "Importação não encontrada." }, { status: 404 });
  } catch {
    return Response.json(
      { error: "Não foi possível remover a importação." },
      { status: 500 },
    );
  }
}
