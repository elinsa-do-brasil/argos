import { lerFotosSalvas } from "@/lib/foto";
import { lerFotoR2 } from "@/lib/foto-r2";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ rondaId: string; ambienteId: string; fotoId: string }>;
  },
) {
  const { rondaId, ambienteId, fotoId } = await context.params;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (![rondaId, ambienteId, fotoId].every((id) => uuid.test(id))) {
    return new Response(null, { status: 404 });
  }
  const chave = `rondas/${rondaId}/${ambienteId}/${fotoId}.jpg`;
  try {
    const ambiente = await prisma.ambiente.findFirst({
      where: { id: ambienteId, rondaId },
      select: { fotosJson: true },
    });
    if (
      !ambiente ||
      !lerFotosSalvas(ambiente.fotosJson).some(
        (foto) => "chave" in foto && foto.chave === chave,
      )
    )
      return new Response(null, { status: 404 });

    const bytes = await lerFotoR2(chave);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: "Não foi possível carregar a foto." },
      { status: 500 },
    );
  }
}
