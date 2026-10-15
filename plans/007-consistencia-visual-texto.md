# Plano 007: Consistência visual, de texto e de acessibilidade

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Checagem de drift (rode primeiro)**: escrito sobre alterações ainda **não
> commitadas** (base `2cd8087`, 2026-10-14). Confira cada trecho de "Estado
> atual" contra o código vivo; divergência é condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: nenhum. Se o plano 006 for executado antes, a linha
  "Programada" já terá saído (não é tratada aqui).
- **Categoria**: UX / a11y / copy
- **Planejado em**: working tree sobre `2cd8087`, 2026-10-14

## Por que importa

Quatro problemas pequenos e visíveis em todas as telas:

1. **Links com cara de botão perdem a borda.** `buttonVariants()` aplicado
   direto num `<Link>` gera as classes `border-transparent` (base) e
   `border-border` (variante `outline`) juntas; sem o `cn()` (tailwind-merge),
   a transparente vence no CSS e o link fica sem borda, enquanto um `Button`
   com a mesma variante tem borda. Visto nos cabeçalhos ("Histórico",
   "Dashboard"), nos atalhos de ambiente e nos "Abrir".
2. **Jargão de infraestrutura e texto desatualizado na interface**: "Banco
   Turso ativo", "Ronda no Turso", "Dados guardados no Turso", "Observações,
   GPS ou prioridade" (GPS saiu do app), botão de fechar aviso com rótulo em
   inglês ("Close toast").
3. **A página do formulário só tem um título (`h1`)**: os nomes dos ambientes e
   dos cartões são `div` (`CardTitle`), então leitores de tela não conseguem
   pular de ambiente em ambiente.
4. **Cores do `body` fixas em hexadecimal** em `app/globals.css`, fora da camada
   de tokens: sobrepõem `bg-background`/`text-foreground` e impedem temas.

## Estado atual

`buttonVariants` sem `cn` (todas as ocorrências fora de `components/ui`):

- `components/ronda-form.tsx:613-624` — links "Histórico" e "Dashboard":
  `className={buttonVariants({ variant: "outline" })}`
- `components/ronda-form.tsx:701-707` — atalhos de ambiente:
  `<a … className={buttonVariants({ variant: "outline", size: "sm" })}>`
- `components/historico-rondas.tsx:112` e `:115-118` — links do cabeçalho
- `components/historico-rondas.tsx:244-249` — link "Abrir" da lista
- `components/dashboard-facilities.tsx:382` e `:385-389` — links do cabeçalho
- `components/dashboard-facilities.tsx:739-743` — link "Abrir" da lista

Exemplo correto que já existe no repo (`components/historico-rondas.tsx:177-183`):

```tsx
                  className={cn(
                    buttonVariants({
                      variant: slot.existente ? "secondary" : "outline",
                      size: "sm",
                    }),
                    "h-auto flex-col py-2",
                  )}
```

Textos a trocar (`components/dashboard-facilities.tsx`):

- `:94` e `:110` — `arquivo: r.arquivoOrigem ?? "Ronda no Turso",`
- `:233` — `nota: "Observações, GPS ou prioridade",`
- `:401` — `Banco Turso ativo · {rondas.length} ronda(s) registrada(s)`
- `:507-508` — `…Os TXT antigos importados são guardados no Turso.`
- `:727` — `{r.arquivoOrigem ?? "Ronda no Turso"} ·{" "}`
- `:771` — `Elinsa do Brasil · Facilities · Dados guardados no Turso`

`components/ui/toast.tsx:126` — `aria-label="Close toast"`.

`components/ronda-form.tsx:735` — `placeholder="Material pendente, manutenção necessária..."`.

Títulos de cartão (`CardTitle` renderiza `div`, `components/ui/card.tsx:35-43`):

- `components/ronda-form.tsx:202-203` — `<CardTitle …><span>{ambiente?.nome ?? "Ambiente"}</span>`
- `components/ronda-form.tsx:636`, `:725`, `:746` — "Identificação da ronda",
  "Observações gerais", "Personalizar checklist"
- `components/historico-rondas.tsx` — títulos "Agenda do plantão noturno" e "Rondas salvas"

`app/globals.css:87-91`:

```css
body {
  min-height: 100%;
  background: #ffffff;
  color: #18181b;
}
```

(o `@layer base` logo abaixo já aplica `bg-background text-foreground` ao
`body`, e o `<body>` em `app/layout.tsx` já tem `min-h-full`).

O preflight do Tailwind zera tamanho, peso e margem de `h1`–`h6`; um `<h2>`
dentro de `CardTitle` herda a tipografia do cartão sem mudança visual.

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Typecheck | `pnpm db:generate && pnpm exec next typegen && pnpm exec tsc --noEmit` | exit 0 (se faltar `DATABASE_URL`, prefixe `DATABASE_URL=file:./placeholder.db`) |
| Lint | `pnpm lint` | exit 0 |

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

Navegador: `export AGENT_BROWSER_SESSION=verif-007` e use
`npx agent-browser open <url>`, `snapshot -i`, `eval '<js>'`. Ao terminar:
`npx agent-browser close`, encerre o servidor
(`kill $(ss -ltnp | grep ':3115 ' | sed -E 's/.*pid=([0-9]+).*/\1/')`) e
`rm -rf "$VERIF"`.

## Escopo

**Dentro do escopo**:

- `components/ronda-form.tsx`, `components/historico-rondas.tsx`,
  `components/dashboard-facilities.tsx` — só as linhas citadas
- `components/ui/toast.tsx` — só o `aria-label`
- `app/globals.css` — só o bloco `body` das linhas 87-91

**Fora do escopo** (NÃO toque):

- Outros arquivos de `components/ui/` (são do registro shadcn).
- Lógica, estados ou fluxo de qualquer tela.
- Estrutura de navegação (cabeçalho compartilhado é outro finding).

## Fluxo Git

- Branch: `advisor/007-consistencia-visual-texto`
- Commits em português (ex.: `fix(ui): aplica cn em links com estilo de botão`).
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: links com estilo de botão

Em cada ocorrência listada, troque `className={buttonVariants({...})}` por
`className={cn(buttonVariants({...}))}`, importando `cn` de `@/lib/utils`
onde ainda não estiver importado. Não mude variantes nem tamanhos. Mantenha
`<Link>`/`<a>` (são navegação; não converta em `<button>`).

**Verificar**: `grep -n "className={buttonVariants" components/*.tsx` → nenhuma linha.

### Passo 2: textos

Em `components/dashboard-facilities.tsx`:

- `"Ronda no Turso"` (3 lugares) → `"Formulário"`
- `"Observações, GPS ou prioridade"` → `"Com descrição ou prioridade"`
- `Banco Turso ativo · {rondas.length} ronda(s) registrada(s)` →
  `{rondas.length} ronda(s) registrada(s)`
- `Os TXT antigos importados são guardados no Turso.` →
  `Os TXT antigos importados ficam guardados no banco de dados.`
- `Elinsa do Brasil · Facilities · Dados guardados no Turso` →
  `Elinsa do Brasil · Facilities`

Em `components/ui/toast.tsx`: `aria-label="Close toast"` → `aria-label="Fechar aviso"`.

Em `components/ronda-form.tsx`: o placeholder termina com `…` (reticências,
U+2026) em vez de `...`.

**Verificar**: `grep -rn "Turso\|GPS\|Close toast" components/*.tsx components/ui/toast.tsx`
→ nenhuma linha.

### Passo 3: títulos semânticos

Dentro dos `CardTitle` listados, envolva o texto do título em `<h2>`:

- ambiente: troque `<span>{ambiente?.nome ?? "Ambiente"}</span>` por
  `<h2>{ambiente?.nome ?? "Ambiente"}</h2>`;
- demais: `<CardTitle>Identificação da ronda</CardTitle>` →
  `<CardTitle><h2>Identificação da ronda</h2></CardTitle>` (idem para os outros);
- quando o `CardTitle` tem ícone + texto (ex.: "Agenda do plantão noturno"),
  envolva o `CardTitle` inteiro: troque o conteúdo por
  `<h2 className="flex items-center gap-2">ícone texto</h2>` e remova essas
  classes do `CardTitle`.

**Verificar**: no ambiente isolado,
`npx agent-browser open http://localhost:3115` e
`npx agent-browser eval '[...document.querySelectorAll("h1,h2")].length'` →
pelo menos 13 (1 `h1` + 9 ambientes + 3 cartões).

### Passo 4: cores do body

Remova o bloco `body { min-height: 100%; background: #ffffff; color: #18181b; }`
de `app/globals.css` (linhas 87-91). Não mexa no `@layer base`.

**Verificar**: `grep -n "#ffffff\|#18181b" app/globals.css` → nenhuma linha.

### Passo 5: verificação visual

No ambiente isolado (refaça a cópia após as mudanças):

```bash
npx agent-browser open http://localhost:3115
npx agent-browser eval 'getComputedStyle([...document.querySelectorAll("a")].find(a => a.textContent.includes("Histórico"))).borderTopColor'
```

**Verificar**: a cor **não** é `rgba(0, 0, 0, 0)` (a borda existe). Repita em
`/historico` para o link "Dashboard" e em `/dashboard` para o link "Histórico".
`npx agent-browser eval 'getComputedStyle(document.body).backgroundColor'` →
`rgb(255, 255, 255)` (o token `--background` é branco).

## Plano de testes

Sem testes automatizados (mudanças de estilo e texto). A verificação é a do
Passo 5 mais os `grep` dos passos 1, 2 e 4.

## Critérios de pronto

- [ ] `pnpm lint` e typecheck saem com 0
- [ ] Os `grep` dos passos 1, 2 e 4 não retornam linhas
- [ ] Passo 3: ≥ 13 títulos `h1`/`h2` no formulário
- [ ] Passo 5: links com borda visível nas três telas
- [ ] `git status` mostra só arquivos do escopo
- [ ] Linha do plano 007 atualizada em `plans/README.md`

## Condições de PARADA

- Trechos de "Estado atual" divergem do código vivo.
- O `<h2>` dentro do `CardTitle` muda visivelmente o tamanho do título.
- Alguma tela passa a exibir fundo diferente de branco após o Passo 4.

## Notas de manutenção

- Regra para o futuro: estilo de botão em `<Link>` sempre via
  `cn(buttonVariants(...))`. Um cabeçalho compartilhado (finding UX-08)
  eliminaria a maior parte dessas cópias.
- Remover as cores fixas do `body` é o pré-requisito para o modo escuro
  (direção D1 no índice).
