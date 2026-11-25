import { z } from "zod";

export const limpezaSchema = z.object({
  base: z.string().trim().min(1).max(120),
  data: z.iso.date(),
  turno: z.enum(["Manhã", "Tarde"]),
  ambiente: z.string().trim().min(1).max(120),
  funcionaria: z.string().trim().min(1).max(120),
  observacao: z.string().trim().max(1000).default(""),
});

export const limpezaLoteSchema = z.array(limpezaSchema).min(1).max(100);

export const limpezaRegistroSchema = limpezaSchema.extend({
  id: z.string().uuid(),
  registradoEm: z.iso.datetime(),
});

export const filtroLimpezaSchema = z.object({
  base: z.string().trim().min(1).max(120),
  data: z.iso.date(),
  turno: z.enum(["Manhã", "Tarde"]),
});

export type LimpezaInput = z.infer<typeof limpezaSchema>;
export type LimpezaRegistro = z.infer<typeof limpezaRegistroSchema>;
