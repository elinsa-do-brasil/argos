import { z } from "zod";
import { ambienteSchema, type RondaInput, rondaSchema } from "@/lib/ronda";

const CHAVE = "argos:rascunho-ronda";

// Mais permissivo que rondaSchema: um rascunho pode estar incompleto
// (responsável vazio, textos acima do limite) e ainda assim deve voltar.
const rascunhoSchema = z.object({
  versao: z.literal(1),
  salvoEm: z.string(),
  persistido: z.string().nullable(),
  dados: z.object({
    id: z.string().uuid(),
    data: z.string(),
    turno: rondaSchema.shape.turno,
    hora: z.string(),
    responsavel: z.string(),
    base: z.string(),
    status: rondaSchema.shape.status,
    plantaoData: z.string(),
    observacoesGerais: z.string(),
    gpsLatitude: z.number().nullable(),
    gpsLongitude: z.number().nullable(),
    gpsPrecisao: z.number().nullable(),
    gpsCapturadoEm: z.string().nullable(),
    ambientes: z.array(
      z.object({
        id: z.string(),
        nome: z.string(),
        observacao: z.string(),
        prioridade: ambienteSchema.shape.prioridade,
        localizacao: z.string(),
        tarefas: z.array(
          z.object({
            id: z.string(),
            texto: z.string(),
            concluida: z.boolean(),
          }),
        ),
      }),
    ),
  }),
});

export type Rascunho = {
  salvoEm: string;
  persistido: string | null;
  dados: RondaInput;
};

export function lerRascunho(): Rascunho | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const parsed = rascunhoSchema.safeParse(JSON.parse(bruto));
    if (parsed.success) return parsed.data;
    localStorage.removeItem(CHAVE);
    return null;
  } catch {
    return null;
  }
}

export function salvarRascunho(persistido: string | null, dados: RondaInput) {
  try {
    localStorage.setItem(
      CHAVE,
      JSON.stringify({
        versao: 1,
        salvoEm: new Date().toISOString(),
        persistido,
        dados,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function apagarRascunho() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // Sem acesso ao armazenamento local: não há rascunho a apagar.
  }
}
