"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  ClipboardList,
  Download,
  MapPin,
  Plus,
  Save,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  importarRondaLegada,
  novaRonda,
  type RondaInput,
  rondaSchema,
} from "@/lib/ronda";

type Historico = Pick<
  RondaInput,
  "id" | "data" | "hora" | "turno" | "responsavel" | "base" | "status"
>;

function dataLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const vazio: RondaInput = {
  id: "00000000-0000-4000-8000-000000000000",
  data: "",
  turno: "Manhã",
  hora: "",
  responsavel: "",
  base: "Paragominas",
  status: "Em andamento",
  plantaoData: "",
  observacoesGerais: "",
  gpsLatitude: null,
  gpsLongitude: null,
  gpsPrecisao: null,
  gpsCapturadoEm: null,
  ambientes: [],
};

function AmbienteFields({
  index,
  control,
  register,
  errors,
  gps,
}: {
  index: number;
  control: Control<RondaInput>;
  register: UseFormRegister<RondaInput>;
  errors: FieldErrors<RondaInput>;
  gps: (index: number) => void;
}) {
  const { fields: tarefas } = useFieldArray({
    control,
    name: `ambientes.${index}.tarefas`,
    keyName: "_key",
  });
  const ambiente = useWatch({ control, name: `ambientes.${index}` });
  const concluidas = ambiente?.tarefas.filter((t) => t.concluida).length ?? 0;
  return (
    <Card id={`ambiente-${index}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{ambiente?.nome ?? "Ambiente"}</span>
          <span className="text-sm text-muted-foreground">
            {concluidas}/{tarefas.length} concluídos
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <FieldSet>
            <FieldLegend variant="label">Checklist</FieldLegend>
            <FieldGroup className="gap-3">
              {tarefas.length ? (
                tarefas.map((t, j) => (
                  <Field orientation="horizontal" key={t._key}>
                    <Checkbox
                      id={`tarefa-${index}-${j}`}
                      {...register(`ambientes.${index}.tarefas.${j}.concluida`)}
                    />
                    <FieldLabel
                      htmlFor={`tarefa-${index}-${j}`}
                      className="font-normal"
                    >
                      {ambiente?.tarefas[j]?.texto ?? t.texto}
                    </FieldLabel>
                  </Field>
                ))
              ) : (
                <FieldDescription>Nenhuma tarefa cadastrada.</FieldDescription>
              )}
            </FieldGroup>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor={`prioridade-${index}`}>
              Prioridade da ocorrência
            </FieldLabel>
            <NativeSelect
              id={`prioridade-${index}`}
              {...register(`ambientes.${index}.prioridade`)}
            >
              <option>Informação</option>
              <option>Pouco urgente</option>
              <option>Urgente</option>
            </NativeSelect>
          </Field>
          <Field data-invalid={!!errors.ambientes?.[index]?.observacao}>
            <FieldLabel htmlFor={`observacao-${index}`}>
              Observações / ocorrência
            </FieldLabel>
            <Textarea
              id={`observacao-${index}`}
              placeholder="Descreva o que foi encontrado ou precisa ser feito."
              aria-invalid={!!errors.ambientes?.[index]?.observacao}
              {...register(`ambientes.${index}.observacao`)}
            />
            <FieldError errors={[errors.ambientes?.[index]?.observacao]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`localizacao-${index}`}>
              Localização do ambiente
            </FieldLabel>
            <Input
              id={`localizacao-${index}`}
              placeholder="Coordenadas ou descrição"
              {...register(`ambientes.${index}.localizacao`)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => gps(index)}
            >
              <MapPin data-icon="inline-start" /> Registrar GPS
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function textoResumo(ronda: RondaInput) {
  const total = ronda.ambientes.reduce((n, a) => n + a.tarefas.length, 0);
  const feitas = ronda.ambientes.reduce(
    (n, a) => n + a.tarefas.filter((t) => t.concluida).length,
    0,
  );
  return [
    "ROTINA FACILITIES - ELINSA DO BRASIL",
    `Base: ${ronda.base}`,
    `Data: ${ronda.data}`,
    `Responsável: ${ronda.responsavel || "Não informado"}`,
    "",
    `ID da ronda: ${ronda.id}`,
    `Turno: ${ronda.turno}`,
    `Horário previsto: ${ronda.hora}`,
    `Situação: ${ronda.status}`,
    `Plantão iniciado em: ${ronda.plantaoData || ronda.data}`,
    `GPS da ronda: ${ronda.gpsLatitude !== null ? `${ronda.gpsLatitude}, ${ronda.gpsLongitude} (±${ronda.gpsPrecisao} m)` : "Não registrado"}`,
    `Checklist: ${feitas}/${total} concluídos`,
    "Checklist detalhado",
    "",
    ...ronda.ambientes.flatMap((a) => [
      `Ambiente: ${a.nome}`,
      `Prioridade: ${a.prioridade}`,
      ...(a.localizacao ? [`Localização: ${a.localizacao}`] : []),
      `Observação: ${a.observacao}`,
      ...a.tarefas.map((t) => `${t.concluida ? "[X]" : "[ ]"} ${t.texto}`),
      "",
    ]),
    `Observações gerais: ${ronda.observacoesGerais}`,
  ].join("\n");
}

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RondaForm() {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RondaInput>({
    resolver: zodResolver(rondaSchema),
    defaultValues: vazio,
  });
  const { fields: ambientes, append: appendAmbiente } = useFieldArray({
    control,
    name: "ambientes",
    keyName: "_key",
  });
  const atual = useWatch({ control });
  const [persistido, setPersistido] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [filtro, setFiltro] = useState("");
  const [novoAmbiente, setNovoAmbiente] = useState("");
  const [novaTarefa, setNovaTarefa] = useState("");
  const [ambienteTarefa, setAmbienteTarefa] = useState("0");
  const [aviso, setAviso] = useState("");
  const [plantao, setPlantao] = useState("");
  const [importando, setImportando] = useState(false);

  const carregarHistorico = useCallback(async () => {
    try {
      const response = await fetch("/api/rondas", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setHistorico(await response.json());
    } catch {
      setAviso("Histórico indisponível. Verifique a conexão com o banco.");
    }
  }, []);

  useEffect(() => {
    const d = new Date();
    reset(novaRonda(dataLocal(d), d.toTimeString().slice(0, 5)));
    setPlantao(dataLocal(d));
    void carregarHistorico();
    const id = new URLSearchParams(window.location.search).get("id");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      void fetch(`/api/rondas/${id}`, { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          reset(await response.json());
          setPersistido(id);
        })
        .catch(() => setAviso("Não foi possível abrir a ronda selecionada."));
    }
  }, [reset, carregarHistorico]);

  async function persistir(dados: RondaInput) {
    const response = await fetch(
      persistido ? `/api/rondas/${persistido}` : "/api/rondas",
      {
        method: persistido ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      },
    );
    if (!response.ok) throw new Error();
    setPersistido(dados.id);
    reset(dados);
    setAviso(
      dados.status === "Finalizada"
        ? "Ronda finalizada e salva no banco."
        : "Ronda salva no banco.",
    );
    await carregarHistorico();
  }

  const salvar = handleSubmit(async (dados) => {
    try {
      await persistir({ ...dados, status: "Em andamento" });
    } catch {
      setAviso(
        "Não foi possível salvar. Seus dados continuam no formulário; tente novamente.",
      );
    }
  });

  const finalizar = handleSubmit(async (dados) => {
    const pendentes = dados.ambientes.reduce(
      (n, a) => n + a.tarefas.filter((t) => !t.concluida).length,
      0,
    );
    if (
      pendentes &&
      !window.confirm(
        `Há ${pendentes} itens não verificados. Finalizar a ronda assim mesmo?`,
      )
    )
      return;
    try {
      await persistir({ ...dados, status: "Finalizada" });
    } catch {
      setAviso("Não foi possível finalizar. Tente novamente.");
    }
  });

  async function abrir(id: string) {
    if (
      isDirty &&
      !window.confirm("Descartar alterações não salvas nesta ronda?")
    )
      return;
    try {
      const response = await fetch(`/api/rondas/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      reset(await response.json());
      setPersistido(id);
      window.history.replaceState(null, "", `/?id=${encodeURIComponent(id)}`);
      setAviso("Ronda carregada.");
    } catch {
      setAviso("Não foi possível abrir a ronda.");
    }
  }

  function criar(data?: string, hora?: string) {
    if (
      isDirty &&
      !window.confirm("Descartar alterações não salvas nesta ronda?")
    )
      return;
    const d = new Date();
    const anterior = getValues();
    const nova = novaRonda(
      data ?? dataLocal(d),
      hora ?? d.toTimeString().slice(0, 5),
      anterior.ambientes.length ? anterior : undefined,
    );
    if (data && anterior.turno === "Noite") nova.plantaoData = plantao;
    reset(nova);
    setPersistido(null);
    window.history.replaceState(null, "", "/");
    setAviso("Nova ronda pronta para preenchimento.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function gps(index?: number) {
    if (!navigator.geolocation) {
      setAviso("GPS indisponível neste navegador.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (index === undefined) {
          setValue("gpsLatitude", latitude, { shouldDirty: true });
          setValue("gpsLongitude", longitude, { shouldDirty: true });
          setValue("gpsPrecisao", Math.round(accuracy), { shouldDirty: true });
          setValue("gpsCapturadoEm", new Date().toISOString(), {
            shouldDirty: true,
          });
        } else
          setValue(
            `ambientes.${index}.localizacao`,
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (precisão aproximada: ${Math.round(accuracy)} m)`,
            { shouldDirty: true },
          );
        setAviso("GPS registrado. Salve a ronda para persistir.");
      },
      () =>
        setAviso(
          "Não foi possível obter o GPS. Confira a permissão de localização.",
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function adicionarAmbiente() {
    const nome = novoAmbiente.trim();
    if (!nome) {
      setAviso("Informe o nome do ambiente.");
      return;
    }
    if (
      getValues("ambientes").some(
        (a) => a.nome.toLocaleLowerCase() === nome.toLocaleLowerCase(),
      )
    ) {
      setAviso("Esse ambiente já existe.");
      return;
    }
    appendAmbiente({
      id: crypto.randomUUID(),
      nome,
      observacao: "",
      prioridade: "Informação",
      localizacao: "",
      tarefas: [],
    });
    setNovoAmbiente("");
    setAviso("Ambiente adicionado. Salve a ronda para persistir.");
  }

  function adicionarTarefa() {
    const texto = novaTarefa.trim();
    const i = Number(ambienteTarefa);
    const lista = getValues(`ambientes.${i}.tarefas`);
    if (!texto || !lista) {
      setAviso("Selecione o ambiente e informe a tarefa.");
      return;
    }
    setValue(
      `ambientes.${i}.tarefas`,
      [...lista, { id: crypto.randomUUID(), texto, concluida: false }],
      { shouldDirty: true },
    );
    setNovaTarefa("");
    setAviso("Tarefa adicionada. Salve a ronda para persistir.");
  }

  async function exportarBackup() {
    try {
      const res = await fetch("/api/rondas?all=1", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const lista = (await res.json()) as Historico[];
      const rondas = await Promise.all(
        lista.map(async (r) => {
          const detalhe = await fetch(`/api/rondas/${r.id}`, {
            cache: "no-store",
          });
          if (!detalhe.ok) throw new Error();
          return (await detalhe.json()) as RondaInput;
        }),
      );
      const atual = getValues();
      if (isDirty || !persistido) {
        const i = rondas.findIndex((r) => r.id === atual.id);
        if (i >= 0) rondas[i] = atual;
        else rondas.push(atual);
      }
      baixar(
        `backup-rondas-facilities-${dataLocal(new Date())}.json`,
        JSON.stringify(
          {
            sistema: "Ronda de Facilities Elinsa",
            versao: 4,
            exportadoEm: new Date().toISOString(),
            rondas,
          },
          null,
          2,
        ),
        "application/json",
      );
      setAviso(`${rondas.length} ronda(s) incluída(s) no backup.`);
    } catch {
      setAviso("Não foi possível gerar o backup.");
    }
  }

  async function importarBackup(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) {
      setAviso("O arquivo deve ter até 5 MB.");
      return;
    }
    setImportando(true);
    try {
      const pacote = JSON.parse(await file.text()) as Record<string, unknown>;
      const itens = Array.isArray(pacote.rondas)
        ? pacote.rondas
        : [pacote.estado ?? pacote];
      if (!itens.length || itens.length > 200) throw new Error();
      const rondas = itens.map(importarRondaLegada);
      let importadas = 0;
      for (const ronda of rondas) {
        const res = await fetch("/api/rondas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ronda),
        });
        if (!res.ok) throw new Error();
        importadas++;
      }
      await carregarHistorico();
      setAviso(`${importadas} ronda(s) importada(s) como novos registros.`);
    } catch {
      setAviso(
        "Falha ao importar. Confira o JSON. Registros já importados foram preservados.",
      );
    } finally {
      setImportando(false);
    }
  }

  async function compartilhar() {
    const texto = textoResumo(getValues());
    try {
      if (navigator.share)
        await navigator.share({ title: "Ronda de Facilities", text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        setAviso("Resumo copiado para a área de transferência.");
      }
    } catch {
      setAviso("Não foi possível compartilhar o resumo.");
    }
  }

  const total =
    atual.ambientes?.reduce((n, a) => n + (a?.tarefas?.length ?? 0), 0) ?? 0;
  const concluidas =
    atual.ambientes?.reduce(
      (n, a) => n + (a?.tarefas?.filter((t) => t?.concluida).length ?? 0),
      0,
    ) ?? 0;
  const porcentagem = total ? Math.round((concluidas / total) * 100) : 0;
  const rondasFiltradas = historico.filter((r) => !filtro || r.data === filtro);
  const agenda = Array.from({ length: 13 }, (_, i) => {
    const hora = (19 + i) % 24;
    const data = new Date(
      `${plantao || atual.data || dataLocal(new Date())}T12:00:00`,
    );
    if (hora < 19) data.setDate(data.getDate() + 1);
    const dataTexto = dataLocal(data);
    const horaTexto = `${String(hora).padStart(2, "0")}:00`;
    const existente = historico.find(
      (r) =>
        r.data === dataTexto &&
        r.hora === horaTexto &&
        r.turno === "Noite" &&
        r.base === atual.base,
    );
    return { data: dataTexto, hora: horaTexto, existente };
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Elinsa do Brasil · Facilities
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Ronda de Facilities
          </h1>
          <p className="mt-2 text-muted-foreground">
            Inspeção, ocorrências e acompanhamento dos ambientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline" })}
          >
            <ChartNoAxesColumn data-icon="inline-start" /> Dashboard
          </Link>
          <Button type="button" variant="outline" onClick={() => criar()}>
            <Plus data-icon="inline-start" /> Nova ronda
          </Button>
        </div>
      </header>
      {aviso && (
        <output className="rounded-xl border border-border bg-muted px-4 py-3 text-sm">
          {aviso}
        </output>
      )}
      <form onSubmit={salvar} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identificação da ronda</CardTitle>
            <CardDescription>
              Preencha os dados antes de salvar ou finalizar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Field data-invalid={!!errors.data}>
                  <FieldLabel htmlFor="data">Data da ronda</FieldLabel>
                  <Input
                    id="data"
                    type="date"
                    aria-invalid={!!errors.data}
                    {...register("data")}
                  />
                  <FieldError errors={[errors.data]} />
                </Field>
                <Field data-invalid={!!errors.responsavel}>
                  <FieldLabel htmlFor="responsavel">Responsável</FieldLabel>
                  <Input
                    id="responsavel"
                    placeholder="Nome do responsável"
                    aria-invalid={!!errors.responsavel}
                    {...register("responsavel")}
                  />
                  <FieldError errors={[errors.responsavel]} />
                </Field>
                <Field data-invalid={!!errors.base}>
                  <FieldLabel htmlFor="base">Unidade / base</FieldLabel>
                  <Input
                    id="base"
                    aria-invalid={!!errors.base}
                    {...register("base")}
                  />
                  <FieldError errors={[errors.base]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="turno">Turno</FieldLabel>
                  <NativeSelect id="turno" {...register("turno")}>
                    <option>Manhã</option>
                    <option>Tarde</option>
                    <option>Noite</option>
                  </NativeSelect>
                </Field>
                <Field data-invalid={!!errors.hora}>
                  <FieldLabel htmlFor="hora">Horário previsto</FieldLabel>
                  <Input
                    id="hora"
                    type="time"
                    aria-invalid={!!errors.hora}
                    {...register("hora")}
                  />
                  <FieldError errors={[errors.hora]} />
                </Field>
                <Field>
                  <FieldLabel>Situação</FieldLabel>
                  <p className="flex h-9 items-center text-sm font-medium">
                    {atual.status ?? "Em andamento"}
                    {isDirty ? " · alterações não salvas" : ""}
                  </p>
                </Field>
              </div>
              <p className="break-all text-xs text-muted-foreground">
                ID: {atual.id}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => gps()}>
                  <MapPin data-icon="inline-start" /> Registrar GPS da ronda
                </Button>
                {atual.gpsLatitude !== null &&
                  atual.gpsLatitude !== undefined && (
                    <p className="self-center text-sm text-muted-foreground">
                      {atual.gpsLatitude?.toFixed(6)},{" "}
                      {atual.gpsLongitude?.toFixed(6)} · ±{atual.gpsPrecisao} m
                    </p>
                  )}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5" /> Progresso do checklist
            </CardTitle>
            <CardDescription>
              {concluidas} de {total} tarefas concluídas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${porcentagem}%` }}
              />
            </div>
            <p className="mt-2 text-right text-sm font-medium">
              {porcentagem}%
            </p>
          </CardContent>
        </Card>

        {atual.turno === "Noite" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5" /> Agenda do plantão noturno
              </CardTitle>
              <CardDescription>
                Das 19h às 07h. Selecione um horário para abrir ou iniciar a
                ronda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="plantao">
                    Data de início do plantão
                  </FieldLabel>
                  <Input
                    id="plantao"
                    type="date"
                    value={plantao}
                    onChange={(e) => setPlantao(e.target.value)}
                    className="max-w-52"
                  />
                </Field>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
                  {agenda.map((slot) => (
                    <Button
                      key={`${slot.data}-${slot.hora}`}
                      type="button"
                      size="sm"
                      variant={slot.existente ? "secondary" : "outline"}
                      onClick={() =>
                        slot.existente
                          ? void abrir(slot.existente.id)
                          : criar(slot.data, slot.hora)
                      }
                      className="h-auto flex-col py-2"
                    >
                      <span>{slot.hora}</span>
                      <span className="text-xs font-normal">
                        {slot.data.slice(8)}/{slot.data.slice(5, 7)}
                      </span>
                      <span className="text-[10px] font-normal">
                        {slot.existente?.status ?? "Programada"}
                      </span>
                    </Button>
                  ))}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Histórico de rondas</CardTitle>
            <CardDescription>Registros salvos no banco.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="filtro">Filtrar por data</FieldLabel>
                <Input
                  id="filtro"
                  type="date"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="max-w-52"
                />
              </Field>
              <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
                {rondasFiltradas.length ? (
                  rondasFiltradas.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {r.data} · {r.hora} · {r.turno}
                        </p>
                        <p className="text-muted-foreground">
                          {r.responsavel} · {r.base} · {r.status}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void abrir(r.id)}
                      >
                        {r.id === persistido ? "Atual" : "Abrir"}
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma ronda encontrada.
                  </p>
                )}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <nav aria-label="Ambientes" className="flex flex-wrap gap-2">
          {ambientes.map((a, i) => (
            <a
              key={a._key}
              href={`#ambiente-${i}`}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
            >
              {atual.ambientes?.[i]?.nome ?? a.nome}
            </a>
          ))}
        </nav>
        <div className="grid gap-5 lg:grid-cols-2">
          {ambientes.map((a, i) => (
            <AmbienteFields
              key={a._key}
              index={i}
              control={control}
              register={register}
              errors={errors}
              gps={gps}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Observações gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field data-invalid={!!errors.observacoesGerais}>
                <FieldLabel htmlFor="observacoes">
                  Pendências e acompanhamento
                </FieldLabel>
                <Textarea
                  id="observacoes"
                  placeholder="Material pendente, manutenção necessária..."
                  aria-invalid={!!errors.observacoesGerais}
                  {...register("observacoesGerais")}
                />
                <FieldError errors={[errors.observacoesGerais]} />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personalizar checklist</CardTitle>
            <CardDescription>
              Adicione ambientes e tarefas para esta ronda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-6">
              <Field>
                <FieldLabel htmlFor="novo-ambiente">Novo ambiente</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="novo-ambiente"
                    value={novoAmbiente}
                    onChange={(e) => setNovoAmbiente(e.target.value)}
                    placeholder="Ex.: Casa de bombas"
                    className="min-w-48 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={adicionarAmbiente}
                  >
                    <Plus data-icon="inline-start" /> Adicionar
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="nova-tarefa">Nova tarefa</FieldLabel>
                <NativeSelect
                  aria-label="Ambiente da nova tarefa"
                  value={ambienteTarefa}
                  onChange={(e) => setAmbienteTarefa(e.target.value)}
                >
                  {ambientes.map((a, i) => (
                    <option key={a._key} value={i}>
                      {atual.ambientes?.[i]?.nome ?? a.nome}
                    </option>
                  ))}
                </NativeSelect>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="nova-tarefa"
                    value={novaTarefa}
                    onChange={(e) => setNovaTarefa(e.target.value)}
                    placeholder="Ex.: Verificar iluminação"
                    className="min-w-48 flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={adicionarTarefa}
                  >
                    <Plus data-icon="inline-start" /> Adicionar
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Salvar e compartilhar</CardTitle>
            <CardDescription>
              Salve a ronda antes de trocar de página. O TXT pode ser importado
              pelo dashboard legado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSubmitting}>
                <Save data-icon="inline-start" /> Salvar ronda
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => void finalizar()}
              >
                <Check data-icon="inline-start" /> Finalizar ronda
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  baixar(
                    `facilities-${getValues("data")}-${getValues("id")}.txt`,
                    `\uFEFF${textoResumo(getValues()).replaceAll("\n", "\r\n")}`,
                    "text/plain;charset=utf-8",
                  )
                }
              >
                <Download data-icon="inline-start" /> Exportar TXT
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(textoResumo(getValues()))}`,
                    "_blank",
                    "noopener",
                  )
                }
              >
                <Share2 data-icon="inline-start" /> WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void compartilhar()}
              >
                <Share2 data-icon="inline-start" /> Compartilhar / copiar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void exportarBackup()}
              >
                <Download data-icon="inline-start" /> Backup de todas as rondas
              </Button>
            </div>
            <Field className="mt-5">
              <FieldLabel htmlFor="importar-backup">
                Restaurar backup JSON
              </FieldLabel>
              <Input
                id="importar-backup"
                type="file"
                accept=".json,application/json"
                disabled={importando}
                onChange={(e) => {
                  void importarBackup(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <FieldDescription>
                Compatível com backups do formulário HTML original. A importação
                cria novos registros.
              </FieldDescription>
            </Field>
          </CardContent>
        </Card>
      </form>
    </main>
  );
}
