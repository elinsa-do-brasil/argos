import { z } from "zod";

// Unidades atendidas. A lista é a fonte das opções de base no formulário e na agenda.
export const BASES = ["Paragominas"] as const;

// Depois de gravada, a ronda pode ser alterada por este tempo; depois fica
// somente para leitura (regra aplicada também no servidor).
export const PRAZO_EDICAO_MINUTOS = 10;
export const PRAZO_EDICAO_MS = PRAZO_EDICAO_MINUTOS * 60 * 1000;
export const MENSAGEM_PRAZO_ENCERRADO = `O prazo de ${PRAZO_EDICAO_MINUTOS} minutos para alterar esta ronda terminou.`;

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
  turno: z.enum(["Manhã", "Tarde", "Noite", "Dia todo"]),
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

export function dataLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}

// Dias úteis: Manhã, Tarde e plantão noturno (19h às 07h). Sábado e domingo:
// plantão de dia todo, das 07h às 07h do dia seguinte. A madrugada (00h–07h)
// pertence ao plantão do dia anterior.
const INICIO_MANHA = 7;
const INICIO_TARDE = 13;
const INICIO_NOITE = 19;

export function plantaoFimDeSemana(dataPlantao: string) {
  const dia = new Date(`${dataPlantao}T12:00:00`).getDay();
  return dia === 0 || dia === 6;
}

export function turnoDoPlantao(dataPlantao: string): RondaInput["turno"] {
  return plantaoFimDeSemana(dataPlantao) ? "Dia todo" : "Noite";
}

export function turnoPadrao(data: string, hora: string): RondaInput["turno"] {
  const h = Number(hora.slice(0, 2));
  const dataPlantao = h < INICIO_MANHA ? somarDias(data, -1) : data;
  if (plantaoFimDeSemana(dataPlantao)) return "Dia todo";
  if (h >= INICIO_MANHA && h < INICIO_TARDE) return "Manhã";
  if (h >= INICIO_TARDE && h < INICIO_NOITE) return "Tarde";
  return "Noite";
}

// Horários da agenda: 13 horários (19h às 07h) em dias úteis e 24 (07h às 06h
// do dia seguinte) no plantão de dia todo.
export function horariosDoPlantao(dataPlantao: string) {
  const diaTodo = plantaoFimDeSemana(dataPlantao);
  const inicio = diaTodo ? INICIO_MANHA : INICIO_NOITE;
  return Array.from({ length: diaTodo ? 24 : 13 }, (_, i) => {
    const h = (inicio + i) % 24;
    return {
      data: h < inicio ? somarDias(dataPlantao, 1) : dataPlantao,
      hora: `${String(h).padStart(2, "0")}:00`,
    };
  });
}

export function novaRonda(
  data: string,
  hora: string,
  anterior?: RondaInput,
): RondaInput {
  return {
    id: crypto.randomUUID(),
    data,
    hora,
    turno: turnoPadrao(data, hora),
    responsavel: anterior?.responsavel ?? "",
    base: anterior?.base ?? BASES[0],
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
