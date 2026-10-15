"use client";

import { ArrowLeft, CalendarDays, ChartNoAxesColumn } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BASES,
  dataLocal,
  horariosDoPlantao,
  plantaoFimDeSemana,
  turnoDoPlantao,
} from "@/lib/ronda";
import { cn } from "@/lib/utils";

export type RondaResumo = {
  id: string;
  data: string;
  hora: string;
  turno: string;
  responsavel: string;
  base: string;
  status: string;
};

const opcoesBase = BASES.map((base) => ({ label: base, value: base }));

function dataBR(data: string) {
  const partes = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : data;
}

export function HistoricoRondas({ rondas }: { rondas: RondaResumo[] }) {
  const [base, setBase] = useState<string>(BASES[0]);
  const [plantao, setPlantao] = useState("");
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    setPlantao(dataLocal(new Date()));
  }, []);

  const diaTodo = plantao ? plantaoFimDeSemana(plantao) : false;
  const turno = plantao ? turnoDoPlantao(plantao) : "Noite";
  // A agenda só é montada no cliente (depois do efeito), então `Date.now()`
  // aqui não gera diferença de hidratação.
  const agenda = plantao
    ? horariosDoPlantao(plantao).map(({ data, hora }) => {
        const existente = rondas.find(
          (r) =>
            r.data === data &&
            r.hora.slice(0, 2) === hora.slice(0, 2) &&
            r.base === base,
        );
        const inicio = new Date(`${data}T${hora}:00`).getTime();
        const passou = inicio + 60 * 60 * 1000 <= Date.now();
        const href = existente
          ? `/?id=${encodeURIComponent(existente.id)}`
          : `/?${new URLSearchParams({ data, hora, turno, base, plantao })}`;
        return {
          data,
          hora,
          existente,
          passou,
          href,
          estado: existente
            ? existente.status
            : passou
              ? "Não realizada"
              : "A realizar",
        };
      })
    : [];
  const rondasFiltradas = rondas.filter((r) => !filtro || r.data === filtro);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Elinsa do Brasil · Facilities
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Histórico de rondas
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
            <ArrowLeft data-icon="inline-start" /> Formulário de ronda
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ChartNoAxesColumn data-icon="inline-start" /> Dashboard
          </Link>
          <ModeToggle />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="flex items-center gap-2">
              <CalendarDays className="size-5" /> Agenda do plantão
            </h2>
          </CardTitle>
          <CardDescription>
            {diaTodo
              ? "Fim de semana: plantão de dia todo, das 07h às 07h do dia seguinte."
              : "Dia útil: plantão noturno, das 19h às 07h."}{" "}
            Selecione um horário para abrir a ronda ou iniciá-la no formulário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="base-agenda">Unidade / base</FieldLabel>
                <Select
                  items={opcoesBase}
                  value={base}
                  onValueChange={(valor) => {
                    if (valor !== null) setBase(valor);
                  }}
                >
                  <SelectTrigger id="base-agenda" className="w-full">
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
                <FieldLabel htmlFor="plantao">
                  Data de início do plantão
                </FieldLabel>
                <Input
                  id="plantao"
                  type="date"
                  value={plantao}
                  onChange={(e) => setPlantao(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
              {agenda.map((slot) => (
                <Link
                  key={`${slot.data}-${slot.hora}`}
                  href={slot.href}
                  className={cn(
                    buttonVariants({
                      variant: slot.existente
                        ? "secondary"
                        : slot.passou
                          ? "destructive"
                          : "outline",
                      size: "sm",
                    }),
                    "h-auto flex-col py-2",
                  )}
                >
                  <span>{slot.hora}</span>
                  <span className="text-xs font-normal">
                    {slot.data.slice(8)}/{slot.data.slice(5, 7)}
                  </span>
                  <span className="text-[10px] font-normal">{slot.estado}</span>
                </Link>
              ))}
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Rondas salvas</h2>
          </CardTitle>
          <CardDescription>
            As 200 rondas mais recentes registradas no banco.
          </CardDescription>
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
            {rondasFiltradas.length ? (
              <ScrollArea className="[&_[data-slot=scroll-area-viewport]]:max-h-[32rem]">
                <ItemGroup className="gap-2 pr-3">
                  {rondasFiltradas.map((r) => (
                    <Item
                      key={r.id}
                      role="listitem"
                      variant="outline"
                      size="sm"
                    >
                      <ItemContent>
                        <ItemTitle>
                          {dataBR(r.data)} · {r.hora} · {r.turno}
                        </ItemTitle>
                        <ItemDescription>
                          {r.responsavel} · {r.base}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Badge
                          variant={
                            r.status === "Finalizada" ? "default" : "secondary"
                          }
                        >
                          {r.status}
                        </Badge>
                        <Link
                          href={`/?id=${encodeURIComponent(r.id)}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                          )}
                        >
                          Abrir
                        </Link>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              </ScrollArea>
            ) : (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>Nenhuma ronda encontrada</EmptyTitle>
                  <EmptyDescription>
                    {filtro
                      ? "Não há rondas salvas nesta data."
                      : "As rondas finalizadas aparecem aqui."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
    </main>
  );
}
