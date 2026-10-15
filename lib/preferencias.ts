import { z } from "zod";

const CHAVE = "argos:preferencias";

const preferenciasSchema = z.object({
  responsavel: z.string().max(120),
  base: z.string().max(120),
});

export type Preferencias = z.infer<typeof preferenciasSchema>;

export function lerPreferencias(): Partial<Preferencias> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return {};
    const parsed = preferenciasSchema.safeParse(JSON.parse(bruto));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function salvarPreferencias(preferencias: Preferencias) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(preferencias));
  } catch {
    // Sem acesso ao armazenamento local: segue sem lembrar.
  }
}
