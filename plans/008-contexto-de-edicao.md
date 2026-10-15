# Plano 008: Deixar claro quando uma ronda já salva está sendo editada

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Checagem de drift (rode primeiro)**: escrito sobre alterações ainda **não
> commitadas** (base `2cd8087`, 2026-10-14). Confira cada trecho de "Estado
> atual" contra o código vivo; divergência é condição de PARADA. Se os planos
> 006 ou 007 já foram aplicados, as linhas citadas podem ter se deslocado —
> localize pelos trechos, não pelos números.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: nenhum (execute depois de 006/007 se eles estiverem na fila,
  porque todos tocam `components/ronda-form.tsx`)
- **Categoria**: UX
- **Planejado em**: working tree sobre `2cd8087`, 2026-10-14

## Por que importa

"Abrir" no histórico e no dashboard leva a `/?id=<id>`, que carrega uma ronda
**já salva** (normalmente finalizada) no formulário. A tela fica idêntica à de
uma ronda nova: mesmo título, nenhum aviso, e o botão continua dizendo
"Finalizar ronda" — mas clicar nele **substitui** o registro histórico. O
usuário não sabe se está criando ou alterando, e não tem como sair da edição a
não ser por "Nova ronda".

## Estado atual

`components/ronda-form.tsx`:

- `:356` — `const [persistido, setPersistido] = useState<string | null>(null);`
  — `persistido` guarda o `id` da ronda do banco que está aberta (ou `null`
  para ronda nova). Ele **nunca é exibido**. É preenchido ao abrir `/?id=` e ao
  restaurar um rascunho de ronda salva; volta a `null` em `iniciarNova()`.
- `:473-488` — `concluirFinalizacao` faz `PUT /api/rondas/<persistido>` quando
  há `persistido`, `POST` caso contrário; no sucesso chama
  `avisar("Ronda finalizada e salva no banco.", "success")`.
- `:516-534` — `criar()` inicia ronda nova (com confirmação se houver
  alterações). Reutilize-a para "Sair da edição".
- `:313-316` — helper `dataBR(data)` já existe (AAAA-MM-DD → DD/MM/AAAA).
- `:630` — abre o `<form>`; logo antes fica o fim do `<header>`.
- `:806-821` — rodapé com o botão:

```tsx
            <Button
              type="button"
              size="lg"
              disabled={isSubmitting || finalizando}
              onClick={() => void finalizar()}
              className="w-full sm:w-auto"
            >
              <Check data-icon="inline-start" /> Finalizar ronda
            </Button>
```

Componente a usar: `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`
de `@/components/ui/alert` (já instalado; exemplo de uso em
`components/dashboard-facilities.tsx`, busque `<Alert`). O ícone segue a
convenção dos outros alerts (`AlertCircle` ou `PencilLine` de `lucide-react`,
sem classes de tamanho).

`atual` (resultado de `useWatch({ control })`) tem `data`, `hora` e
`responsavel` da ronda aberta.

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

Navegador: `export AGENT_BROWSER_SESSION=verif-008` e use
`npx agent-browser open <url>`, `snapshot` / `snapshot -i`, `click @eN`. Ao
terminar: `npx agent-browser close`, encerre o servidor
(`kill $(ss -ltnp | grep ':3115 ' | sed -E 's/.*pid=([0-9]+).*/\1/')`) e
`rm -rf "$VERIF"`.

## Escopo

**Dentro do escopo**: `components/ronda-form.tsx`.

**Fora do escopo** (NÃO toque):

- APIs, banco, histórico e dashboard.
- Tornar rondas finalizadas somente leitura (é uma direção para o mantenedor
  decidir; ver "Notas").

## Fluxo Git

- Branch: `advisor/008-contexto-de-edicao`
- Commit sugerido: `feat(ronda): sinaliza edição de ronda salva`
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: aviso de edição

Logo antes de `<form`, renderize quando `persistido !== null`:

```tsx
        {persistido && (
          <Alert>
            <PencilLine />
            <AlertTitle>Editando uma ronda salva</AlertTitle>
            <AlertDescription>
              Ronda de {dataBR(atual.data ?? "")} às {atual.hora} ·{" "}
              {atual.responsavel || "sem responsável"}. Ao salvar, as alterações
              substituem o registro no banco.
            </AlertDescription>
            <AlertAction>
              <Button type="button" variant="outline" size="sm" onClick={() => criar()}>
                Sair da edição
              </Button>
            </AlertAction>
          </Alert>
        )}
```

Importe `Alert`, `AlertAction`, `AlertDescription`, `AlertTitle` e o ícone.

**Verificar**: `pnpm exec biome check components/ronda-form.tsx` → exit 0.

### Passo 2: rótulos de ação e de retorno

- Botão do rodapé: o texto passa a ser
  `{persistido ? "Salvar alterações" : "Finalizar ronda"}` (ícone igual).
- Em `concluirFinalizacao`, capture `const editando = persistido !== null;`
  **antes** do `fetch` e troque a mensagem de sucesso por
  `editando ? "Alterações salvas no banco." : "Ronda finalizada e salva no banco."`.
- O título do diálogo de pendências fica igual.

**Verificar**: typecheck e lint → exit 0.

### Passo 3: verificação no navegador

No ambiente isolado, crie uma ronda e abra-a:

```bash
ID=$(node -e 'console.log(crypto.randomUUID())')
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' localhost:3115/api/rondas --data "{\"id\":\"$ID\",\"data\":\"2026-10-14\",\"turno\":\"Noite\",\"hora\":\"21:00\",\"responsavel\":\"Teste\",\"base\":\"Paragominas\",\"status\":\"Finalizada\",\"plantaoData\":\"\",\"observacoesGerais\":\"\",\"gpsLatitude\":null,\"gpsLongitude\":null,\"gpsPrecisao\":null,\"gpsCapturadoEm\":null,\"ambientes\":[]}"
npx agent-browser open "http://localhost:3115/?id=$ID"
npx agent-browser snapshot | grep -E "Editando uma ronda salva|14/10/2026 às 21:00|Salvar alterações|Sair da edição"
```

**Verificar**: `201` e as quatro expressões aparecem. Depois clique em
"Sair da edição" (`snapshot -i` para pegar a ref): o aviso some, o botão volta
a "Finalizar ronda" e a URL é `/` (`npx agent-browser get url`).
Em `http://localhost:3115/` (ronda nova) o aviso não aparece.

## Plano de testes

Sem testes automatizados (componente cliente com estado). Verificação do Passo 3.

## Critérios de pronto

- [ ] Typecheck e lint saem com 0
- [ ] Passo 3 confirmado (aviso, rótulo, sair da edição, ronda nova sem aviso)
- [ ] `git status` mostra só `components/ronda-form.tsx`
- [ ] Linha do plano 008 atualizada em `plans/README.md`

## Condições de PARADA

- Trechos de "Estado atual" divergem do código vivo.
- `persistido` não é mais o estado que indica ronda do banco (refactor anterior).
- O aviso aparece para ronda nova ou some ao restaurar rascunho de ronda salva.

## Notas de manutenção

- Direção para o mantenedor: abrir rondas finalizadas em modo **somente
  leitura** (com "Editar" explícito) evita alterações acidentais em registros
  históricos. Este plano só deixa a edição explícita; não a bloqueia.
- `finalizadoEm` é regravado a cada "Salvar alterações" de uma ronda já
  finalizada (`lib/ronda-db.ts`, `dadosRonda`); se a data de finalização
  importar, preserve a original no `PUT`.
