"use client";

import {
  AlertCircle,
  ArrowLeft,
  ChartNoAxesColumn,
  CheckCheck,
  Download,
  FileText,
  FolderOpen,
  MapPin,
  Printer,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardRonda, Ocorrencia } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

function dataBR(data: string) {
  const partes = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : data;
}

function busca(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function urlMapa(localizacao: string) {
  const coords = localizacao.match(/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/);
  return coords
    ? `https://www.google.com/maps?q=${encodeURIComponent(coords[0].replaceAll(" ", ""))}`
    : null;
}

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function textoRonda(r: DashboardRonda) {
  if (r.conteudoTXT) return r.conteudoTXT;
  return [
    "ROTINA FACILITIES - ELINSA DO BRASIL",
    `Base: ${r.base}`,
    `Data: ${r.data}`,
    `Responsável: ${r.responsavel}`,
    "",
    `ID da ronda: ${r.id}`,
    `Turno: ${r.turno}`,
    `Horário previsto: ${r.hora}`,
    `Situação: ${r.status}`,
    "Checklist detalhado",
    "",
    ...r.ambientes.flatMap((a) => [
      `Ambiente: ${a.nome}`,
      `Prioridade: ${a.prioridade}`,
      ...(a.localizacao ? [`Localização: ${a.localizacao}`] : []),
      `Observação: ${a.observacao}`,
      ...a.tarefas.map((t) => `${t.concluida ? "[X]" : "[ ]"} ${t.texto}`),
      "",
    ]),
    `Observações gerais: ${r.observacoesGerais}`,
  ].join("\r\n");
}

function ocorrenciasDasRondas(rondas: DashboardRonda[]): Ocorrencia[] {
  return rondas
    .flatMap((r) => {
      const ambientes = r.ambientes
        .filter(
          (a) =>
            a.observacao.trim() ||
            a.localizacao.trim() ||
            a.prioridade !== "Informação",
        )
        .map((a) => ({
          id: `${r.id}:${a.id}`,
          rondaId: r.id,
          data: r.data,
          ambiente: a.nome,
          prioridade: a.prioridade,
          observacao: a.observacao,
          localizacao: a.localizacao,
          responsavel: r.responsavel,
          arquivo: r.arquivoOrigem ?? "Ronda no Turso",
          itensChecklist: a.tarefas.length,
        }));
      const gerais = r.observacoesGerais
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((observacao, i) => ({
          id: `${r.id}:geral:${i}`,
          rondaId: r.id,
          data: r.data,
          ambiente: "Observações gerais",
          prioridade: "Informação" as const,
          observacao,
          localizacao: "",
          responsavel: r.responsavel,
          arquivo: r.arquivoOrigem ?? "Ronda no Turso",
          itensChecklist: 0,
        }));
      return [...ambientes, ...gerais];
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

function Barras({ valores }: { valores: Array<[string, number]> }) {
  const maiores = [...valores]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const maximo = maiores[0]?.[1] ?? 1;
  if (!maiores.length)
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há dados suficientes.
      </p>
    );
  return (
    <div className="flex flex-col gap-4">
      {maiores.map(([nome, quantidade]) => (
        <div
          key={nome}
          className="grid grid-cols-[minmax(7rem,1fr)_minmax(5rem,2fr)_2rem] items-center gap-3 text-sm"
        >
          <span className="truncate" title={nome}>
            {nome}
          </span>
          <Progress
            aria-label={`${nome}: ${quantidade}`}
            value={Math.round((quantidade / maximo) * 100)}
          />
          <strong className="text-right tabular-nums">{quantidade}</strong>
        </div>
      ))}
    </div>
  );
}

function SemDados({
  titulo,
  descricao,
}: {
  titulo: string;
  descricao: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpen />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription>{descricao}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function DashboardFacilities({ rondas }: { rondas: DashboardRonda[] }) {
  const router = useRouter();
  const txtInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [buscaTexto, setBuscaTexto] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroData, setFiltroData] = useState("");
  const [filtroAmbiente, setFiltroAmbiente] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<{
    tipo: "default" | "destructive";
    texto: string;
  } | null>(null);

  const ocorrencias = useMemo(() => ocorrenciasDasRondas(rondas), [rondas]);
  const filtradas = useMemo(() => {
    const q = busca(buscaTexto);
    return ocorrencias.filter(
      (o) =>
        (!q ||
          busca(
            [
              o.ambiente,
              o.observacao,
              o.responsavel,
              o.arquivo,
              o.localizacao,
            ].join(" "),
          ).includes(q)) &&
        (!filtroPrioridade || o.prioridade === filtroPrioridade) &&
        (!filtroData || o.data === filtroData) &&
        (!filtroAmbiente || o.ambiente === filtroAmbiente),
    );
  }, [ocorrencias, buscaTexto, filtroPrioridade, filtroData, filtroAmbiente]);
  const datas = [...new Set(ocorrencias.map((o) => o.data))].sort().reverse();
  const ambientes = [...new Set(ocorrencias.map((o) => o.ambiente))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const contagemPrioridade: Array<[string, number]> = [
    "Urgente",
    "Pouco urgente",
    "Informação",
  ].map((p) => [p, ocorrencias.filter((o) => o.prioridade === p).length]);
  const porAmbiente = Object.entries(
    ocorrencias.reduce<Record<string, number>>((acc, o) => {
      acc[o.ambiente] = (acc[o.ambiente] ?? 0) + 1;
      return acc;
    }, {}),
  );
  const tarefas = rondas.flatMap((r) => r.ambientes.flatMap((a) => a.tarefas));
  const concluidas = tarefas.filter((t) => t.concluida).length;
  const importadas = rondas.filter((r) => r.hashTXT);
  const indicadores = [
    {
      titulo: "Rondas registradas",
      valor: rondas.length,
      nota: `${importadas.length} importada(s) de TXT`,
      icone: FileText,
    },
    {
      titulo: "Ocorrências identificadas",
      valor: ocorrencias.length,
      nota: "Observações, GPS ou prioridade",
      icone: ChartNoAxesColumn,
    },
    {
      titulo: "Urgentes",
      valor: contagemPrioridade[0][1],
      nota: "Requerem atenção prioritária",
      icone: TriangleAlert,
    },
    {
      titulo: "Pouco urgentes",
      valor: contagemPrioridade[1][1],
      nota: "Acompanhar e programar",
      icone: AlertCircle,
    },
    {
      titulo: "Checklist concluído",
      valor: tarefas.length
        ? `${Math.round((concluidas / tarefas.length) * 100)}%`
        : "0%",
      nota: `${concluidas} de ${tarefas.length} tarefas concluídas`,
      icone: CheckCheck,
    },
  ];

  async function importarTXT(files: File[]) {
    if (!files.length) return;
    const errosLocais = files
      .filter((f) => !/\.txt$/i.test(f.name) || f.size > 1_000_000)
      .map((f) => f.name);
    const validos = files
      .filter((f) => /\.txt$/i.test(f.name) && f.size <= 1_000_000)
      .slice(0, 50);
    if (!validos.length) {
      setMensagem({
        tipo: "destructive",
        texto: "Selecione arquivos TXT de até 1 MB.",
      });
      return;
    }
    setOcupado(true);
    try {
      const dados = await Promise.all(
        validos.map(async (file) => ({
          name: file.name,
          text: await file.text(),
        })),
      );
      const res = await fetch("/api/dashboard/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: dados }),
      });
      if (!res.ok) throw new Error();
      const resultado = (await res.json()) as {
        adicionados: number;
        duplicados: number;
        erros: string[];
      };
      setMensagem({
        tipo:
          resultado.erros.length || errosLocais.length
            ? "destructive"
            : "default",
        texto:
          `${resultado.adicionados} arquivo(s) importado(s), ${resultado.duplicados} duplicado(s) ignorado(s). ${[...errosLocais.map((n) => `${n}: formato ou tamanho inválido`), ...resultado.erros].join(" | ")}`.trim(),
      });
      router.refresh();
    } catch {
      setMensagem({
        tipo: "destructive",
        texto: "Não foi possível importar os arquivos TXT.",
      });
    } finally {
      setOcupado(false);
    }
  }

  async function restaurarBackup(file?: File) {
    if (!file) return;
    if (file.size > 20_000_000) {
      setMensagem({
        tipo: "destructive",
        texto: "O backup deve ter até 20 MB.",
      });
      return;
    }
    setOcupado(true);
    try {
      const res = await fetch("/api/dashboard/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      });
      if (!res.ok) throw new Error();
      const resultado = (await res.json()) as {
        adicionados: number;
        duplicados: number;
        erros: string[];
      };
      setMensagem({
        tipo: resultado.erros.length ? "destructive" : "default",
        texto:
          `${resultado.adicionados} ronda(s) restaurada(s), ${resultado.duplicados} duplicada(s) ignorada(s). ${resultado.erros.join(" | ")}`.trim(),
      });
      router.refresh();
    } catch {
      setMensagem({
        tipo: "destructive",
        texto: "Não foi possível restaurar o backup JSON.",
      });
    } finally {
      setOcupado(false);
    }
  }

  function exportarCSV() {
    const linhas = [
      [
        "Data",
        "Ambiente",
        "Prioridade",
        "Observação",
        "Localização",
        "Responsável",
        "Arquivo",
      ],
      ...filtradas.map((o) => [
        o.data,
        o.ambiente,
        o.prioridade,
        o.observacao,
        o.localizacao,
        o.responsavel,
        o.arquivo,
      ]),
    ];
    const csv = `\uFEFF${linhas.map((linha) => linha.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n")}`;
    baixar("ocorrencias_facilities_elinsa.csv", csv, "text/csv;charset=utf-8");
  }

  async function remover(id: string) {
    const ronda = rondas.find((r) => r.id === id);
    if (
      !ronda?.hashTXT ||
      !window.confirm(
        `Remover a importação ${ronda.arquivoOrigem}? Esta ação não pode ser desfeita.`,
      )
    )
      return;
    setOcupado(true);
    try {
      const res = await fetch(`/api/dashboard/imports/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setMensagem({ tipo: "default", texto: "Importação removida." });
      router.refresh();
    } catch {
      setMensagem({
        tipo: "destructive",
        texto: "Não foi possível remover a importação.",
      });
    } finally {
      setOcupado(false);
    }
  }

  async function limparImportacoes() {
    if (
      !importadas.length ||
      !window.confirm(
        `Remover ${importadas.length} ronda(s) importada(s) de TXT? As rondas preenchidas no formulário serão preservadas.`,
      ) ||
      !window.confirm("Confirmação final: remover todas as importações TXT?")
    )
      return;
    setOcupado(true);
    try {
      const res = await fetch("/api/dashboard/imports", { method: "DELETE" });
      if (!res.ok) throw new Error();
      const resultado = (await res.json()) as { removidos: number };
      setMensagem({
        tipo: "default",
        texto: `${resultado.removidos} importação(ões) removida(s).`,
      });
      router.refresh();
    } catch {
      setMensagem({
        tipo: "destructive",
        texto: "Não foi possível remover as importações.",
      });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="dashboard-print mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Elinsa do Brasil · Facilities
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Dashboard de Facilities
          </h1>
          <p className="mt-2 text-muted-foreground">
            Histórico de rondas, tarefas e ocorrências em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Link href="/" className={buttonVariants({ variant: "default" })}>
            <ArrowLeft data-icon="inline-start" /> Formulário de ronda
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.refresh()}
          >
            <RotateCcw data-icon="inline-start" /> Atualizar
          </Button>
        </div>
      </header>
      <p className="text-sm text-muted-foreground">
        Banco Turso ativo · {rondas.length} ronda(s) registrada(s)
      </p>
      {mensagem && (
        <Alert variant={mensagem.tipo}>
          <AlertCircle />
          <AlertTitle>Resultado da operação</AlertTitle>
          <AlertDescription>{mensagem.texto}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          01 · Visão geral
        </h2>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={exportarCSV}>
            <Download data-icon="inline-start" /> Exportar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              baixar(
                `backup_facilities_elinsa_${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(
                  {
                    produto: "Elinsa Facilities Dashboard",
                    versao: 2,
                    exportadoEm: new Date().toISOString(),
                    rondas,
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            <Download data-icon="inline-start" /> Backup completo
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => backupInput.current?.click()}
            disabled={ocupado}
          >
            <Upload data-icon="inline-start" /> Restaurar backup
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
          >
            <Printer data-icon="inline-start" /> Imprimir / PDF
          </Button>
          <input
            ref={backupInput}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Arquivo de backup JSON"
            onChange={(e) => {
              void restaurarBackup(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      >
        {indicadores.map(({ titulo, valor, nota, icone: Icone }) => (
          <Card key={titulo} size="sm">
            <CardHeader>
              <CardDescription className="flex items-start justify-between gap-2">
                {titulo}
                <Icone className="size-4 shrink-0" />
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {valor}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{nota}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        02 · Alimentar o histórico
      </h2>
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Importar arquivos de ronda</CardTitle>
            <CardDescription>
              Selecione um ou vários TXT exportados pelo formulário antigo ou
              pelo Argos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Drag events complement the accessible file selection button. */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setArrastando(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                void importarTXT([...e.dataTransfer.files]);
              }}
              className={cn(
                "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-9 text-center transition-colors",
                arrastando && "border-primary bg-accent",
              )}
            >
              <Upload className="size-8 text-muted-foreground" />
              <p className="font-medium">Arraste arquivos TXT para cá</p>
              <p className="text-sm text-foreground">
                ou selecione os arquivos no computador
              </p>
              <Button
                type="button"
                onClick={() => txtInput.current?.click()}
                disabled={ocupado}
              >
                Selecionar arquivos TXT
              </Button>
              <input
                ref={txtInput}
                type="file"
                accept=".txt,text/plain"
                multiple
                className="sr-only"
                aria-label="Arquivos TXT de ronda"
                onChange={(e) => {
                  void importarTXT([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
            </div>
            <Alert>
              <AlertCircle />
              <AlertTitle>Dados centralizados</AlertTitle>
              <AlertDescription>
                As rondas preenchidas no projeto aparecem automaticamente. Os
                TXT antigos importados são guardados no Turso.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Distribuição das ocorrências</CardTitle>
            <CardDescription>
              Ocorrências agrupadas por prioridade em todo o histórico.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Barras valores={contagemPrioridade} />
            <Separator />
            <div>
              <h3 className="mb-1 font-medium">
                Ambientes com mais ocorrências
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Locais com observações, localização ou prioridade acima de
                informação.
              </p>
              <Barras valores={porAmbiente} />
            </div>
          </CardContent>
        </Card>
      </section>

      <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        03 · Ocorrências e observações
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>Registros de ocorrência</CardTitle>
          <CardDescription>
            Filtre os registros e exporte a seleção em CSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 print:hidden">
            <Field className="lg:col-span-2">
              <FieldLabel htmlFor="busca">Buscar</FieldLabel>
              <Input
                id="busca"
                placeholder="Ambiente, observação, responsável…"
                value={buscaTexto}
                onChange={(e) => setBuscaTexto(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="prioridade">Prioridade</FieldLabel>
              <NativeSelect
                id="prioridade"
                value={filtroPrioridade}
                onChange={(e) => setFiltroPrioridade(e.target.value)}
              >
                <option value="">Todas</option>
                <option>Urgente</option>
                <option>Pouco urgente</option>
                <option>Informação</option>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="data-filtro">Data</FieldLabel>
              <NativeSelect
                id="data-filtro"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
              >
                <option value="">Todas as datas</option>
                {datas.map((d) => (
                  <option key={d} value={d}>
                    {dataBR(d)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="ambiente-filtro">Ambiente</FieldLabel>
              <NativeSelect
                id="ambiente-filtro"
                value={filtroAmbiente}
                onChange={(e) => setFiltroAmbiente(e.target.value)}
              >
                <option value="">Todos os ambientes</option>
                {ambientes.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </NativeSelect>
            </Field>
          </FieldGroup>
          <Button
            className="self-start print:hidden"
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setBuscaTexto("");
              setFiltroPrioridade("");
              setFiltroData("");
              setFiltroAmbiente("");
            }}
          >
            <X data-icon="inline-start" /> Limpar filtros
          </Button>
          {filtradas.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Observação / ocorrência</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Arquivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{dataBR(o.data)}</TableCell>
                    <TableCell className="whitespace-normal">
                      <strong>{o.ambiente}</strong>
                      {o.itensChecklist > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {o.itensChecklist} itens de checklist
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          o.prioridade === "Urgente"
                            ? "destructive"
                            : o.prioridade === "Pouco urgente"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {o.prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-48 whitespace-pre-wrap">
                      {o.observacao || "—"}
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal">
                      {urlMapa(o.localizacao) ? (
                        <a
                          href={urlMapa(o.localizacao) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline underline-offset-2"
                        >
                          {o.localizacao}
                          <MapPin className="size-3" />
                        </a>
                      ) : (
                        o.localizacao || "—"
                      )}
                    </TableCell>
                    <TableCell>{o.responsavel || "—"}</TableCell>
                    <TableCell>{o.arquivo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <SemDados
              titulo="Nenhuma ocorrência encontrada"
              descricao="Ajuste os filtros ou importe rondas para começar."
            />
          )}
          <p className="text-sm text-muted-foreground">
            Exibindo {filtradas.length} de {ocorrencias.length} registros de
            ocorrência.
          </p>
        </CardContent>
      </Card>

      <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        04 · Histórico de rondas
      </h2>
      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Rondas registradas</CardTitle>
            <CardDescription>
              Rondas do formulário e arquivos TXT importados.
            </CardDescription>
          </div>
          {importadas.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={ocupado}
              className="print:hidden"
              onClick={() => void limparImportacoes()}
            >
              <Trash2 data-icon="inline-start" /> Remover importações TXT
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {rondas.length ? (
            <div className="flex flex-col gap-2">
              {rondas.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                >
                  <div>
                    <strong className="text-sm">
                      {dataBR(r.data)} · {r.base}
                    </strong>
                    <p className="text-sm text-muted-foreground">
                      {r.responsavel || "Responsável não informado"} ·{" "}
                      {r.arquivoOrigem ?? "Ronda no Turso"} ·{" "}
                      {r.ambientes.length} ambientes ·{" "}
                      {r.ambientes.reduce((n, a) => n + a.tarefas.length, 0)}{" "}
                      tarefas
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Atualizada em{" "}
                      {new Date(r.atualizadoEm).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <Link
                      href={`/?id=${encodeURIComponent(r.id)}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Abrir
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        baixar(
                          (r.arquivoOrigem ?? `ronda-${r.id}.txt`).replace(
                            /[\\/:*?"<>|]/g,
                            "_",
                          ),
                          textoRonda(r),
                          "text/plain;charset=utf-8",
                        )
                      }
                    >
                      Ver TXT
                    </Button>
                    {r.hashTXT && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={ocupado}
                        onClick={() => void remover(r.id)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SemDados
              titulo="Nenhuma ronda registrada"
              descricao="Preencha o formulário ou importe arquivos TXT para começar."
            />
          )}
        </CardContent>
      </Card>
      <footer className="pb-6 text-center text-xs text-muted-foreground print:hidden">
        Elinsa do Brasil · Facilities · Dados guardados no Turso
      </footer>
    </main>
  );
}
