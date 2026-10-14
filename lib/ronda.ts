import { z } from "zod";

const date = z.iso.date();
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Informe um horário válido.");

export const tarefaSchema = z.object({
  id: z.string().max(120),
  texto: z.string().trim().min(1, "Informe a tarefa.").max(300),
  concluida: z.boolean(),
});

export const ambienteSchema = z.object({
  id: z.string().max(120),
  nome: z.string().trim().min(1, "Informe o ambiente.").max(120),
  observacao: z.string().max(4000),
  prioridade: z.enum(["Informação", "Pouco urgente", "Urgente"]),
  localizacao: z.string().max(300),
  tarefas: z.array(tarefaSchema).max(100),
});

export const rondaSchema = z.object({
  id: z.string().uuid(),
  data: date,
  turno: z.enum(["Manhã", "Tarde", "Noite"]),
  hora: time,
  responsavel: z.string().trim().min(1, "Informe o responsável.").max(120),
  base: z.string().trim().min(1, "Informe a unidade.").max(120),
  status: z.enum(["Em andamento", "Finalizada"]),
  plantaoData: z.union([date, z.literal("")]),
  observacoesGerais: z.string().max(5000),
  gpsLatitude: z.number().min(-90).max(90).nullable(),
  gpsLongitude: z.number().min(-180).max(180).nullable(),
  gpsPrecisao: z.number().int().nonnegative().nullable(),
  gpsCapturadoEm: z.iso.datetime().nullable(),
  ambientes: z.array(ambienteSchema).max(100),
});

export type RondaInput = z.infer<typeof rondaSchema>;

export const ambientesIniciais = [
  [
    "Copa",
    "Verificar limpeza e organização",
    "Conferir pia, torneiras e pontos de água",
    "Verificar lixeiras e descarte de resíduos",
    "Verificar condições gerais dos equipamentos",
  ],
  [
    "Escritório primeiro andar",
    "Verificar limpeza e organização do ambiente",
    "Conferir iluminação e tomadas aparentes",
    "Verificar ar-condicionado e conforto térmico",
    "Registrar necessidades de manutenção",
  ],
  [
    "Escritório térreo",
    "Verificar limpeza e organização do ambiente",
    "Conferir iluminação e tomadas aparentes",
    "Verificar ar-condicionado e conforto térmico",
    "Registrar necessidades de manutenção",
  ],
  [
    "Estacionamento interno",
    "Verificar organização e circulação",
    "Conferir iluminação",
    "Observar condições do piso e sinalização",
    "Registrar obstruções ou situações de risco",
  ],
  [
    "Estacionamento externo",
    "Verificar limpeza e organização",
    "Conferir condições do piso e acessos",
    "Observar iluminação e sinalização",
    "Registrar situações que precisem de intervenção",
  ],
  [
    "Banheiros",
    "Verificar limpeza e condições de uso",
    "Conferir torneiras, descargas e vazamentos",
    "Verificar reposição de insumos",
    "Registrar defeitos ou necessidades de manutenção",
  ],
  [
    "Almoxarifado de EPI",
    "Verificar organização dos equipamentos de proteção",
    "Conferir condições de armazenamento",
    "Observar disponibilidade e identificação dos materiais",
    "Registrar necessidades de reposição",
  ],
  [
    "Almoxarifado",
    "Verificar organização dos materiais",
    "Conferir acessos e circulação",
    "Observar condições de armazenamento",
    "Registrar materiais pendentes ou avarias",
  ],
  [
    "Sala de reunião",
    "Verificar limpeza e organização",
    "Conferir mesa, cadeiras e mobiliário",
    "Verificar iluminação e ar-condicionado",
    "Conferir equipamentos disponíveis",
  ],
] as const;

export function novaRonda(
  data: string,
  hora: string,
  anterior?: RondaInput,
): RondaInput {
  return {
    id: crypto.randomUUID(),
    data,
    hora,
    turno: anterior?.turno ?? "Manhã",
    responsavel: anterior?.responsavel ?? "",
    base: anterior?.base ?? "Paragominas",
    status: "Em andamento",
    plantaoData: anterior?.plantaoData ?? "",
    observacoesGerais: "",
    gpsLatitude: null,
    gpsLongitude: null,
    gpsPrecisao: null,
    gpsCapturadoEm: null,
    ambientes: anterior
      ? anterior.ambientes.map((a) => ({
          ...a,
          id: crypto.randomUUID(),
          observacao: "",
          prioridade: "Informação",
          localizacao: "",
          tarefas: a.tarefas.map((t) => ({
            ...t,
            id: crypto.randomUUID(),
            concluida: false,
          })),
        }))
      : ambientesIniciais.map(([nome, ...tarefas]) => ({
          id: crypto.randomUUID(),
          nome,
          observacao: "",
          prioridade: "Informação" as const,
          localizacao: "",
          tarefas: tarefas.map((texto) => ({
            id: crypto.randomUUID(),
            texto,
            concluida: false,
          })),
        })),
  };
}

export function importarRondaLegada(raw: unknown): RondaInput {
  if (!raw || typeof raw !== "object") throw new Error("Ronda inválida.");
  const item = raw as Record<string, unknown>;
  if (!Array.isArray(item.ambientes)) throw new Error("Checklist inválido.");
  const gps =
    item.gps && typeof item.gps === "object"
      ? (item.gps as Record<string, unknown>)
      : {};
  const candidata = {
    id: crypto.randomUUID(),
    data: item.data,
    turno: item.turno,
    hora: item.hora,
    responsavel: item.responsavel || "Não informado",
    base: item.base || "Paragominas",
    status: item.status === "Finalizada" ? "Finalizada" : "Em andamento",
    plantaoData: item.plantaoData || "",
    observacoesGerais: item.observacoesGerais || "",
    gpsLatitude:
      typeof item.gpsLatitude === "number"
        ? item.gpsLatitude
        : typeof gps.latitude === "number"
          ? gps.latitude
          : null,
    gpsLongitude:
      typeof item.gpsLongitude === "number"
        ? item.gpsLongitude
        : typeof gps.longitude === "number"
          ? gps.longitude
          : null,
    gpsPrecisao:
      typeof item.gpsPrecisao === "number"
        ? item.gpsPrecisao
        : typeof gps.precisao === "number"
          ? gps.precisao
          : null,
    gpsCapturadoEm:
      typeof item.gpsCapturadoEm === "string"
        ? item.gpsCapturadoEm
        : typeof gps.capturadoEm === "string"
          ? gps.capturadoEm
          : null,
    ambientes: item.ambientes.map((a: unknown) => {
      if (!a || typeof a !== "object") throw new Error("Ambiente inválido.");
      const ambiente = a as Record<string, unknown>;
      if (!Array.isArray(ambiente.tarefas))
        throw new Error("Tarefas inválidas.");
      return {
        id: crypto.randomUUID(),
        nome: ambiente.nome,
        observacao: ambiente.observacao || "",
        prioridade: ambiente.prioridade || "Informação",
        localizacao: ambiente.localizacao || "",
        tarefas: ambiente.tarefas.map((t: unknown) => {
          if (!t || typeof t !== "object") throw new Error("Tarefa inválida.");
          const tarefa = t as Record<string, unknown>;
          return {
            id: crypto.randomUUID(),
            texto: tarefa.texto,
            concluida: tarefa.concluida === true,
          };
        }),
      };
    }),
  };
  return rondaSchema.parse(candidata);
}
