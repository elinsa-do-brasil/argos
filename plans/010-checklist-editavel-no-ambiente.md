# Plano 010: Adicionar tarefas e ambientes no próprio lugar, com Enter e erros no campo

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Checagem de drift (rode primeiro)**: escrito sobre alterações ainda **não
> commitadas** (base `2cd8087`, 2026-10-14). Confira os trechos de "Estado
> atual" contra o código vivo; divergência é PARADA. Se 006–009 já foram
> aplicados, localize os trechos pelo conteúdo, não pelos números de linha.

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: nenhum (execute por último entre 006–010; todos tocam
  `components/ronda-form.tsx`)
- **Categoria**: UX
- **Planejado em**: working tree sobre `2cd8087`, 2026-10-14

## Por que importa

Para acrescentar uma tarefa à Copa hoje é preciso rolar até o último cartão
("Personalizar checklist"), escolher "Copa" num select, digitar e clicar em
"Adicionar"; a tarefa aparece lá em cima, fora da vista, e o único retorno é um
aviso flutuante. Enter não faz nada (o `<form>` cancela o envio). Campo vazio
vira aviso de erro flutuante em vez de mensagem no campo. E uma tarefa digitada
errado não pode ser removida.

## Estado atual

`components/ronda-form.tsx`:

- `:157-311` — `AmbienteFields({ index, control, register, setValue, errors })`.
  Dentro dele, `:170-174`:

```ts
  const { fields: tarefas } = useFieldArray({
    control,
    name: `ambientes.${index}.tarefas`,
    keyName: "_key",
  });
```

  A lista de tarefas é renderizada em `:218-246` (um `Controller` + `Checkbox`
  por tarefa) dentro de `<FieldGroup className="gap-3">`.
- `:358-360` — estados `novoAmbiente`, `novaTarefa`, `ambienteTarefa` em `RondaForm`.
- `:536-560` — `adicionarAmbiente()` (valida vazio/duplicado com `avisar(..., "error")`
  e usa `appendAmbiente`).
- `:562-577` — `adicionarTarefa()` (usa o índice de `ambienteTarefa` e `setValue`).
- `:591-594` — `opcoesAmbientes` (só usado pelo select do cartão).
- `:630-633` — `<form onSubmit={(e) => e.preventDefault()} …>`.
- `:710-721` — grade de `AmbienteFields`.
- `:744-804` — cartão "Personalizar checklist" (input de ambiente, select
  "Ambiente da nova tarefa", input de tarefa).

Padrão de campo com erro do repo: `Field data-invalid` + `aria-invalid` no
controle + `FieldError` (veja o campo "Responsável", `:640-649`). Os limites do
schema (`lib/ronda.ts`): tarefa `texto` 1–300 caracteres; ambiente `nome`
1–120; até 100 tarefas por ambiente e 100 ambientes.

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

Navegador: `export AGENT_BROWSER_SESSION=verif-010`; `open`, `snapshot -i`,
`fill @eN "texto"`, `press Enter`, `click @eN`. Ao terminar:
`npx agent-browser close`, encerre o servidor
(`kill $(ss -ltnp | grep ':3115 ' | sed -E 's/.*pid=([0-9]+).*/\1/')`) e
`rm -rf "$VERIF"`.

## Escopo

**Dentro do escopo**: `components/ronda-form.tsx`.

**Fora do escopo** (NÃO toque): schema (`lib/ronda.ts`), rascunho, APIs,
outras telas, componentes de `components/ui/`.

## Fluxo Git

- Branch: `advisor/010-checklist-no-ambiente`
- Commit sugerido: `feat(ronda): adiciona tarefas e ambientes no próprio lugar`
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: adicionar tarefa dentro do ambiente

Em `AmbienteFields`:

- pegue também `append` e `remove` do `useFieldArray` de tarefas;
- estado local: `const [novaTarefa, setNovaTarefa] = useState("");`,
  `const [erroTarefa, setErroTarefa] = useState("");` e
  `const [adicionadas, setAdicionadas] = useState<string[]>([]);` (ids das
  tarefas criadas nesta sessão — só essas podem ser removidas);
- função:

```ts
  function adicionarTarefa() {
    const texto = novaTarefa.trim();
    if (!texto) {
      setErroTarefa("Informe a tarefa.");
      return;
    }
    const id = crypto.randomUUID();
    append({ id, texto: texto.slice(0, 300), concluida: false });
    setAdicionadas((atuais) => [...atuais, id]);
    setNovaTarefa("");
    setErroTarefa("");
  }
```

- depois do `FieldGroup` da lista de tarefas (ainda dentro do `FieldSet` do
  checklist), um campo:

```tsx
            <Field data-invalid={!!erroTarefa}>
              <FieldLabel htmlFor={`nova-tarefa-${index}`} className="sr-only">
                Nova tarefa em {ambiente?.nome ?? "ambiente"}
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id={`nova-tarefa-${index}`}
                  value={novaTarefa}
                  placeholder="Adicionar tarefa…"
                  aria-invalid={!!erroTarefa}
                  maxLength={300}
                  onChange={(e) => setNovaTarefa(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarTarefa();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={adicionarTarefa}>
                  <Plus data-icon="inline-start" /> Adicionar
                </Button>
              </div>
              {erroTarefa && <FieldError>{erroTarefa}</FieldError>}
            </Field>
```

- para cada tarefa cujo `t.id` esteja em `adicionadas`, mostre ao lado do
  rótulo um botão `variant="ghost" size="icon-sm"` com `<X />` e
  `aria-label={`Remover tarefa ${texto}`}` que chama `remove(j)` e tira o id
  de `adicionadas`. Use `t.id` (vindo de `tarefas[j]`) como referência; não
  remova tarefas do checklist padrão.

**Verificar**: lint → exit 0.

### Passo 2: adicionar ambiente depois da grade

Em `RondaForm`:

- remova os estados `novaTarefa` e `ambienteTarefa`, a função
  `adicionarTarefa`, `opcoesAmbientes` e o cartão "Personalizar checklist"
  inteiro;
- troque o `avisar(..., "error")` de `adicionarAmbiente` por um estado
  `erroAmbiente` exibido no campo (`"Informe o nome do ambiente."` /
  `"Esse ambiente já existe."`); mantenha o `appendAmbiente` e, após adicionar,
  role até o novo cartão:
  `requestAnimationFrame(() => document.getElementById(`ambiente-${ambientes.length}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))`
  (o novo índice é o tamanho anterior da lista);
- logo após a grade de `AmbienteFields`, um `Field` igual ao do Passo 1
  (label visível "Novo ambiente", placeholder `Ex.: Casa de bombas…`, Enter
  adiciona, `maxLength={120}`, `FieldError` quando houver erro).

**Verificar**: `grep -n "ambiente-tarefa\|Personalizar checklist\|opcoesAmbientes" components/ronda-form.tsx`
→ nenhuma linha; typecheck e lint → exit 0.

### Passo 3: verificação no navegador

No ambiente isolado:

1. `open http://localhost:3115`, `snapshot -i`: localize
   `textbox "Nova tarefa em Copa"`; `fill` com `Testar extintor` e
   `press Enter` → `snapshot -i` mostra `checkbox "Testar extintor"` e um
   `button "Remover tarefa Testar extintor"`.
2. Clique em "Remover tarefa Testar extintor" → o checkbox some.
3. Com o campo vazio, `press Enter` → aparece o texto `Informe a tarefa.`
   (`snapshot | grep "Informe a tarefa"`), sem aviso flutuante.
4. Em `textbox "Novo ambiente"`, `fill` `Casa de bombas` + `press Enter` →
   existe um cartão `Casa de bombas` e um link de atalho com esse nome; repetir
   o mesmo nome mostra `Esse ambiente já existe.` no campo.
5. Não existe mais `combobox "Ambiente da nova tarefa"`.

## Plano de testes

Sem testes automatizados (interação de formulário). Verificação do Passo 3.

## Critérios de pronto

- [ ] Typecheck e lint saem com 0
- [ ] Passo 3 confirmado (cinco itens)
- [ ] `git status` mostra só `components/ronda-form.tsx`
- [ ] Linha do plano 010 atualizada em `plans/README.md`

## Condições de PARADA

- Trechos de "Estado atual" divergem do código vivo.
- Adicionar/remover tarefa altera tarefas de outro ambiente (índices errados).
- O rascunho local deixa de restaurar tarefas adicionadas (elas fazem parte do
  formulário; devem voltar após recarregar — só o botão de remover some).

## Notas de manutenção

- Tarefas adicionadas voltam no rascunho após recarregar, mas sem o botão de
  remover (o controle `adicionadas` é da sessão). Se o mantenedor quiser
  remover/renomear sempre, marque as tarefas extras com um campo próprio no
  schema.
- "Marcar tudo" por ambiente (finding UX-07) encaixaria no mesmo cartão.
