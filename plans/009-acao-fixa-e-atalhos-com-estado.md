# Plano 009: Ação de finalizar sempre visível e atalhos de ambiente com estado (celular)

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Checagem de drift (rode primeiro)**: escrito sobre alterações ainda **não
> commitadas** (base `2cd8087`, 2026-10-14). Confira os trechos de "Estado
> atual" contra o código vivo; divergência é PARADA. Se 006–008 já foram
> aplicados, localize os trechos pelo conteúdo, não pelos números de linha.

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: nenhum (execute depois de 006–008 se estiverem na fila;
  todos tocam `components/ronda-form.tsx`). Se o plano 008 já foi aplicado,
  mantenha o rótulo condicional do botão ("Salvar alterações"/"Finalizar ronda").
- **Categoria**: UX (mobile)
- **Planejado em**: working tree sobre `2cd8087`, 2026-10-14

## Por que importa

A ronda é feita no celular. Em 390 px de largura o formulário tem ~4.400 px de
altura (≈ 5 telas). O único botão de ação ("Finalizar ronda") fica no fim da
página, e os atalhos para os 9 ambientes ficam só no topo, ocupando 3 linhas,
sem indicar quais ambientes já foram concluídos ou têm ocorrência. O usuário
rola para cima e para baixo para saber o que falta e para finalizar.

## Estado atual

`components/ronda-form.tsx`:

- `:579-590` — cálculo do progresso (campos obrigatórios + tarefas marcadas):

```ts
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
```

- `:597-601` — barra fixa no topo (`<Progress … className="sticky top-0 z-10 …">`).
- `:699-709` — atalhos:

```tsx
          <nav aria-label="Ambientes" className="flex flex-wrap gap-2">
            {ambientes.map((a, i) => (
              <a
                key={a._key}
                href={`#ambiente-${i}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {atual.ambientes?.[i]?.nome ?? a.nome}
              </a>
            ))}
          </nav>
```

  (se o plano 007 já rodou, o `className` estará com `cn(...)`).
- `:200` — cada ambiente é `<Card id={`ambiente-${index}`}>` dentro de
  `AmbienteFields`; um ambiente "tem ocorrência" quando
  `observacao.trim() !== ""` ou `prioridade !== "Informação"` (mesma regra de
  `temOcorrencia` em `:178-180`).
- `:806-821` — rodapé (`div` com o texto "Preenchimento guardado neste
  aparelho até a finalização." e o `Button` de finalizar).

Convenções shadcn do repo (`.agents/skills/shadcn/rules/`): classes só para
layout; ícones em botão com `data-icon="inline-start"`, sem classes de tamanho;
usar `Badge`/variantes em vez de cores manuais.

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Typecheck | `pnpm db:generate && pnpm exec next typegen && pnpm exec tsc --noEmit` | exit 0 (se faltar `DATABASE_URL`, prefixe `DATABASE_URL=file:./placeholder.db`) |
| Lint | `pnpm exec biome check components/ronda-form.tsx` | exit 0 |

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

Navegador: `export AGENT_BROWSER_SESSION=verif-009`;
`npx agent-browser set viewport 390 844`, `open`, `snapshot -i`, `click @eN`,
`scroll down 1500`, `eval '<js>'`, `screenshot <arquivo>`. Ao terminar:
`npx agent-browser close`, encerre o servidor
(`kill $(ss -ltnp | grep ':3115 ' | sed -E 's/.*pid=([0-9]+).*/\1/')`) e
`rm -rf "$VERIF"`.

## Escopo

**Dentro do escopo**: `components/ronda-form.tsx`.

**Fora do escopo** (NÃO toque): regras de progresso/ocorrência, lógica de
finalização, componentes de `components/ui/`, outras telas.

## Fluxo Git

- Branch: `advisor/009-acao-fixa-e-atalhos`
- Commit sugerido: `feat(ronda): barra de ação fixa e atalhos com estado`
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: barra de ação fixa no rodapé

Substitua o `div` do rodapé por um contêiner fixo na base da tela:

```tsx
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
            {/* o Button de finalizar existente, sem "w-full sm:w-auto" */}
          </div>
```

Mantenha o `Button` exatamente como está (props, `disabled`, ícone, rótulo),
só remova `className="w-full sm:w-auto"`.

**Verificar**: lint → exit 0.

### Passo 2: atalhos com estado, em uma linha rolável

Antes do `return`, calcule por ambiente:

```ts
  const estadoAmbientes = ambientes.map((a, i) => {
    const amb = atual.ambientes?.[i];
    const lista = amb?.tarefas ?? [];
    return {
      nome: amb?.nome ?? a.nome,
      concluido: lista.length > 0 && lista.every((t) => t?.concluida),
      ocorrencia:
        !!amb?.observacao?.trim() ||
        (amb?.prioridade ?? "Informação") !== "Informação",
    };
  });
```

Troque o `nav` por uma linha única com rolagem horizontal:

- `nav`: `className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"`;
- cada link: variante `"secondary"` quando `concluido`, senão `"outline"`;
  acrescente `"shrink-0"` às classes (via `cn`);
- dentro do link, antes do nome: `<Check data-icon="inline-start" />` quando
  `concluido`, ou `<TriangleAlert data-icon="inline-start" />` quando
  `ocorrencia`; depois do nome, um
  `<span className="sr-only">{concluido ? ", concluído" : ""}{ocorrencia ? ", com ocorrência" : ""}</span>`.

**Verificar**: lint → exit 0.

### Passo 3: rolagem para o ambiente não fica escondida

No `Card` de `AmbienteFields`, acrescente `className="scroll-mt-4"`.

**Verificar**: typecheck e lint → exit 0.

### Passo 4: verificação no celular (ambiente isolado)

```bash
npx agent-browser set viewport 390 844
npx agent-browser open http://localhost:3115
npx agent-browser scroll down 1500
npx agent-browser eval '(() => { const b = [...document.querySelectorAll("button")].find(x => /Finalizar ronda|Salvar alterações/.test(x.textContent)); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()'
```

**Verificar**: `true` (o botão está visível no meio da página). Depois marque
as 4 tarefas da Copa (`snapshot -i`, `click` em cada checkbox) e confira em
`npx agent-browser snapshot -i | grep 'link "Copa'` que o nome acessível
inclui `concluído`. Tire `screenshot` e confira que a barra inferior não cobre
o último campo quando a página está no fim (`scroll down 9999`).

## Plano de testes

Sem testes automatizados. Verificação do Passo 4 em viewport 390×844.

## Critérios de pronto

- [ ] Typecheck e lint saem com 0
- [ ] Passo 4: botão visível no meio da página; atalho da Copa anuncia "concluído"
- [ ] `git status` mostra só `components/ronda-form.tsx`
- [ ] Linha do plano 009 atualizada em `plans/README.md`

## Condições de PARADA

- Trechos de "Estado atual" divergem do código vivo.
- A barra fixa cobre o diálogo de confirmação ou os toasts (eles devem ficar
  por cima; não mexa em `z-index` de componentes de `components/ui/`).
- A linha de atalhos causa rolagem horizontal da página inteira (só o `nav`
  pode rolar): `npx agent-browser eval 'document.documentElement.scrollWidth > innerWidth'` deve dar `false`.

## Notas de manutenção

- Alternativa maior, para o mantenedor decidir: ambientes recolhíveis
  (`Accordion`) com resumo no cabeçalho — reduz a rolagem, mas muda o fluxo.
- Se o progresso passar a contar outros campos, a barra inferior acompanha
  (usa `itensPreenchidos`/`totalItens`).
