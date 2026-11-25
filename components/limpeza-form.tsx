"use client";

import { Check, LoaderCircle } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type LimpezaRegistro, limpezaRegistroSchema } from "@/lib/limpeza";
import { dataLocal } from "@/lib/ronda";

type Opcao = { label: string; value: string };
type TurnoLimpeza = "Manhã" | "Tarde";

const turnosLimpeza: Opcao[] = [
  { label: "Manhã", value: "Manhã" },
  { label: "Tarde", value: "Tarde" },
];

export function LimpezaForm({
  ambientes,
  baseAtual,
  opcoesBase,
  oculto,
}: {
  ambientes: string[];
  baseAtual: string;
  opcoesBase: Opcao[];
  oculto: boolean;
}) {
  const [base, setBase] = useState(baseAtual);
  const [data, setData] = useState("");
  const [turno, setTurno] = useState<TurnoLimpeza>("Manhã");
  const [funcionaria, setFuncionaria] = useState("");
  const [salasMarcadas, setSalasMarcadas] = useState<Record<string, boolean>>(
    {},
  );
  const [ocorrencias, setOcorrencias] = useState<Record<string, string>>({});
  const [registros, setRegistros] = useState<LimpezaRegistro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setData(dataLocal(new Date()));
  }, []);

  useEffect(() => {
    setBase(baseAtual);
  }, [baseAtual]);

  const carregarRegistros = useCallback(
    async (signal: AbortSignal) => {
      if (!base || !data) return;
      setCarregando(true);
      setErro("");
      setRegistros([]);
      try {
        const query = new URLSearchParams({ base, data, turno });
        const response = await fetch(`/api/limpezas?${query}`, {
          cache: "no-store",
          signal,
        });
        const resultado = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            typeof resultado?.error === "string"
              ? resultado.error
              : "Não foi possível carregar os registros de limpeza.",
          );
        }
        const validado = limpezaRegistroSchema.array().safeParse(resultado);
        if (!validado.success) {
          throw new Error(
            "O servidor retornou registros de limpeza inválidos.",
          );
        }
        setRegistros(validado.data);
      } catch (error) {
        if (signal.aborted) return;
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os registros de limpeza.",
        );
      } finally {
        if (!signal.aborted) setCarregando(false);
      }
    },
    [base, data, turno],
  );

  useEffect(() => {
    if (oculto) return;
    const controller = new AbortController();
    void carregarRegistros(controller.signal);
    return () => controller.abort();
  }, [carregarRegistros, oculto]);

  async function salvarRegistros(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const salas = ambientes.filter((sala) => salasMarcadas[sala]);
    if (!salas.length) {
      setErro("Marque pelo menos uma sala para registrar a limpeza.");
      return;
    }
    if (!funcionaria.trim()) {
      setErro("Informe o nome da funcionária.");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      const response = await fetch("/api/limpezas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          salas.map((ambiente) => ({
            base,
            data,
            turno,
            ambiente,
            funcionaria,
            observacao: ocorrencias[ambiente] ?? "",
          })),
        ),
      });
      const resultado = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof resultado?.error === "string"
            ? resultado.error
            : "Não foi possível salvar os registros de limpeza.",
        );
      }
      if (resultado?.count !== salas.length) {
        throw new Error(
          "O servidor não confirmou o salvamento de todas as salas.",
        );
      }
      setSalasMarcadas({});
      setOcorrencias({});
      await carregarRegistros(new AbortController().signal);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar os registros de limpeza.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const salas = [
    ...new Set([
      ...ambientes,
      ...registros.map((registro) => registro.ambiente),
    ]),
  ];

  return (
    <section
      hidden={oculto}
      className="flex flex-col gap-5"
      aria-labelledby="titulo-limpeza"
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="titulo-limpeza">Registro de limpeza</h2>
          </CardTitle>
          <CardDescription>
            Escolha o turno, marque as salas limpas e anote as ocorrências por
            sala. Os registros serão salvos juntos ao final.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvarRegistros}>
            <FieldGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="limpeza-funcionaria">
                  Nome da funcionária
                </FieldLabel>
                <Input
                  id="limpeza-funcionaria"
                  autoComplete="name"
                  maxLength={120}
                  value={funcionaria}
                  onChange={(event) => setFuncionaria(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="limpeza-base">Unidade / base</FieldLabel>
                <Select
                  items={opcoesBase}
                  value={base}
                  onValueChange={(valor) => {
                    if (valor !== null) setBase(valor);
                  }}
                >
                  <SelectTrigger id="limpeza-base" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {opcoesBase.map((opcao) => (
                        <SelectItem key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="limpeza-turno">Turno</FieldLabel>
                <Select
                  items={turnosLimpeza}
                  value={turno}
                  onValueChange={(valor) => {
                    if (valor === "Manhã" || valor === "Tarde") {
                      setTurno(valor);
                    }
                  }}
                >
                  <SelectTrigger id="limpeza-turno" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {turnosLimpeza.map((opcao) => (
                        <SelectItem key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="limpeza-data">Data da limpeza</FieldLabel>
                <Input
                  id="limpeza-data"
                  type="date"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  required
                />
              </Field>
            </FieldGroup>

            {erro && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <Card className="mt-5">
              <CardHeader>
                <CardTitle>Salas</CardTitle>
                <CardDescription>
                  Registros de {base}, turno da {turno.toLowerCase()}, em{" "}
                  {data
                    ? new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR")
                    : "—"}
                  . Marque as salas e salve todas no final.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!data || carregando ? (
                  <output
                    className="text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    {data
                      ? "Carregando registros…"
                      : "Preparando o formulário…"}
                  </output>
                ) : !salas.length ? (
                  <p className="text-sm text-muted-foreground">
                    Não há salas cadastradas para esta ronda.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {salas.map((sala, index) => {
                      const historico = registros.filter(
                        (registro) => registro.ambiente === sala,
                      );
                      return (
                        <li key={sala} className="rounded-lg border p-4">
                          <label
                            htmlFor={`limpeza-sala-${index}`}
                            className="-m-4 mb-0 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-t-lg p-4"
                          >
                            <span className="text-base font-medium">
                              {sala}
                            </span>
                            <Checkbox
                              id={`limpeza-sala-${index}`}
                              checked={Boolean(salasMarcadas[sala])}
                              disabled={salvando || carregando}
                              onCheckedChange={(marcado) =>
                                setSalasMarcadas((atuais) => ({
                                  ...atuais,
                                  [sala]: marcado === true,
                                }))
                              }
                            />
                          </label>
                          <Field className="mt-4">
                            <FieldLabel htmlFor={`ocorrencia-sala-${index}`}>
                              Ocorrência (opcional)
                            </FieldLabel>
                            <Textarea
                              id={`ocorrencia-sala-${index}`}
                              maxLength={1000}
                              placeholder="Anote algum problema ou detalhe desta sala…"
                              value={ocorrencias[sala] ?? ""}
                              disabled={salvando}
                              onChange={(event) =>
                                setOcorrencias((atuais) => ({
                                  ...atuais,
                                  [sala]: event.target.value,
                                }))
                              }
                            />
                          </Field>
                          {historico.length > 0 && (
                            <div className="mt-4 border-t pt-3">
                              <p className="mb-2 text-sm font-medium">
                                Histórico desta sala
                              </p>
                              <ul className="flex flex-col gap-2">
                                {historico.map((registro) => (
                                  <li
                                    key={registro.id}
                                    className="rounded-md bg-muted/50 p-3 text-sm"
                                  >
                                    <div className="flex flex-wrap justify-between gap-2">
                                      <span>{registro.funcionaria}</span>
                                      <time
                                        className="text-muted-foreground"
                                        dateTime={registro.registradoEm}
                                      >
                                        {new Date(
                                          registro.registradoEm,
                                        ).toLocaleTimeString("pt-BR", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </time>
                                    </div>
                                    {registro.observacao && (
                                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                        {registro.observacao}
                                      </p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="mt-5 flex justify-end">
              <Button
                type="submit"
                disabled={
                  salvando ||
                  carregando ||
                  !data ||
                  !funcionaria.trim() ||
                  !Object.values(salasMarcadas).some(Boolean)
                }
              >
                {salvando ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                {salvando ? "Salvando…" : "Salvar registros"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
