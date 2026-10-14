import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE() {
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
