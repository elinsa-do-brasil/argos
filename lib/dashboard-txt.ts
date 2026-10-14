import { type RondaInput, rondaSchema } from "@/lib/ronda";

type AmbienteImportado = RondaInput["ambientes"][number];

function semAcentos(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dataISO(valor: string) {
  const iso = valor.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const brasileira = valor.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  return brasileira ? `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}` : "";
}

function prioridade(valor: string): AmbienteImportado["prioridade"] {
  const normal = semAcentos(valor);
  if (normal.includes("pouco") && normal.includes("urgent"))
    return "Pouco urgente";
  if (normal.includes("urgent")) return "Urgente";
  return "Informação";
}

function tarefaDaLinha(linha: string) {
  const marcada = linha.match(/^\[\s*([xX✓✔]?)\s*\]\s*(.+)$/);
  if (marcada)
    return {
      id: crypto.randomUUID(),
      texto: marcada[2].trim(),
      concluida: !!marcada[1],
    };
  const simbolo = linha.match(/^([☑☐✓✔])\s*(.+)$/);
  if (simbolo)
    return {
      id: crypto.randomUUID(),
      texto: simbolo[2].trim(),
      concluida: simbolo[1] !== "☐",
    };
  return null;
}

export function parsearRondaTXT(texto: string, nomeArquivo: string) {
  if (!texto.trim()) throw new Error("Arquivo vazio.");
  const linhas = texto
    .replace(/^\uFEFF/, "")
    .replaceAll("\r", "")
    .split("\n")
    .map((l) => l.trim());
  const ambientes: AmbienteImportado[] = [];
  const tarefasExtras: AmbienteImportado["tarefas"] = [];
  const observacoesGerais: string[] = [];
  let ambiente: AmbienteImportado | null = null;
  let modo: "ambiente" | "extras" | "gerais" | "cabecalho" = "cabecalho";
  let data = "",
    turno: RondaInput["turno"] = "Manhã",
    hora = "08:00";
  let responsavel = "Não informado",
    base = "Paragominas",
    status: RondaInput["status"] = "Em andamento";
  let plantaoData = "",
    origemId = "";
  let gpsLatitude: number | null = null,
    gpsLongitude: number | null = null,
    gpsPrecisao: number | null = null;

  function guardarAmbiente() {
    if (ambiente) ambientes.push(ambiente);
    ambiente = null;
  }

  for (const linha of linhas) {
    if (!linha) continue;
    const dataMatch = linha.match(/^Data\s*:\s*(.+)$/i);
    if (dataMatch) {
      data = dataISO(dataMatch[1]);
      continue;
    }
    const baseMatch = linha.match(/^Base\s*:\s*(.+)$/i);
    if (baseMatch) {
      base = baseMatch[1].trim();
      continue;
    }
    const responsavelMatch = linha.match(/^Respons[aá]vel\s*:\s*(.+)$/i);
    if (responsavelMatch) {
      responsavel = responsavelMatch[1].trim();
      continue;
    }
    const origemIdMatch = linha.match(/^ID da ronda\s*:\s*(.+)$/i);
    if (origemIdMatch) {
      origemId = origemIdMatch[1].trim();
      continue;
    }
    const turnoMatch = linha.match(/^Turno\s*:\s*(.+)$/i);
    if (turnoMatch) {
      if (["Manhã", "Tarde", "Noite"].includes(turnoMatch[1].trim()))
        turno = turnoMatch[1].trim() as RondaInput["turno"];
      continue;
    }
    const horaMatch = linha.match(/^Hor[aá]rio previsto\s*:\s*(\d{2}:\d{2})/i);
    if (horaMatch) {
      hora = horaMatch[1];
      continue;
    }
    const statusMatch = linha.match(/^Situa[çc][aã]o\s*:\s*(.+)$/i);
    if (statusMatch) {
      status = semAcentos(statusMatch[1]).includes("finalizada")
        ? "Finalizada"
        : "Em andamento";
      continue;
    }
    const plantaoMatch = linha.match(/^Plant[aã]o iniciado em\s*:\s*(.+)$/i);
    if (plantaoMatch) {
      plantaoData = dataISO(plantaoMatch[1]);
      continue;
    }
    const gpsMatch = linha.match(/^GPS da ronda\s*:\s*(.+)$/i);
    if (gpsMatch) {
      const coords = gpsMatch[1].match(
        /(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
      );
      if (coords) {
        gpsLatitude = Number(coords[1]);
        gpsLongitude = Number(coords[2]);
      }
      const precisao = gpsMatch[1].match(/±\s*(\d+)/);
      if (precisao) gpsPrecisao = Number(precisao[1]);
      continue;
    }
    if (
      /^(?:Checklist detalhado|Detalhamento da ronda|Ronda detalhada|Checklist por ambiente)$/i.test(
        linha,
      )
    ) {
      modo = "cabecalho";
      continue;
    }
    if (
      /^(?:Tarefas extras|Tarefas do dia|Tarefas adicionais)\s*:?/i.test(linha)
    ) {
      guardarAmbiente();
      modo = "extras";
      continue;
    }
    const geraisMatch = linha.match(
      /^(?:Observa[çc][õo]es gerais|Observa[çc][aã]o geral)\s*:?\s*(.*)$/i,
    );
    if (geraisMatch) {
      guardarAmbiente();
      modo = "gerais";
      if (geraisMatch[1]) observacoesGerais.push(geraisMatch[1]);
      continue;
    }
    const ambienteMatch =
      linha.match(/^Ambiente\s*:\s*(.+)$/i) ??
      linha.match(/^[-=]{2,}\s*(.+?)\s*[-=]{2,}$/);
    if (ambienteMatch) {
      guardarAmbiente();
      ambiente = {
        id: crypto.randomUUID(),
        nome: ambienteMatch[1].trim(),
        observacao: "",
        prioridade: "Informação",
        localizacao: "",
        tarefas: [],
      };
      modo = "ambiente";
      continue;
    }
    const prioridadeMatch = linha.match(
      /^(?:Prioridade|Urg[eê]ncia)\s*:\s*(.+)$/i,
    );
    if (prioridadeMatch) {
      if (ambiente) ambiente.prioridade = prioridade(prioridadeMatch[1]);
      continue;
    }
    const localizacaoMatch = linha.match(
      /^(?:Localiza[çc][aã]o|GPS|Coordenadas)\s*:\s*(.+)$/i,
    );
    if (localizacaoMatch) {
      if (ambiente) ambiente.localizacao = localizacaoMatch[1].trim();
      continue;
    }
    const observacaoMatch = linha.match(
      /^(?:Observa[çc][aã]o|Ocorr[eê]ncia|Anota[çc][õo]es)\s*:\s*(.*)$/i,
    );
    if (observacaoMatch) {
      if (ambiente) ambiente.observacao = observacaoMatch[1].trim();
      else if (modo === "gerais" && observacaoMatch[1])
        observacoesGerais.push(observacaoMatch[1]);
      continue;
    }
    if (/^[-=*_]{3,}$/.test(linha) || /^#{1,4}\s/.test(linha)) continue;
    const tarefa = tarefaDaLinha(linha);
    if (tarefa) {
      if (ambiente) ambiente.tarefas.push(tarefa);
      else if (modo === "extras") tarefasExtras.push(tarefa);
      continue;
    }
    if (modo === "gerais") observacoesGerais.push(linha);
    else if (modo === "extras")
      tarefasExtras.push({
        id: crypto.randomUUID(),
        texto: linha,
        concluida: false,
      });
    else if (ambiente)
      ambiente.observacao = [ambiente.observacao, linha]
        .filter(Boolean)
        .join("\n");
  }
  guardarAmbiente();
  if (tarefasExtras.length)
    ambientes.push({
      id: crypto.randomUUID(),
      nome: "Tarefas extras",
      observacao: "",
      prioridade: "Informação",
      localizacao: "",
      tarefas: tarefasExtras,
    });
  data ||= dataISO(nomeArquivo);
  data ||= new Date().toISOString().slice(0, 10);
  const candidata = {
    id: crypto.randomUUID(),
    data,
    turno,
    hora,
    responsavel,
    base,
    status,
    plantaoData: plantaoData || "",
    observacoesGerais: observacoesGerais.join("\n"),
    gpsLatitude,
    gpsLongitude,
    gpsPrecisao,
    gpsCapturadoEm: null,
    ambientes,
  };
  const parsed = rondaSchema.safeParse(candidata);
  if (!parsed.success)
    throw new Error("Dados do TXT inválidos ou fora dos limites aceitos.");
  return { ronda: parsed.data, origemId };
}
