import { filtroLimpezaSchema, limpezaLoteSchema } from "@/lib/limpeza";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filtro = filtroLimpezaSchema.safeParse({
    base: url.searchParams.get("base"),
    data: url.searchParams.get("data"),
    turno: url.searchParams.get("turno"),
  });
  if (!filtro.success) {
    return Response.json(
      { error: "Informe uma unidade e uma data válidas." },
      { status: 400 },
    );
  }

  try {
    const registros = await prisma.limpeza.findMany({
      where: {
        base: filtro.data.base,
        data: filtro.data.data,
        turno: filtro.data.turno,
      },
      orderBy: { registradoEm: "desc" },
      take: 200,
    });
    return Response.json(registros);
  } catch (error) {
    console.error("[limpezas] Não foi possível consultar os registros.", error);
    return Response.json(
      { error: "Não foi possível carregar os registros de limpeza." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const parsed = limpezaLoteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        error: "Dados dos registros de limpeza inválidos.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const registros = await prisma.limpeza.createMany({
      data: parsed.data,
    });
    return Response.json({ count: registros.count }, { status: 201 });
  } catch (error) {
    console.error("[limpezas] Não foi possível salvar o registro.", error);
    return Response.json(
      { error: "Não foi possível salvar o registro de limpeza." },
      { status: 500 },
    );
  }
}
