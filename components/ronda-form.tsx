"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Camera,
  ChartNoAxesColumn,
  Check,
  CheckCheck,
  History,
  Lock,
  PencilLine,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { ModeToggle } from "@/components/mode-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import {
  type FotoOcorrencia,
  MAX_BYTES_FOTO,
  MAX_CARACTERES_FOTOS_RONDA,
  MAX_FOTOS_AMBIENTE,
  urlFoto,
} from "@/lib/foto";
import { lerPreferencias, salvarPreferencias } from "@/lib/preferencias";
import {
  apagarRascunho,
  lerRascunho,
  type Rascunho,
  salvarRascunho,
} from "@/lib/rascunho";
import {
  BASES,
  dataLocal,
  MENSAGEM_PRAZO_ENCERRADO,
  novaRonda,
  PRAZO_EDICAO_MINUTOS,
  PRAZO_EDICAO_MS,
  type RondaInput,
  rondaSchema,
} from "@/lib/ronda";
import { cn } from "@/lib/utils";

type Opcao = { label: string; value: string };

type Confirmacao = {
  titulo: string;
  descricao: string;
  confirmar: string;
  acao: () => void;
};

const turnos: Opcao[] = rondaSchema.shape.turno.options.map((turno) => ({
  label: turno,
  value: turno,
}));

const prioridades: Opcao[] = [
  { label: "Informação", value: "Informação" },
  { label: "Pouco urgente", value: "Pouco urgente" },
  { label: "Urgente", value: "Urgente" },
];

function avisar(titulo: string, type: "success" | "error" | "info" = "info") {
  toast.add({ title: titulo, type });
}

const vazio: RondaInput = {
  id: "00000000-0000-4000-8000-000000000000",
  data: "",
  turno: "Manhã",
  hora: "",
  responsavel: "",
  base: BASES[0],
  status: "Em andamento",
  plantaoData: "",
  observacoesGerais: "",
  gpsLatitude: null,
  gpsLongitude: null,
  gpsPrecisao: null,
  gpsCapturadoEm: null,
  ambientes: [],
};

function dataBR(data: string) {
  const partes = data.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : data;
}

function horaDe(instante: number) {
  return new Date(instante).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function buscarRondaSalva(id: string) {
  const response = await fetch(`/api/rondas/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error();
  const json = await response.json();
  const ronda = rondaSchema.safeParse(json);
  return {
    dados: (ronda.success ? ronda.data : json) as RondaInput,
    criadoEm: typeof json.criadoEm === "string" ? json.criadoEm : null,
  };
}

// Parâmetros enviados pela agenda do plantão (tela de histórico) para iniciar
// uma ronda já com data, horário, turno, base e plantão preenchidos.
function lerPrefill(params: URLSearchParams): Partial<RondaInput> | null {
  const campos = rondaSchema.shape;
  const prefill: Partial<RondaInput> = {};
  const data = campos.data.safeParse(params.get("data"));
  if (data.success) prefill.data = data.data;
  const hora = campos.hora.safeParse(params.get("hora"));
  if (hora.success) prefill.hora = hora.data;
  const turno = campos.turno.safeParse(params.get("turno"));
  if (turno.success) prefill.turno = turno.data;
  const base = campos.base.safeParse(params.get("base"));
  if (base.success) prefill.base = base.data;
  const plantao = campos.data.safeParse(params.get("plantao"));
  if (plantao.success) prefill.plantaoData = plantao.data;
  return Object.keys(prefill).length ? prefill : null;
}

function SelecaoCampo({
  id,
  opcoes,
  value,
  onValueChange,
  onBlur,
  disabled,
}: {
  id: string;
  opcoes: Opcao[];
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  return (
    <Select
      items={opcoes}
      value={value}
      disabled={disabled}
      onValueChange={(novo) => {
        if (novo !== null) onValueChange(novo);
      }}
    >
      <SelectTrigger id={id} className="w-full" onBlur={onBlur}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {opcoes.map((opcao) => (
            <SelectItem key={opcao.value} value={opcao.value}>
              {opcao.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CampoAdicionar({
  id,
  rotulo,
  rotuloVisivel,
  placeholder,
  maxLength,
  erro,
  onAdicionar,
  onFechar,
}: {
  id: string;
  rotulo: string;
  rotuloVisivel?: boolean;
  placeholder: string;
  maxLength: number;
  erro: string;
  onAdicionar: (valor: string) => boolean;
  onFechar?: () => void;
}) {
  const [valor, setValor] = useState("");

  function adicionar() {
    if (onAdicionar(valor)) setValor("");
  }

  return (
    <Field data-invalid={!!erro}>
      <FieldLabel htmlFor={id} className={cn(!rotuloVisivel && "sr-only")}>
        {rotulo}
      </FieldLabel>
      <div className="flex gap-2">
        <Input
          id={id}
          value={valor}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          aria-invalid={!!erro}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
            if (e.key === "Escape" && onFechar) {
              e.preventDefault();
              onFechar();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={adicionar}>
          <Plus data-icon="inline-start" /> Adicionar
        </Button>
        {onFechar && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Fechar"
            onClick={onFechar}
          >
            <X />
          </Button>
        )}
      </div>
      {erro && <FieldError>{erro}</FieldError>}
    </Field>
  );
}

// As fotos são campos controlados da ronda, validados e enviados à API.
function FotosOcorrencia({
  nome,
  somenteLeitura,
  fotos,
  onChange,
  onBusyChange,
}: {
  nome: string;
  somenteLeitura: boolean;
  fotos: FotoOcorrencia[];
  onChange: (fotos: FotoOcorrencia[]) => void;
  onBusyChange: (delta: number) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const montado = useRef(true);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [pronta, setPronta] = useState(false);
  const [erro, setErro] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const capturaNativa = useRef<HTMLInputElement>(null);
  const fluxo = useRef<MediaStream | null>(null);
  const limite = MAX_FOTOS_AMBIENTE;

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      fluxo.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  useEffect(() => {
    if (!cameraAberta || somenteLeitura) return;
    let cancelada = false;
    let stream: MediaStream | null = null;
    setPronta(false);
    async function abrir() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Câmera indisponível. Use a opção de câmera do celular abaixo.",
          );
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelada) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          return;
        }
        fluxo.current = stream;
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
          if (!cancelada) setPronta(true);
        }
      } catch {
        stream?.getTracks().forEach((track) => {
          track.stop();
        });
        if (!cancelada) {
          setErro(
            "Não foi possível acessar a câmera. Confira a permissão do navegador ou use Câmera do celular / Escolher fotos.",
          );
          setCameraAberta(false);
        }
      }
    }
    void abrir();
    return () => {
      cancelada = true;
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      fluxo.current = null;
    };
  }, [cameraAberta, somenteLeitura]);

  function comprimir(canvas: HTMLCanvasElement): string {
    for (let tentativa = 0; tentativa < 7; tentativa++) {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      if (Math.ceil(((dataUrl.length - 23) * 3) / 4) <= MAX_BYTES_FOTO)
        return dataUrl;
      const menor = document.createElement("canvas");
      menor.width = Math.max(1, Math.round(canvas.width * 0.75));
      menor.height = Math.max(1, Math.round(canvas.height * 0.75));
      menor
        .getContext("2d")
        ?.drawImage(canvas, 0, 0, menor.width, menor.height);
      canvas = menor;
    }
    throw new Error(
      "Não foi possível reduzir esta foto. Escolha outra imagem.",
    );
  }

  async function escolher(files: FileList | null) {
    if (!files || somenteLeitura || ocupado) return;
    const selecionadas = Array.from(files);
    const novas: FotoOcorrencia[] = [];
    setOcupado(true);
    onBusyChange(1);
    setErro("");
    try {
      for (const file of selecionadas) {
        if (fotos.length + novas.length >= limite) {
          setErro("Limite de 5 fotos por ocorrência.");
          break;
        }
        if (
          !/^image\/(jpeg|png|webp)$/i.test(file.type) ||
          file.size > 10 * 1024 * 1024
        ) {
          setErro("Escolha fotos JPG, PNG ou WebP de até 10 MB cada.");
          continue;
        }
        const url = URL.createObjectURL(file);
        try {
          const img = new window.Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Foto não reconhecida."));
            img.src = url;
          });
          if (!montado.current) return;
          const escala = Math.min(
            1,
            1280 / Math.max(img.naturalWidth, img.naturalHeight),
          );
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Não foi possível processar a foto.");
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          novas.push({
            id: crypto.randomUUID(),
            nome: `${file.name.slice(0, 170).replace(/\.[^.]+$/, "")}.jpg`,
            dataUrl: comprimir(canvas),
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      if (montado.current)
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível processar a foto.",
        );
    } finally {
      if (montado.current) {
        if (novas.length) onChange([...fotos, ...novas]);
        setOcupado(false);
      }
      onBusyChange(-1);
    }
  }

  function fotografar() {
    const elemento = video.current;
    if (!elemento || !pronta || fotos.length >= limite || somenteLeitura)
      return;
    if (!elemento.videoWidth || !elemento.videoHeight) return;
    const canvas = document.createElement("canvas");
    const escala = Math.min(
      1,
      1600 / Math.max(elemento.videoWidth, elemento.videoHeight),
    );
    canvas.width = Math.round(elemento.videoWidth * escala);
    canvas.height = Math.round(elemento.videoHeight * escala);
    const contexto = canvas.getContext("2d");
    if (!contexto) {
      setErro("Não foi possível capturar a foto.");
      return;
    }
    contexto.drawImage(elemento, 0, 0, canvas.width, canvas.height);
    try {
      onChange([
        ...fotos,
        {
          id: crypto.randomUUID(),
          nome: `ocorrencia-${Date.now()}.jpg`,
          dataUrl: comprimir(canvas),
        },
      ]);
      setCameraAberta(false);
    } catch {
      setErro("Não foi possível processar a foto. Tente novamente.");
    }
  }

  function remover(id: string) {
    onChange(fotos.filter((item) => item.id !== id));
  }

  if (somenteLeitura && !fotos.length) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <p className="text-sm font-medium">
        Fotos da ocorrência · {fotos.length}/{limite}
      </p>
      <p className="text-xs text-muted-foreground">
        Até 5 fotos por ocorrência. As imagens são reduzidas e enviadas ao
        armazenamento ao finalizar.
      </p>
      {!somenteLeitura && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fotos.length >= limite || cameraAberta || ocupado}
            onClick={() => {
              setErro("");
              setCameraAberta(true);
            }}
          >
            <Camera data-icon="inline-start" /> Tirar foto
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fotos.length >= limite || cameraAberta || ocupado}
            onClick={() => arquivo.current?.click()}
          >
            Escolher fotos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={fotos.length >= limite || cameraAberta || ocupado}
            onClick={() => capturaNativa.current?.click()}
          >
            Câmera do celular
          </Button>
        </div>
      )}
      {ocupado && <output className="text-sm">Preparando fotos…</output>}
      <input
        ref={arquivo}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        aria-label={`Escolher fotos da ocorrência em ${nome}`}
        onChange={(event) => {
          void escolher(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={capturaNativa}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        aria-label={`Usar câmera do celular em ${nome}`}
        onChange={(event) => {
          void escolher(event.target.files);
          event.target.value = "";
        }}
      />
      {cameraAberta && (
        <div className="flex flex-col gap-2">
          <video
            ref={video}
            autoPlay
            playsInline
            muted
            aria-label={`Prévia da câmera para ${nome}`}
            className="max-h-80 w-full rounded-lg bg-black object-contain"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!pronta}
              onClick={fotografar}
            >
              {pronta ? "Capturar foto" : "Abrindo câmera…"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCameraAberta(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {fotos.map((foto, index) => (
          <figure key={foto.id} className="min-w-0 rounded-lg border p-2">
            <div className="relative h-32 w-full">
              <Image
                src={urlFoto(foto)}
                alt={`Foto ${index + 1} da ocorrência em ${nome}`}
                fill
                sizes="(max-width: 640px) 50vw, 320px"
                unoptimized
                className="rounded-md object-contain"
              />
            </div>
            <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <a
                href={urlFoto(foto)}
                download={foto.nome}
                className="underline"
              >
                Baixar foto {index + 1}
              </a>
              {!somenteLeitura && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={ocupado}
                  aria-label={`Remover foto ${index + 1}`}
                  onClick={() => remover(foto.id)}
                >
                  <X className="size-4" /> Remover
                </Button>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function AmbienteFields({
  index,
  control,
  register,
  setValue,
  errors,
  somenteLeitura,
  onPhotosBusyChange,
}: {
  index: number;
  control: Control<RondaInput>;
  register: UseFormRegister<RondaInput>;
  setValue: UseFormSetValue<RondaInput>;
  errors: FieldErrors<RondaInput>;
  somenteLeitura: boolean;
  onPhotosBusyChange: (delta: number) => void;
}) {
  const {
    fields: tarefas,
    append,
    remove,
  } = useFieldArray({
    control,
    name: `ambientes.${index}.tarefas`,
    keyName: "_key",
  });
  const ambiente = useWatch({ control, name: `ambientes.${index}` });
  const [adicionando, setAdicionando] = useState(false);
  const [novaTarefaAberta, setNovaTarefaAberta] = useState(false);
  const [erroTarefa, setErroTarefa] = useState("");
  // Só as tarefas criadas nesta sessão podem ser removidas; o checklist padrão fica.
  const [adicionadas, setAdicionadas] = useState<string[]>([]);
  const nome = ambiente?.nome ?? "Ambiente";
  const concluidas = ambiente?.tarefas.filter((t) => t.concluida).length ?? 0;
  const todasConcluidas = tarefas.length > 0 && concluidas === tarefas.length;
  const temOcorrencia =
    !!ambiente?.fotos?.length ||
    !!ambiente?.observacao?.trim() ||
    (ambiente?.prioridade ?? "Informação") !== "Informação";
  const mostrarOcorrencia = adicionando || temOcorrencia;

  function adicionarOcorrencia() {
    flushSync(() => setAdicionando(true));
    document.getElementById(`observacao-${index}`)?.focus();
  }

  function removerOcorrencia() {
    if (
      ambiente?.fotos?.length &&
      !window.confirm("Remover esta ocorrência e suas fotos?")
    )
      return;
    flushSync(() => {
      setValue(`ambientes.${index}.prioridade`, "Informação", {
        shouldDirty: true,
      });
      setValue(`ambientes.${index}.observacao`, "", { shouldDirty: true });
      setValue(`ambientes.${index}.fotos`, [], { shouldDirty: true });
      setAdicionando(false);
    });
    document.getElementById(`adicionar-ocorrencia-${index}`)?.focus();
  }

  function abrirNovaTarefa() {
    flushSync(() => setNovaTarefaAberta(true));
    document.getElementById(`nova-tarefa-${index}`)?.focus();
  }

  function fecharNovaTarefa() {
    flushSync(() => {
      setNovaTarefaAberta(false);
      setErroTarefa("");
    });
    document.getElementById(`abrir-nova-tarefa-${index}`)?.focus();
  }

  function marcarTodas() {
    for (let j = 0; j < tarefas.length; j++)
      setValue(`ambientes.${index}.tarefas.${j}.concluida`, !todasConcluidas, {
        shouldDirty: true,
      });
  }

  function adicionarTarefa(valor: string) {
    const texto = valor.trim();
    if (!texto) {
      setErroTarefa("Informe a tarefa.");
      return false;
    }
    const id = crypto.randomUUID();
    append({ id, texto, concluida: false });
    setAdicionadas((atuais) => [...atuais, id]);
    setErroTarefa("");
    return true;
  }

  function removerTarefa(j: number, id: string) {
    remove(j);
    setAdicionadas((atuais) => atuais.filter((item) => item !== id));
  }

  return (
    <Card id={`ambiente-${index}`} className="scroll-mt-4">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <h2>{nome}</h2>
          <span className="flex items-center gap-1.5">
            {temOcorrencia && <Badge variant="destructive">Ocorrência</Badge>}
            <Badge variant="secondary">
              {concluidas}/{tarefas.length}
            </Badge>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-5">
          <FieldSet>
            <FieldLegend className="sr-only">Checklist de {nome}</FieldLegend>
            <FieldGroup className="gap-3">
              {tarefas.length ? (
                tarefas.map((t, j) => {
                  const texto = ambiente?.tarefas[j]?.texto ?? t.texto;
                  return (
                    <Controller
                      key={t._key}
                      control={control}
                      name={`ambientes.${index}.tarefas.${j}.concluida`}
                      render={({ field }) => (
                        <Field orientation="horizontal">
                          <Checkbox
                            id={`tarefa-${index}-${j}`}
                            name={field.name}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={somenteLeitura}
                          />
                          <FieldLabel
                            htmlFor={`tarefa-${index}-${j}`}
                            className="font-normal"
                          >
                            {texto}
                          </FieldLabel>
                          {!somenteLeitura && adicionadas.includes(t.id) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="ml-auto"
                              aria-label={`Remover tarefa ${texto}`}
                              onClick={() => removerTarefa(j, t.id)}
                            >
                              <X />
                            </Button>
                          )}
                        </Field>
                      )}
                    />
                  );
                })
              ) : (
                <FieldDescription>Nenhuma tarefa cadastrada.</FieldDescription>
              )}
            </FieldGroup>
          </FieldSet>
          {!somenteLeitura && novaTarefaAberta && (
            <CampoAdicionar
              id={`nova-tarefa-${index}`}
              rotulo={`Nova tarefa em ${nome}`}
              placeholder="Descreva a tarefa…"
              maxLength={300}
              erro={erroTarefa}
              onAdicionar={adicionarTarefa}
              onFechar={fecharNovaTarefa}
            />
          )}
          {!somenteLeitura && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!tarefas.length}
                onClick={marcarTodas}
              >
                <CheckCheck data-icon="inline-start" />
                {todasConcluidas ? "Desmarcar tudo" : "Marcar tudo"}
              </Button>
              {!novaTarefaAberta && (
                <Button
                  id={`abrir-nova-tarefa-${index}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Adicionar tarefa em ${nome}`}
                  onClick={abrirNovaTarefa}
                >
                  <Plus data-icon="inline-start" /> Tarefa
                </Button>
              )}
              {!mostrarOcorrencia && (
                <Button
                  id={`adicionar-ocorrencia-${index}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Adicionar ocorrência em ${nome}`}
                  onClick={adicionarOcorrencia}
                >
                  <TriangleAlert data-icon="inline-start" /> Ocorrência
                </Button>
              )}
            </div>
          )}
          {mostrarOcorrencia && (
            <FieldSet>
              <FieldLegend variant="label">Ocorrência</FieldLegend>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor={`prioridade-${index}`}>
                    Prioridade
                  </FieldLabel>
                  <Controller
                    control={control}
                    name={`ambientes.${index}.prioridade`}
                    render={({ field }) => (
                      <SelecaoCampo
                        id={`prioridade-${index}`}
                        opcoes={prioridades}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={somenteLeitura}
                      />
                    )}
                  />
                </Field>
                <Field data-invalid={!!errors.ambientes?.[index]?.observacao}>
                  <FieldLabel htmlFor={`observacao-${index}`}>
                    Descrição
                  </FieldLabel>
                  <Textarea
                    id={`observacao-${index}`}
                    placeholder="Descreva o que foi encontrado ou precisa ser feito."
                    aria-invalid={!!errors.ambientes?.[index]?.observacao}
                    {...register(`ambientes.${index}.observacao`)}
                  />
                  <FieldError
                    errors={[errors.ambientes?.[index]?.observacao]}
                  />
                </Field>
                <FotosOcorrencia
                  nome={nome}
                  somenteLeitura={somenteLeitura}
                  fotos={ambiente?.fotos ?? []}
                  onBusyChange={onPhotosBusyChange}
                  onChange={(fotos) =>
                    setValue(`ambientes.${index}.fotos`, fotos, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                {!somenteLeitura && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={removerOcorrencia}
                  >
                    <X data-icon="inline-start" /> Remover ocorrência
                  </Button>
                )}
              </FieldGroup>
            </FieldSet>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

export function RondaForm() {
  const [photosBusy, setPhotosBusy] = useState(0);
  const onPhotosBusyChange = useCallback(
    (delta: number) => setPhotosBusy((n) => Math.max(0, n + delta)),
    [],
  );
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
  const iniciado = useRef(false);
  const [persistido, setPersistido] = useState<string | null>(null);
  const [criadoEm, setCriadoEm] = useState<string | null>(null);
  const [prazoEncerrado, setPrazoEncerrado] = useState(false);
  const [agora, setAgora] = useState(0);
  const [rascunhoGuardado, setRascunhoGuardado] = useState(false);
  const [erroAmbiente, setErroAmbiente] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);

  const prazoFinal =
    persistido && criadoEm
      ? new Date(criadoEm).getTime() + PRAZO_EDICAO_MS
      : null;
  const somenteLeitura =
    persistido !== null &&
    (prazoEncerrado || (prazoFinal !== null && agora >= prazoFinal));

  function pedirConfirmacao(pedido: Confirmacao) {
    setConfirmacao(pedido);
    setConfirmacaoAberta(true);
  }

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const instante = new Date();
    const preferencias = lerPreferencias();
    const nova: RondaInput = {
      ...novaRonda(dataLocal(instante), instante.toTimeString().slice(0, 5)),
      ...(preferencias.responsavel
        ? { responsavel: preferencias.responsavel }
        : {}),
      ...(preferencias.base &&
      (BASES as readonly string[]).includes(preferencias.base)
        ? { base: preferencias.base }
        : {}),
    };
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const alvoId = id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
    const prefill = alvoId ? null : lerPrefill(params);
    const rascunho = lerRascunho();

    function restaurar(r: Rascunho) {
      reset(nova);
      reset(r.dados, { keepDefaultValues: true });
      setPersistido(r.persistido);
      setCriadoEm(null);
      setPrazoEncerrado(false);
      setRascunhoGuardado(true);
      window.history.replaceState(
        null,
        "",
        r.persistido ? `/?id=${encodeURIComponent(r.persistido)}` : "/",
      );
    }

    async function abrirAlvo() {
      reset(prefill ? { ...nova, ...prefill } : nova);
      setPersistido(null);
      setCriadoEm(null);
      setPrazoEncerrado(false);
      window.history.replaceState(
        null,
        "",
        alvoId ? `/?id=${encodeURIComponent(alvoId)}` : "/",
      );
      if (!alvoId) return;
      try {
        const salva = await buscarRondaSalva(alvoId);
        reset(salva.dados);
        setPersistido(alvoId);
        setCriadoEm(salva.criadoEm);
      } catch {
        avisar("Não foi possível abrir a ronda selecionada.", "error");
      }
    }

    // Um rascunho de ronda já salva só vale enquanto o prazo de edição durar.
    async function conferirPrazo(idSalvo: string) {
      try {
        const salva = await buscarRondaSalva(idSalvo);
        setCriadoEm(salva.criadoEm);
        if (
          salva.criadoEm &&
          Date.now() >= new Date(salva.criadoEm).getTime() + PRAZO_EDICAO_MS
        ) {
          apagarRascunho();
          setRascunhoGuardado(false);
          reset(salva.dados);
          avisar(
            "O prazo de edição desta ronda terminou; as alterações não salvas foram descartadas.",
            "error",
          );
        }
      } catch {
        // Sem conexão: mantém o rascunho; o servidor recusa se o prazo acabou.
      }
    }

    if (!rascunho) {
      void abrirAlvo();
      return;
    }
    restaurar(rascunho);
    if (rascunho.persistido) void conferirPrazo(rascunho.persistido);
    const mesmoAlvo = alvoId ? rascunho.persistido === alvoId : !prefill;
    if (mesmoAlvo) {
      // Adiado: o Toaster do layout só passa a ouvir depois deste efeito.
      window.setTimeout(() =>
        avisar("Preenchimento não finalizado restaurado deste aparelho."),
      );
      return;
    }
    setConfirmacao({
      titulo: "Há uma ronda não finalizada",
      descricao: `A ronda de ${dataBR(rascunho.dados.data)} às ${rascunho.dados.hora} ainda não foi finalizada neste aparelho. Descartá-la e abrir ${alvoId ? "a ronda selecionada" : "a nova ronda"}?`,
      confirmar: "Descartar e abrir",
      acao: () => {
        apagarRascunho();
        setRascunhoGuardado(false);
        void abrirAlvo();
      },
    });
    setConfirmacaoAberta(true);
  }, [reset]);

  // Vira somente leitura quando o prazo de edição acaba com a ronda aberta.
  useEffect(() => {
    if (prazoFinal === null) return;
    const restante = prazoFinal - Date.now();
    if (restante <= 0) {
      setAgora(Date.now());
      return;
    }
    const timer = window.setTimeout(() => setAgora(Date.now()), restante + 250);
    return () => window.clearTimeout(timer);
  }, [prazoFinal]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `atual` muda a cada alteração do formulário e é o gatilho para guardar o rascunho.
  useEffect(() => {
    if (!isDirty || somenteLeitura) return;
    const guardar = () =>
      setRascunhoGuardado(salvarRascunho(persistido, getValues()));
    const timer = window.setTimeout(guardar, 400);
    const aoOcultar = () => {
      if (document.visibilityState === "hidden") guardar();
    };
    document.addEventListener("visibilitychange", aoOcultar);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoOcultar);
    };
  }, [atual, isDirty, somenteLeitura, persistido, getValues]);

  function iniciarNova() {
    const d = new Date();
    const anterior = getValues();
    reset(
      novaRonda(
        dataLocal(d),
        d.toTimeString().slice(0, 5),
        anterior.ambientes.length ? anterior : undefined,
      ),
    );
    setPersistido(null);
    setCriadoEm(null);
    setPrazoEncerrado(false);
    window.history.replaceState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function concluirFinalizacao(dados: RondaInput) {
    const editando = persistido;
    setFinalizando(true);
    try {
      const response = await fetch(
        editando ? `/api/rondas/${editando}` : "/api/rondas",
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...dados, status: "Finalizada" }),
        },
      );
      if (response.status === 409 && editando) {
        apagarRascunho();
        setRascunhoGuardado(false);
        setPrazoEncerrado(true);
        avisar(MENSAGEM_PRAZO_ENCERRADO, "error");
        const salva = await buscarRondaSalva(editando);
        reset(salva.dados);
        return;
      }
      if (!response.ok) {
        const resultado = await response.json().catch(() => null);
        throw new Error(
          typeof resultado?.error === "string"
            ? resultado.error
            : "Não foi possível salvar a ronda.",
        );
      }
      salvarPreferencias({ responsavel: dados.responsavel, base: dados.base });
      apagarRascunho();
      setRascunhoGuardado(false);
      iniciarNova();
      avisar(
        editando
          ? "Alterações salvas no banco."
          : "Ronda finalizada e salva no banco.",
        "success",
      );
    } catch (erro) {
      avisar(
        `${erro instanceof Error ? erro.message : "Não foi possível salvar."} O preenchimento continua guardado neste aparelho; tente novamente.`,
        "error",
      );
    } finally {
      setFinalizando(false);
    }
  }

  const finalizar = handleSubmit(async (dados) => {
    const pendentes = dados.ambientes.reduce(
      (n, a) => n + a.tarefas.filter((t) => !t.concluida).length,
      0,
    );
    if (pendentes) {
      pedirConfirmacao({
        titulo: "Finalizar com itens pendentes?",
        descricao: `Há ${pendentes} ${pendentes === 1 ? "item não verificado" : "itens não verificados"}. Finalizar a ronda assim mesmo?`,
        confirmar: persistido ? "Salvar alterações" : "Finalizar ronda",
        acao: () => void concluirFinalizacao(dados),
      });
      return;
    }
    await concluirFinalizacao(dados);
  });

  function criar() {
    const iniciar = () => {
      apagarRascunho();
      setRascunhoGuardado(false);
      iniciarNova();
      avisar("Nova ronda pronta para preenchimento.");
    };
    if (!isDirty) {
      iniciar();
      return;
    }
    pedirConfirmacao({
      titulo: "Descartar alterações?",
      descricao:
        "O que foi preenchido nesta ronda será perdido ao iniciar uma nova.",
      confirmar: "Descartar e iniciar",
      acao: iniciar,
    });
  }

  function adicionarAmbiente(valor: string) {
    const nome = valor.trim();
    if (!nome) {
      setErroAmbiente("Informe o nome do ambiente.");
      return false;
    }
    if (
      getValues("ambientes").some(
        (a) => a.nome.toLocaleLowerCase() === nome.toLocaleLowerCase(),
      )
    ) {
      setErroAmbiente("Esse ambiente já existe.");
      return false;
    }
    const indice = ambientes.length;
    appendAmbiente({
      id: crypto.randomUUID(),
      nome,
      observacao: "",
      prioridade: "Informação",
      localizacao: "",
      tarefas: [],
    });
    setErroAmbiente("");
    requestAnimationFrame(() =>
      document
        .getElementById(`ambiente-${indice}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return true;
  }

  const camposObrigatorios = [
    atual.data,
    atual.hora,
    atual.responsavel?.trim(),
    atual.base?.trim(),
  ];
  const tarefas = atual.ambientes?.flatMap((a) => a?.tarefas ?? []) ?? [];
  const itensPreenchidos =
    camposObrigatorios.filter(Boolean).length +
    tarefas.filter((t) => t?.concluida).length;
  const totalItens = camposObrigatorios.length + tarefas.length;
  const progresso = Math.round((itensPreenchidos / totalItens) * 100);
  const opcoesBase: Opcao[] = [...new Set([...BASES, atual.base ?? ""])]
    .filter(Boolean)
    .map((base) => ({ label: base, value: base }));
  const estadoAmbientes = ambientes.map((a, i) => {
    const amb = atual.ambientes?.[i];
    const lista = amb?.tarefas ?? [];
    return {
      chave: a._key,
      nome: amb?.nome ?? a.nome,
      concluido: lista.length > 0 && lista.every((t) => t?.concluida),
      ocorrencia:
        !!amb?.fotos?.length ||
        !!amb?.observacao?.trim() ||
        (amb?.prioridade ?? "Informação") !== "Informação",
    };
  });
  const resumoRonda = `Ronda de ${dataBR(atual.data ?? "")} às ${atual.hora} · ${atual.responsavel || "sem responsável"}.`;

  return (
    <>
      <Progress
        value={progresso}
        aria-label="Preenchimento da ronda"
        className="sticky top-0 z-10 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:rounded-none"
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
              Elinsa do Brasil · Facilities
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Ronda de Facilities
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/historico"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <History data-icon="inline-start" /> Histórico
            </Link>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <ChartNoAxesColumn data-icon="inline-start" /> Dashboard
            </Link>
            <Button type="button" variant="outline" onClick={() => criar()}>
              <Plus data-icon="inline-start" /> Nova ronda
            </Button>
            <ModeToggle />
          </div>
        </header>

        {persistido &&
          (somenteLeitura ? (
            <Alert>
              <Lock />
              <AlertTitle>Ronda finalizada · somente leitura</AlertTitle>
              <AlertDescription>
                {resumoRonda} O prazo de {PRAZO_EDICAO_MINUTOS} minutos para
                alterações terminou.
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => criar()}
                  >
                    Nova ronda
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <PencilLine />
              <AlertTitle>Editando uma ronda salva</AlertTitle>
              <AlertDescription>
                {resumoRonda}{" "}
                {prazoFinal
                  ? `Você pode alterá-la até ${horaDe(prazoFinal)}; depois ela fica somente para leitura.`
                  : `Ela pode ser alterada por até ${PRAZO_EDICAO_MINUTOS} minutos depois de salva.`}
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => criar()}
                  >
                    Sair da edição
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ))}

        <form onSubmit={(e) => e.preventDefault()}>
          <fieldset
            disabled={somenteLeitura}
            className="flex min-w-0 flex-col gap-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Identificação da ronda</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field data-invalid={!!errors.responsavel}>
                    <FieldLabel htmlFor="responsavel">Responsável</FieldLabel>
                    <Input
                      id="responsavel"
                      placeholder="Nome do responsável"
                      autoComplete="name"
                      aria-invalid={!!errors.responsavel}
                      {...register("responsavel")}
                    />
                    <FieldError errors={[errors.responsavel]} />
                  </Field>
                  <Field data-invalid={!!errors.base}>
                    <FieldLabel htmlFor="base">Unidade / base</FieldLabel>
                    <Controller
                      control={control}
                      name="base"
                      render={({ field }) => (
                        <SelecaoCampo
                          id="base"
                          opcoes={opcoesBase}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={somenteLeitura}
                        />
                      )}
                    />
                    <FieldError errors={[errors.base]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="turno">Turno</FieldLabel>
                    <Controller
                      control={control}
                      name="turno"
                      render={({ field }) => (
                        <SelecaoCampo
                          id="turno"
                          opcoes={turnos}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                          disabled={somenteLeitura}
                        />
                      )}
                    />
                  </Field>
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
                </FieldGroup>
              </CardContent>
            </Card>

            <nav
              aria-label="Ambientes"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
            >
              {estadoAmbientes.map((amb, i) => (
                <a
                  key={amb.chave}
                  href={`#ambiente-${i}`}
                  aria-label={[
                    amb.nome,
                    amb.concluido && "concluído",
                    amb.ocorrencia && "com ocorrência",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  className={cn(
                    buttonVariants({
                      variant: amb.concluido ? "secondary" : "outline",
                      size: "sm",
                    }),
                    "shrink-0",
                  )}
                >
                  {amb.concluido ? (
                    <Check data-icon="inline-start" />
                  ) : (
                    amb.ocorrencia && <TriangleAlert data-icon="inline-start" />
                  )}
                  {amb.nome}
                </a>
              ))}
            </nav>

            <div className="grid items-start gap-5 lg:grid-cols-2">
              {ambientes.map((a, i) => (
                <AmbienteFields
                  key={a._key}
                  onPhotosBusyChange={onPhotosBusyChange}
                  index={i}
                  control={control}
                  register={register}
                  setValue={setValue}
                  errors={errors}
                  somenteLeitura={somenteLeitura}
                />
              ))}
            </div>

            {!somenteLeitura && (
              <CampoAdicionar
                id="novo-ambiente"
                rotulo="Novo ambiente"
                rotuloVisivel
                placeholder="Ex.: Casa de bombas…"
                maxLength={120}
                erro={erroAmbiente}
                onAdicionar={adicionarAmbiente}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Observações gerais</h2>
                </CardTitle>
                <CardDescription>Pendências e acompanhamento.</CardDescription>
              </CardHeader>
              <CardContent>
                <Field data-invalid={!!errors.observacoesGerais}>
                  <FieldLabel htmlFor="observacoes" className="sr-only">
                    Observações gerais
                  </FieldLabel>
                  <Textarea
                    id="observacoes"
                    placeholder="Material pendente, manutenção necessária…"
                    aria-invalid={!!errors.observacoesGerais}
                    {...register("observacoesGerais")}
                  />
                  <FieldError errors={[errors.observacoesGerais]} />
                </Field>
              </CardContent>
            </Card>

            {!somenteLeitura && (
              <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
                <div className="min-w-0 text-sm">
                  <p className="font-medium tabular-nums">
                    {itensPreenchidos} de {totalItens} itens
                  </p>
                  {isDirty && rascunhoGuardado && (
                    <p className="truncate text-muted-foreground">
                      Guardado neste aparelho
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="lg"
                  disabled={isSubmitting || finalizando || photosBusy > 0}
                  onClick={() => {
                    const tamanho = getValues("ambientes").reduce(
                      (n, a) =>
                        n +
                        (a.fotos ?? []).reduce(
                          (m, f) => m + ("dataUrl" in f ? f.dataUrl.length : 0),
                          0,
                        ),
                      0,
                    );
                    if (tamanho > MAX_CARACTERES_FOTOS_RONDA) {
                      avisar(
                        "As fotos ultrapassam o limite total da ronda. Remova algumas imagens.",
                        "error",
                      );
                      return;
                    }
                    void finalizar();
                  }}
                >
                  <Check data-icon="inline-start" />
                  {persistido ? "Salvar alterações" : "Finalizar ronda"}
                </Button>
              </div>
            )}
          </fieldset>
        </form>

        <AlertDialog
          open={confirmacaoAberta}
          onOpenChange={setConfirmacaoAberta}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmacao?.titulo}</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmacao?.descricao}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmacaoAberta(false);
                  confirmacao?.acao();
                }}
              >
                {confirmacao?.confirmar}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  );
}
