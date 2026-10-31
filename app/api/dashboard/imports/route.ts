import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/sextans/session";

export const runtime = "nodejs";

export async function DELETE() {
  if (!(await getSession())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.ronda.deleteMany({
      where: { hashTXT: { not: null } },
    });
    return Response.json({ removidos: result.count });
  } catch {
    return Response.json(
      { error: "Não foi possível remover as importações." },
      { status: 500 },
    );
  }
}
