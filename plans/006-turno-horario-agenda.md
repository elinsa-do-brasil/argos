# Plano 006: Valores iniciais da ronda coerentes com o horário e com a agenda do plantão

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Antes de escrever código**: o `AGENTS.md` do repo avisa que este Next.js
> (16.4) difere do que você conhece; consulte `node_modules/next/dist/docs/`
> se tocar em APIs do Next. Este plano mexe só em componentes cliente e em
> funções puras.
>
> **Checagem de drift (rode primeiro)**: este plano foi escrito sobre alterações
> ainda **não commitadas** (base `2cd8087`, 2026-10-14). Confira cada trecho de
> "Estado atual" contra o código vivo; qualquer divergência é condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: nenhum (se o plano 002 já foi aplicado, adicione os testes do Passo 6)
- **Categoria**: bug (qualidade de dado) / UX
- **Planejado em**: working tree sobre `2cd8087`, 2026-10-14

## Por que importa

Três problemas encadeados fazem a agenda do plantão noturno mentir e obrigam o
usuário a redigitar dados:

1. Uma ronda nova sempre começa com turno **"Manhã"**, mesmo às 20:49 (visto no
   celular). Quem não trocar o turno grava uma ronda noturna como "Manhã".
2. A agenda em `/historico` só reconhece uma ronda se o horário for **exato**
   (`"20:00"`) e o turno for "Noite". Uma ronda iniciada às 20:13, ou gravada
   como "Manhã" às 22:05, aparece como horário vazio.
3. Horários vazios aparecem como **"Programada"**, inclusive os que já passaram —
   o supervisor não distingue "ainda vai acontecer" de "não foi feita".

Além disso, responsável e base precisam ser redigitados a cada vez que o
formulário é aberto do zero (só ficam na memória enquanto a página está aberta).

## Estado atual

Arquivos:

- `lib/ronda.ts` — schema zod e `novaRonda` (fábrica de ronda nova).
- `components/ronda-form.tsx` — formulário; inicialização no `useEffect` de montagem.
- `components/historico-rondas.tsx` — tela `/historico` com a agenda.
- `lib/rascunho.ts` — padrão de acesso ao `localStorage` a seguir (try/catch, schema zod).

`lib/ronda.ts:108-121` (início de `novaRonda`):

```ts
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
```

`components/ronda-form.tsx:370-379` (montagem):

```ts
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const agora = new Date();
    const nova = novaRonda(dataLocal(agora), agora.toTimeString().slice(0, 5));
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const alvoId = id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
    const prefill = alvoId ? null : lerPrefill(params);
    const rascunho = lerRascunho();
```

`components/ronda-form.tsx:393-394` (`abrirAlvo`, usa `nova` e `prefill`):

```ts
    async function abrirAlvo() {
      reset(prefill ? { ...nova, ...prefill } : nova);
```

`components/ronda-form.tsx:473-488` (`concluirFinalizacao`, trecho de sucesso):

```ts
      if (!response.ok) throw new Error();
      apagarRascunho();
      setRascunhoGuardado(false);
      iniciarNova();
      avisar("Ronda finalizada e salva no banco.", "success");
```

`components/historico-rondas.tsx:77-82` (casamento da agenda) e `:190` (rótulo):

```ts
        const existente = rondas.find(
          (r) =>
            r.data === dataTexto &&
            r.hora === horaTexto &&
            r.turno === "Noite" &&
            r.base === base,
        );
```

```tsx
                    {slot.existente?.status ?? "Programada"}
```

O slot é um `<Link>` com `variant: slot.existente ? "secondary" : "outline"`
(`components/historico-rondas.tsx:174-183`). A lista `rondas` chega ordenada
por data e hora decrescentes (mais recente primeiro).

Convenções: identificadores e textos em PT-BR, aspas duplas, 2 espaços, Biome.
Acesso a `localStorage` sempre em `try/catch` (veja `lib/rascunho.ts`).

### Decisão do mantenedor (padrão adotado)

Faixas de turno alinhadas com a agenda (que vai das 19h às 07h):
**Manhã 07:00–12:59, Tarde 13:00–18:59, Noite 19:00–06:59**. Ficam em
constantes no topo de `lib/ronda.ts`; se o mantenedor pedir outras faixas, só
as constantes mudam.

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Typecheck | `pnpm db:generate && pnpm exec next typegen && pnpm exec tsc --noEmit` | exit 0 (se faltar `DATABASE_URL`, prefixe `DATABASE_URL=file:./placeholder.db`) |
| Lint (arquivos tocados) | `pnpm exec biome check lib/ronda.ts lib/preferencias.ts components/ronda-form.tsx components/historico-rondas.tsx` | exit 0 |

### Ambiente de verificação isolado (use sempre)

> O `.env` aponta para o banco Turso **real** e pode haver um `next dev` do
> mantenedor na porta 3000 usando esse banco. Nunca verifique contra ele.

```bash
VERIF="$(mktemp -d)"; mkdir -p "$VERIF/app"
tar --exclude=./node_modules --exclude=./.next --exclude=./generated \
  --exclude=./.git --exclude=./.env --exclude=./.agents --exclude=./plans \
  -cf - . | tar -xf - -C "$VERIF/app"
cd "$VERIF/app" && pnpm install
export DATABASE_URL="file:$VERIF/verif.db"
node scripts/migrate-turso.mjs          # → termina com "Migrações Turso em dia."
pnpm db:generate
(pnpm exec next dev -p 3115 > "$VERIF/dev.log" 2>&1 &)
sleep 8; curl -s -o /dev/null -w '%{http_code}\n' localhost:3115/   # → 200
```

Navegador: `export AGENT_BROWSER_SESSION=verif-006` e use
`npx agent-browser open <url>`, `snapshot -i` (elementos com refs `@eN`),
`click @eN`, `fill @eN "texto"`, `eval '<js>'`, `reload`. Ao terminar:
`npx agent-browser close`, encerre o servidor
(`kill $(ss -ltnp | grep ':3115 ' | sed -E 's/.*pid=([0-9]+).*/\1/')`) e
`rm -rf "$VERIF"`. Se alterar código depois, refaça a cópia.

## Escopo

**Dentro do escopo**:

- `lib/ronda.ts` (constantes de turno, `turnoPorHora`, uso em `novaRonda`)
- `lib/preferencias.ts` (criar: lembrar responsável e base)
- `components/ronda-form.tsx` (aplicar preferências na montagem; salvar ao finalizar)
- `components/historico-rondas.tsx` (casamento por hora cheia; rótulos e variantes dos slots)
- `lib/ronda.test.ts` (somente se o plano 002 já existir)

**Fora do escopo** (NÃO toque):

- Rotas de API, schema Prisma, `lib/rascunho.ts` (só use como exemplo).
- O dashboard (`components/dashboard-facilities.tsx`).
- A lógica de rascunho e de prefill por URL — apenas componha com ela.

## Fluxo Git

- Branch: `advisor/006-turno-horario-agenda`
- Commits em português, estilo do repo (ex.: `fix(ronda): define turno pelo horário`).
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: turno pelo horário

Em `lib/ronda.ts`, acima de `novaRonda`, adicione:

```ts
// Faixas alinhadas com a agenda do plantão noturno (19h às 07h).
const INICIO_MANHA = 7;
const INICIO_TARDE = 13;
const INICIO_NOITE = 19;

export function turnoPorHora(hora: string): RondaInput["turno"] {
  const h = Number(hora.slice(0, 2));
  if (h >= INICIO_MANHA && h < INICIO_TARDE) return "Manhã";
  if (h >= INICIO_TARDE && h < INICIO_NOITE) return "Tarde";
  return "Noite";
}
```

Em `novaRonda`, troque `turno: anterior?.turno ?? "Manhã",` por
`turno: turnoPorHora(hora),` (o turno passa a seguir o horário da ronda nova,
mesmo quando há ronda anterior; o prefill da agenda continua sobrescrevendo).

**Verificar**: `pnpm exec biome check lib/ronda.ts` → exit 0.

### Passo 2: preferências de responsável e base

Crie `lib/preferencias.ts` seguindo o padrão de `lib/rascunho.ts`:

```ts
import { z } from "zod";

const CHAVE = "argos:preferencias";

const preferenciasSchema = z.object({
  responsavel: z.string().max(120),
  base: z.string().max(120),
});

export type Preferencias = z.infer<typeof preferenciasSchema>;

export function lerPreferencias(): Partial<Preferencias> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return {};
    const parsed = preferenciasSchema.safeParse(JSON.parse(bruto));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function salvarPreferencias(preferencias: Preferencias) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(preferencias));
  } catch {
    // Sem acesso ao armazenamento local: segue sem lembrar.
  }
}
```

Em `components/ronda-form.tsx`:

- importe `lerPreferencias` e `salvarPreferencias` de `@/lib/preferencias`;
- na montagem, troque a linha de `nova` por:

```ts
    const preferencias = lerPreferencias();
    const nova = {
      ...novaRonda(dataLocal(agora), agora.toTimeString().slice(0, 5)),
      ...(preferencias.responsavel ? { responsavel: preferencias.responsavel } : {}),
      ...(preferencias.base ? { base: preferencias.base } : {}),
    };
```

  (o `prefill` da agenda é aplicado depois em `abrirAlvo` e continua vencendo
  para `base`; o rascunho, quando existe, continua vencendo tudo);
- em `concluirFinalizacao`, logo após `if (!response.ok) throw new Error();`,
  adicione `salvarPreferencias({ responsavel: dados.responsavel, base: dados.base });`.

**Verificar**: `pnpm exec biome check lib/preferencias.ts components/ronda-form.tsx` → exit 0.

### Passo 3: agenda casa por hora cheia

Em `components/historico-rondas.tsx`, troque o `find` por:

```ts
        const existente = rondas.find(
          (r) =>
            r.data === dataTexto &&
            r.hora.slice(0, 2) === horaTexto.slice(0, 2) &&
            r.base === base,
        );
```

(sem exigir `turno === "Noite"`: dentro da janela do plantão, qualquer ronda
daquela data e hora pertence ao slot; rondas antigas gravadas com turno errado
passam a aparecer.)

**Verificar**: `pnpm exec biome check components/historico-rondas.tsx` → exit 0.

### Passo 4: estado dos slots (realizada / não realizada / a realizar)

No mesmo `map`, calcule o estado do slot. O `agenda` só é montado depois que
`plantao` é preenchido no `useEffect`, então usar `new Date()` aqui não causa
erro de hidratação:

```ts
        const inicio = new Date(`${dataTexto}T${horaTexto}:00`);
        const passou = inicio.getTime() + 60 * 60 * 1000 <= Date.now();
        const estado = existente
          ? existente.status
          : passou
            ? "Não realizada"
            : "A realizar";
```

Inclua `estado` e `passou` no objeto retornado. No JSX do slot:

- `variant`: `slot.existente ? "secondary" : slot.passou ? "destructive" : "outline"`;
- troque `{slot.existente?.status ?? "Programada"}` por `{slot.estado}`.

Não mexa no `href` nem no restante do slot.

**Verificar**: `pnpm exec biome check components/historico-rondas.tsx` → exit 0
e `grep -n "Programada" components/historico-rondas.tsx` → nenhuma linha.

### Passo 5: typecheck e lint

**Verificar**: o comando de typecheck da tabela → exit 0; o lint dos arquivos
tocados → exit 0.

### Passo 6 (opcional — só se `pnpm test` existir, plano 002)

Em `lib/ronda.test.ts`, adicione um `describe("turnoPorHora")` com:
`"06:59"→"Noite"`, `"07:00"→"Manhã"`, `"12:59"→"Manhã"`, `"13:00"→"Tarde"`,
`"18:59"→"Tarde"`, `"19:00"→"Noite"`, `"23:30"→"Noite"`, `"00:00"→"Noite"`; e
um caso de `novaRonda("2026-10-14", "20:49").turno === "Noite"`.

**Verificar**: `pnpm test` → todos passam.

### Passo 7: verificação no navegador (ambiente isolado)

Monte o ambiente isolado. Cadastre duas rondas de teste no banco de arquivo:

```bash
for args in "20:13 Noite" "22:05 Manhã"; do set -- $args
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' localhost:3115/api/rondas --data "{\"id\":\"$(node -e 'console.log(crypto.randomUUID())')\",\"data\":\"$(date +%F)\",\"turno\":\"$2\",\"hora\":\"$1\",\"responsavel\":\"Teste\",\"base\":\"Paragominas\",\"status\":\"Finalizada\",\"plantaoData\":\"\",\"observacoesGerais\":\"\",\"gpsLatitude\":null,\"gpsLongitude\":null,\"gpsPrecisao\":null,\"gpsCapturadoEm\":null,\"ambientes\":[]}"
done
```

**Verificar** (esperado `201` duas vezes), depois:

1. `npx agent-browser open http://localhost:3115/historico` e `snapshot -i`:
   os links `20:00 …` e `22:00 …` mostram `Finalizada`; nenhum slot mostra
   `Programada`; slots cujo horário já passou mostram `Não realizada`, os
   futuros `A realizar`.
2. `npx agent-browser open http://localhost:3115` e `snapshot -i`: o
   combobox `Turno` mostra o turno da hora atual pelas faixas do plano
   (confira com `date +%H`).
3. Preencha `Responsável` com `Joana Lima` e `Unidade / base` com `Base Teste`,
   finalize (confirme o diálogo de itens pendentes), rode
   `npx agent-browser eval 'localStorage.removeItem("argos:rascunho-ronda")'`
   e depois `npx agent-browser reload`: `Responsável` volta como `Joana Lima`
   e a base como `Base Teste` (vindos de `argos:preferencias`).

## Plano de testes

- Automatizado: Passo 6, se o runner existir.
- Manual: Passo 7 (agenda com 20:13 e 22:05, turno pela hora, preferências após reload).

## Critérios de pronto

- [ ] Typecheck da tabela sai com 0
- [ ] Lint dos arquivos tocados sai com 0
- [ ] `grep -n '"Manhã"' lib/ronda.ts` não mostra mais `anterior?.turno ?? "Manhã"`
- [ ] `grep -n "Programada" components/historico-rondas.tsx` → vazio
- [ ] Passo 7 confirmado (três itens)
- [ ] `git status` mostra só os arquivos do escopo
- [ ] Linha do plano 006 atualizada em `plans/README.md`

## Condições de PARADA

- Trechos de "Estado atual" divergem do código vivo.
- Alguma verificação exigiria usar o `.env` real ou o servidor da porta 3000.
- O mantenedor indicou faixas de turno diferentes das deste plano e você não
  sabe quais usar.
- Ocorrer erro de hidratação no console ao abrir `/historico`.

## Notas de manutenção

- Se a agenda passar a cobrir outros turnos, o casamento por hora cheia já
  serve; revisite só a janela 19h–07h.
- Duas rondas na mesma hora e base: o slot mostra a mais recente (a lista vem
  ordenada de forma decrescente). Se isso virar problema, mostre contagem.
- Revisor: confira que o prefill da agenda (`?turno=Noite`) continua
  sobrescrevendo o turno calculado.
