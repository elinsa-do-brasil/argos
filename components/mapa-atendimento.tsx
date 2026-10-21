"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { FeatureCollection, Geometry } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Map, MapControls, MapGeoJSON, MapPopup } from "@/components/ui/map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chaveBase, intensidadeCor, totaisPorBase, type RondaMapa } from "@/lib/mapa-ocorrencias";

type Base = { id: string; nome: string; regiao: string; cor: string; municipios: number };
type Propriedades = { id: string; nome: string; base: string; baseId: string; regiao: string; cor: string; preenchimento?: string };
type Dados = FeatureCollection<Geometry, Propriedades> & { bases: Base[] };
const regioes = ["Centro", "Nordeste", "Oeste"];
function limites(dados: Dados): [[number, number], [number, number]] {
  const pontos: number[][] = [];
  function percorrer(value: unknown): void {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") pontos.push(value as number[]);
    else value.forEach(percorrer);
  }
  dados.features.forEach((f) => { if ("coordinates" in f.geometry) percorrer(f.geometry.coordinates); });
  if (!pontos.length) throw new Error("Sem coordenadas no mapa.");
  return pontos.reduce<[[number, number], [number, number]]>((b, p) => [
    [Math.min(b[0][0], p[0]), Math.min(b[0][1], p[1])],
    [Math.max(b[1][0], p[0]), Math.max(b[1][1], p[1])],
  ], [[Infinity, Infinity], [-Infinity, -Infinity]]);
}

export function MapaAtendimento({ rondas }: { rondas: RondaMapa[] }) {
  const { resolvedTheme } = useTheme();
  const escuro = resolvedTheme === "dark";
  const mapRef = useRef<MapLibreMap | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [regiao, setRegiao] = useState("");
  const [baseId, setBaseId] = useState("");
  const [municipioId, setMunicipioId] = useState("");
  const [hover, setHover] = useState<{ propriedades: Propriedades; lng: number; lat: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setErro(false);
    fetch("/mapas/elinsa-para.json", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Falha ao carregar");
        const json = await res.json() as Dados;
        if (json.type !== "FeatureCollection" || !json.features?.length || !json.bases?.length) throw new Error("Mapa inválido");
        limites(json); setDados(json);
      }).catch(() => { if (!controller.signal.aborted) setErro(true); });
    return () => controller.abort();
  }, [tentativa]);
  const totais = useMemo(() => totaisPorBase(rondas), [rondas]);
  const maximo = useMemo(() => Math.max(0, ...(dados?.bases ?? []).map((b) => totais[chaveBase(b.nome)]?.ocorrencias ?? 0)), [dados, totais]);
  const coloridos = useMemo<Dados | null>(() => dados ? ({ ...dados, features: dados.features.map((f) => ({ ...f, properties: { ...f.properties, preenchimento: intensidadeCor(f.properties.cor, totais[chaveBase(f.properties.base)]?.ocorrencias ?? 0, maximo, escuro) } })) }) : null, [dados, totais, maximo, escuro]);
  const bounds = useMemo(() => dados ? limites(dados) : undefined, [dados]);
  const basesVisiveis = dados?.bases.filter((b) => !regiao || b.regiao === regiao) ?? [];
  const municipio = dados?.features.find((f) => f.properties.id === municipioId)?.properties;
  const base = dados?.bases.find((b) => b.id === (municipio?.baseId || baseId));
  const estatistica = base ? totais[chaveBase(base.nome)] : undefined;
  function enquadrar(features: Dados["features"]) {
    if (dados && features.length) mapRef.current?.fitBounds(limites({ ...dados, features }), { padding: 35, duration: 550 });
  }
  function selecionarBase(id: string) {
    setBaseId(id); setMunicipioId(""); setHover(null);
    enquadrar(dados?.features.filter((f) => id ? f.properties.baseId === id : !regiao || f.properties.regiao === regiao) ?? []);
  }
  return <Card>
    <CardHeader>
      <CardTitle>Atendimento da Elinsa no Pará</CardTitle>
      <CardDescription>6 bases · 50 municípios · intensidade por ocorrências da base</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" aria-label="Regiões de atendimento">
        {["", ...regioes].map((r) => <button key={r} type="button" aria-pressed={regiao === r} className={`rounded-full border px-3 py-1.5 text-xs ${regiao === r ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`} onClick={() => { setRegiao(r); setBaseId(""); setMunicipioId(""); setHover(null); enquadrar(dados?.features.filter((f) => !r || f.properties.regiao === r) ?? []); }}>{r || "Todas as regiões"}</button>)}
      </div>
      <div className="relative h-[400px] overflow-hidden rounded-xl border bg-muted/30 sm:h-[480px]" aria-label="Mapa dos 50 municípios atendidos">
        {erro ? <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm"><p>Não foi possível carregar o mapa.</p><button type="button" className="underline" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button></div>
          : coloridos && bounds ? <Map ref={mapRef} blank theme={escuro ? "dark" : "light"} bounds={bounds} fitBoundsOptions={{ padding: 35 }} minZoom={2} maxZoom={13} scrollZoom={false} dragRotate={false} pitchWithRotate={false}>
            <MapGeoJSON<Propriedades> data={coloridos} promoteId="id" interactive
              fillPaint={{ "fill-color": ["get", "preenchimento"], "fill-opacity": ["case", ["all", ["!=", regiao, ""], ["!=", ["get", "regiao"], regiao]], 0.15, 1] }}
              linePaint={{ "line-color": ["case", ["any", ["boolean", ["feature-state", "hover"], false], ["==", ["get", "id"], municipioId], ["==", ["get", "baseId"], baseId]], escuro ? "#edf6fc" : "#203d37", escuro ? "#2b4660" : "#d7e7db"], "line-width": ["case", ["any", ["boolean", ["feature-state", "hover"], false], ["==", ["get", "id"], municipioId]], 2, 0.6] }}
              onHover={(e) => setHover(e ? { propriedades: e.feature.properties, lng: e.longitude, lat: e.latitude } : null)}
              onClick={(e) => { setMunicipioId(e.feature.properties.id); setBaseId(e.feature.properties.baseId); setRegiao(e.feature.properties.regiao); }} />
            <MapControls className="bottom-2" />
            {hover && <MapPopup longitude={hover.lng} latitude={hover.lat} offset={12} closeOnClick={false} className="pointer-events-none p-3">
              <p className="text-sm font-semibold">{hover.propriedades.nome}</p>
              <p className="text-xs text-muted-foreground">Base {hover.propriedades.base} · {hover.propriedades.regiao}</p>
              <p className="mt-2 text-xs font-medium">{totais[chaveBase(hover.propriedades.base)]?.ocorrencias ?? 0} ocorrência(s) na base</p>
            </MapPopup>}
          </Map> : <div role="status" className="flex h-full items-center justify-center text-sm">Carregando mapa…</div>}
      </div>
      <div className="rounded-lg border p-3 text-xs">
        <p className="font-medium">Mais ocorrências → cor mais intensa</p>
        <p className="mt-1 text-muted-foreground">Escala comum de 0 a {maximo} ocorrência(s). Cada município mostra o total da sua base, não uma contagem municipal.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Bases e legenda de cores">
        {basesVisiveis.map((b) => { const total = totais[chaveBase(b.nome)]?.ocorrencias ?? 0; return <button key={b.id} type="button" aria-pressed={baseId === b.id} onClick={() => selecionarBase(baseId === b.id ? "" : b.id)} className={`rounded-xl border p-3 text-left text-xs hover:bg-accent ${baseId === b.id ? "border-primary ring-1 ring-primary" : "border-border"}`}>
          <span className="flex items-center justify-between gap-2"><strong className="inline-flex items-center gap-2"><span className="size-3 rounded-full" style={{ backgroundColor: b.cor }} />{b.nome}</strong><strong>{total} ocorrência(s)</strong></span>
          <span className="mt-1 block text-muted-foreground">{b.regiao} · {b.municipios} municípios · {totais[chaveBase(b.nome)]?.rondas ?? 0} ronda(s)</span>
          <span className="mt-2 block h-2 rounded-full" style={{ background: `linear-gradient(to right, ${intensidadeCor(b.cor, 0, 1, escuro)}, ${b.cor})` }} />
        </button>; })}
      </div>
      {dados && <label className="flex flex-col gap-2 text-xs font-medium">Consultar município
        <select value={municipioId} className="w-full rounded-lg border bg-background p-2 text-foreground" onChange={(e) => { setMunicipioId(e.target.value); const f = dados.features.find((item) => item.properties.id === e.target.value); if (f) { setBaseId(f.properties.baseId); enquadrar([f]); } }}>
          <option value="">Selecione um município</option>
          {basesVisiveis.map((b) => <optgroup key={b.id} label={`Base ${b.nome}`}>{dados.features.filter((f) => f.properties.baseId === b.id).map((f) => <option key={f.properties.id} value={f.properties.id}>{f.properties.nome}</option>)}</optgroup>)}
        </select>
      </label>}
      {base && <p className="rounded-lg bg-muted p-3 text-xs" aria-live="polite">{municipio ? `${municipio.nome} — ` : ""}Base {base.nome}, região {base.regiao}: {estatistica?.ocorrencias ?? 0} ocorrência(s) em {estatistica?.rondas ?? 0} ronda(s), para uma área de {base.municipios} municípios.</p>}
    </CardContent>
  </Card>;
}
