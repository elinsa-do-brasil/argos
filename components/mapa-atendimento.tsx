"use client";

import type { FeatureCollection, Geometry } from "geojson";
import type { FillLayerSpecification } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MapControls,
  MapGeoJSON,
  MapPopup,
  Map as MapView,
} from "@/components/ui/map";

type Propriedades = { id: string; nome: string; regiao: string };
type Dados = FeatureCollection<Geometry, Propriedades>;
type RondaMapa = { base: string };
const regioes = ["Nordeste do Pará", "Centro do Pará", "Oeste do Pará"];
const municipios = [
  "Paragominas",
  "Abaetetuba",
  "Altamira",
  "Itaituba",
  "Monte Alegre",
  "Santarém",
];
const paleta = {
  light: ["#0284c7", "#d97706", "#059669"],
  dark: ["#38bdf8", "#fbbf24", "#34d399"],
};
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function limites(dados: Dados): [[number, number], [number, number]] {
  const pontos: number[][] = [];
  function percorrer(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number")
      pontos.push(value as number[]);
    else value.forEach(percorrer);
  }
  dados.features.forEach((f) => {
    if ("coordinates" in f.geometry) percorrer(f.geometry.coordinates);
  });
  if (!pontos.length) throw new Error("Sem coordenadas no mapa.");
  return pontos.reduce<[[number, number], [number, number]]>(
    (b, p) => [
      [Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])],
      [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])],
    ],
    [
      [Infinity, Infinity],
      [-Infinity, -Infinity],
    ],
  );
}

export function MapaAtendimento({ rondas }: { rondas: RondaMapa[] }) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const cores = paleta[theme];
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [selecionado, setSelecionado] = useState("");
  const [hover, setHover] = useState<{
    nome: string;
    regiao: string;
    lng: number;
    lat: number;
  } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry requests intentionally rerun when tentativa changes.
  useEffect(() => {
    const controller = new AbortController();
    setErro(false);
    fetch("/mapas/elinsa-para.json", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Falha no carregamento");
        const json = (await res.json()) as Dados;
        if (json.type !== "FeatureCollection" || json.features.length !== 6)
          throw new Error("Mapa inválido");
        limites(json);
        setDados(json);
      })
      .catch(() => {
        if (!controller.signal.aborted) setErro(true);
      });
    return () => controller.abort();
  }, [tentativa]);
  const bounds = useMemo(() => (dados ? limites(dados) : undefined), [dados]);
  const totais = useMemo(
    () =>
      rondas.reduce<Record<string, number>>((acc, r) => {
        const chave = normalizar(r.base);
        acc[chave] = (acc[chave] ?? 0) + 1;
        return acc;
      }, {}),
    [rondas],
  );
  const fillPaint = useMemo<FillLayerSpecification["paint"]>(
    () => ({
      "fill-color": [
        "case",
        [
          "any",
          ["boolean", ["feature-state", "hover"], false],
          ["==", ["get", "nome"], selecionado],
        ],
        theme === "dark" ? "#e2e8f0" : "#334155",
        [
          "match",
          ["get", "regiao"],
          regioes[0],
          cores[0],
          regioes[1],
          cores[1],
          regioes[2],
          cores[2],
          "#94a3b8",
        ],
      ],
      "fill-opacity": 0.88,
    }),
    [theme, cores, selecionado],
  );
  const escolha = dados?.features.find(
    (f) => f.properties.nome === selecionado,
  )?.properties;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Locais atendidos pela Elinsa</CardTitle>
        <CardDescription>
          6 municípios · 3 regiões de atendimento no Pará
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <section
          className="relative h-[360px] overflow-hidden rounded-xl border bg-muted/30 sm:h-[420px]"
          aria-label="Mapa dos municípios atendidos"
        >
          {erro ? (
            <div
              role="alert"
              className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm"
            >
              <p>Não foi possível carregar o mapa dos municípios.</p>
              <button
                type="button"
                className="underline"
                onClick={() => setTentativa((n) => n + 1)}
              >
                Tentar novamente
              </button>
            </div>
          ) : dados && bounds ? (
            <MapView
              blank
              theme={theme}
              bounds={bounds}
              fitBoundsOptions={{ padding: 35 }}
              minZoom={2}
              maxZoom={12}
              scrollZoom={false}
              dragRotate={false}
              pitchWithRotate={false}
            >
              <MapGeoJSON<Propriedades>
                data={dados}
                promoteId="id"
                fillPaint={fillPaint}
                linePaint={{
                  "line-color": theme === "dark" ? "#0f172a" : "#ffffff",
                  "line-width": 1.2,
                }}
                interactive
                onHover={(e) =>
                  setHover(
                    e
                      ? {
                          ...e.feature.properties,
                          lng: e.longitude,
                          lat: e.latitude,
                        }
                      : null,
                  )
                }
                onClick={(e) => setSelecionado(e.feature.properties.nome)}
              />
              <MapControls className="bottom-2" />
              {hover && (
                <MapPopup
                  longitude={hover.lng}
                  latitude={hover.lat}
                  offset={12}
                  closeOnClick={false}
                  className="pointer-events-none p-3"
                >
                  <p className="text-sm font-semibold">{hover.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {hover.regiao}
                  </p>
                  <p className="mt-2 text-xs">
                    {totais[normalizar(hover.nome)] ?? 0} ronda(s) registrada(s)
                  </p>
                </MapPopup>
              )}
            </MapView>
          ) : (
            <output className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Carregando mapa…
            </output>
          )}
        </section>
        <section
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs"
          aria-label="Legenda"
        >
          {regioes.map((regiao, i) => (
            <span key={regiao} className="inline-flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: cores[i] }}
              />
              {regiao}
            </span>
          ))}
        </section>
        <section
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          aria-label="Selecionar município"
        >
          {municipios.map((nome) => (
            <button
              key={nome}
              type="button"
              aria-pressed={selecionado === nome}
              onClick={() => setSelecionado(selecionado === nome ? "" : nome)}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 ${selecionado === nome ? "border-primary bg-accent" : "border-border"}`}
            >
              <strong className="block">{nome}</strong>
              <span className="text-muted-foreground">
                {totais[normalizar(nome)] ?? 0} ronda(s)
              </span>
            </button>
          ))}
        </section>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {escolha
            ? `${escolha.nome} · ${escolha.regiao} · ${totais[normalizar(escolha.nome)] ?? 0} ronda(s) registrada(s).`
            : "Passe o mouse ou selecione um município para consultar os registros."}
        </p>
      </CardContent>
    </Card>
  );
}
