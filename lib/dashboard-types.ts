import type { RondaInput } from "@/lib/ronda";

export type DashboardRonda = RondaInput & {
  arquivoOrigem: string | null;
  conteudoTXT: string | null;
  hashTXT: string | null;
  atualizadoEm: string;
};

export type Ocorrencia = {
  id: string;
  rondaId: string;
  data: string;
  ambiente: string;
  prioridade: RondaInput["ambientes"][number]["prioridade"];
  observacao: string;
  localizacao: string;
  responsavel: string;
  arquivo: string;
  itensChecklist: number;
};
