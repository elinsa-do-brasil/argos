export type RondaMapa = {
  base: string;
  observacoesGerais?: string;
  ambientes: Array<{
    observacao: string;
    localizacao: string;
    prioridade: string;
    fotos?: readonly unknown[];
  }>;
};
export const chaveBase = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Uma ocorrência por ambiente, mesmo que contenha várias fotos.
// Cada linha não vazia de observações gerais segue a regra do dashboard original.
export function totaisPorBase(rondas: RondaMapa[]) {
  return rondas.reduce<Record<string, { rondas: number; ocorrencias: number }>>((acc, r) => {
    const key = chaveBase(r.base);
    const item = acc[key] ?? { rondas: 0, ocorrencias: 0 };
    item.rondas += 1;
    item.ocorrencias += r.ambientes.filter((a) =>
      a.observacao.trim() || a.localizacao.trim() || a.prioridade !== "Informação" || (a.fotos?.length ?? 0) > 0,
    ).length;
    item.ocorrencias += (r.observacoesGerais ?? "").split("\n").filter((s) => s.trim()).length;
    acc[key] = item;
    return acc;
  }, {});
}

// Escala comum às seis bases; zero permanece visível e discreto.
export function intensidadeCor(cor: string, total: number, maximo: number, escuro: boolean) {
  const fundo = escuro ? [30, 41, 59] : [255, 255, 255];
  const rgb = [1, 3, 5].map((i) => Number.parseInt(cor.slice(i, i + 2), 16));
  const peso = total > 0 ? 0.35 + 0.65 * Math.min(total / Math.max(1, maximo), 1) : 0.16;
  return `rgb(${rgb.map((c, i) => Math.round(fundo[i] + (c - fundo[i]) * peso)).join(", ")})`;
}
