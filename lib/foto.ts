import { z } from "zod";

export const MAX_FOTOS_AMBIENTE = 5;
export const MAX_BYTES_FOTO = 180_000;
export const MAX_CARACTERES_FOTOS_RONDA = 2_400_000;
const dadosFoto = {
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(180),
};
export const fotoNovaSchema = z.object({
  ...dadosFoto,
  dataUrl: z
    .string()
    .max(Math.ceil(MAX_BYTES_FOTO / 3) * 4 + 23)
    .regex(
      /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/,
      "Foto JPEG inválida.",
    ),
});
export const fotoR2Schema = z.object({
  ...dadosFoto,
  chave: z
    .string()
    .regex(/^rondas\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/),
});
export const fotoSchema = z.union([fotoNovaSchema, fotoR2Schema]);
export type FotoOcorrencia = z.infer<typeof fotoSchema>;
export const fotosSchema = z.array(fotoSchema).max(MAX_FOTOS_AMBIENTE);

export function urlFoto(foto: FotoOcorrencia) {
  return "dataUrl" in foto
    ? foto.dataUrl
    : `/api/fotos/${foto.chave.slice("rondas/".length, -".jpg".length)}`;
}

export function lerFotosSalvas(
  valor: string | null | undefined,
): FotoOcorrencia[] {
  try {
    const resultado = fotosSchema.safeParse(JSON.parse(valor || "[]"));
    return resultado.success ? resultado.data : [];
  } catch {
    return [];
  }
}
