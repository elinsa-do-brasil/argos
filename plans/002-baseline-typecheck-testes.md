# Plano 002: Criar a base de verificação (`pnpm typecheck` e `pnpm test`) com testes do núcleo puro

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Antes de escrever código**: o `AGENTS.md` do repo avisa que este Next.js
> (16.4) tem mudanças incompatíveis com o que você conhece. Depois do
> `pnpm install`, leia o guia relevante em `node_modules/next/dist/docs/`
> (procure por `typegen` e por TypeScript) antes de definir o script de typecheck.
>
> **Checagem de drift (rode primeiro)**:
> `git diff --stat 2cd8087..HEAD -- package.json tsconfig.json biome.json pnpm-workspace.yaml lib/ronda.ts lib/dashboard-txt.ts README.md`
> Se algum arquivo do escopo mudou, compare os trechos de "Estado atual" com o
> código vivo; se divergirem, trate como condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: LOW
- **Depende de**: nenhum
- **Categoria**: tests / dx
- **Planejado em**: commit `2cd8087`, 2026-10-14

## Por que importa

O repo não tem testes, nem script de typecheck, nem CI. A única verificação é
`pnpm lint` (Biome) e `pnpm build`. Há ~250 linhas de parsing por regex
(`lib/dashboard-txt.ts`) que leem os TXT do formulário HTML antigo — qualquer
ajuste de formato quebra a importação em silêncio. Sem uma base de verificação,
qualquer refactor futuro não tem rede de segurança. Este plano cria
`pnpm typecheck`, `pnpm test` (Vitest) e os primeiros testes do núcleo puro
(`lib/ronda.ts`, `lib/dashboard-txt.ts`).

> **Atualização (2026-10-14)**: o formulário do Argos deixou de exportar TXT
> (decisão do mantenedor); o parser de TXT passou a existir só para importar
> arquivos legados. O fixture do Passo 5 continua válido — ele é o formato
> desses arquivos. Verificado manualmente nesta data: `pnpm exec next typegen`
> existe no Next 16.4.0 e `prisma generate && next typegen && tsc --noEmit`
> sai com 0 no estado atual do repo.
## Estado atual

`package.json` (scripts hoje):

```json
"scripts": {
  "dev": "prisma generate && next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "biome check",
  "format": "biome format --write",
  "db:generate": "prisma generate",
  "db:migrate:turso": "node scripts/migrate-turso.mjs"
}
```

- Não existe `typecheck`, `test`, runner de testes, nem `.github/`.
- `tsconfig.json`: `strict: true`, `noEmit: true`, alias `"@/*": ["./*"]`,
  `include` cobre `**/*.ts`, `**/*.tsx` e `.next/types/**/*.ts`.
- `app/layout.tsx` usa o tipo global `LayoutProps<"/">` (gerado pelo Next; por
  isso `tsc --noEmit` puro provavelmente exige gerar os tipos antes — confirme na
  documentação instalada).
- O client do Prisma é gerado em `generated/prisma/` (ignorado pelo git); o
  `prisma.config.ts` lê `env("DATABASE_URL")`.
- `pnpm-workspace.yaml`:
  ```yaml
  allowBuilds:
    '@prisma/engines': true
    prisma: true
    sharp: false
    unrs-resolver: false
  ```
- Módulos **puros** (testáveis sem banco): `lib/ronda.ts` (só importa `zod`) e
  `lib/dashboard-txt.ts` (importa `@/lib/ronda`). Módulos que importam
  `@/lib/prisma` usam `import "server-only"` — **não** os importe em testes.

Formato do TXT que o parser lê: o fixture `TXT_BASE` do Passo 5 documenta o
formato (cabeçalho `Base/Data/Responsável`, `ID da ronda`, `Turno`, `Horário
previsto`, `Situação`, `Plantão iniciado em`, `GPS da ronda`, `Checklist
detalhado`, blocos `Ambiente:` com `Prioridade:`/`Localização:`/`Observação:` e
tarefas `[X]`/`[ ]`, e `Observações gerais:`). Não há mais gerador desse formato
no repo.

Assinaturas que os testes usam:

- `lib/ronda.ts`: `rondaSchema` (zod 4; `id` é `z.string().uuid()`, `data`
  `z.iso.date()`, `hora` regex `HH:MM`), `novaRonda(data, hora, anterior?)`
  (devolve 9 ambientes iniciais com 4 tarefas cada). (`importarRondaLegada`
  foi removida em 2026-10-14 junto com a restauração de backup.)
- `lib/dashboard-txt.ts`: `parsearRondaTXT(texto, nomeArquivo)` →
  `{ ronda, origemId }`; lança `Error("Arquivo vazio.")` ou
  `Error("Dados do TXT inválidos ou fora dos limites aceitos.")`.

Convenções: identificadores em português, aspas duplas, 2 espaços, imports
ordenados pelo Biome (`organizeImports`), commits em português estilo
conventional (`feat(ui): configura o shadcn`, `chore: remove os arquivos padrão
do create-next-app`).

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Lint (arquivos tocados) | `pnpm exec biome check <arquivos>` | exit 0 |
| Gerar Prisma | `pnpm db:generate` | exit 0 |
| Typecheck (a criar) | `pnpm typecheck` | exit 0 |
| Testes (a criar) | `pnpm test` | todos passam |

## Kit sugerido

- Documentação do Next instalada: `node_modules/next/dist/docs/` (buscar `typegen`).
- Skill `next-best-practices` do repo (`.agents/skills/next-best-practices/`)
  se disponível — só como referência; não altere código de aplicação aqui.

## Escopo

**Dentro do escopo**:

- `package.json` (scripts `typecheck`, `test`; devDependency `vitest`)
- `pnpm-lock.yaml` (efeito do `pnpm add`)
- `pnpm-workspace.yaml` (somente se o pnpm exigir aprovação de build scripts)
- `vitest.config.ts` (criar)
- `lib/ronda.test.ts` (criar)
- `lib/dashboard-txt.test.ts` (criar)
- `README.md` (seção "Comandos": duas linhas)

**Fora do escopo** (NÃO toque):

- Qualquer código de aplicação (`app/`, `components/`, `lib/*.ts` não-teste).
  Se o typecheck ou os testes revelarem um bug, **registre e reporte**; não corrija aqui.
- `biome.json`, `tsconfig.json`, `prisma/`, `.env`.

## Fluxo Git

- Branch: `advisor/002-baseline-typecheck-testes`
- Commits por passo, ex.: `chore(dx): adiciona script de typecheck`,
  `test: adiciona vitest e testes do parser de TXT`.
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: instalar e registrar a linha de base do lint

```bash
pnpm install
pnpm lint; echo "lint exit=$?"
```

**Verificar**: `pnpm install` sai com 0. Anote o `exit` do lint e a contagem de
diagnósticos — é a linha de base pré-existente (você só é responsável por **não
introduzir** diagnósticos novos).

### Passo 2: script `typecheck`

1. Verifique se `pnpm db:generate` funciona **sem** `DATABASE_URL` definida:
   `env -u DATABASE_URL pnpm db:generate; echo "exit=$?"`.
   - Se sair com 0: ok.
   - Se falhar reclamando de `DATABASE_URL`: o script de typecheck deve fornecer
     um valor de placeholder (`DATABASE_URL="${DATABASE_URL:-file:./placeholder.db}"`
     antes de `prisma generate`). Não altere `prisma.config.ts`.
2. Confirme na doc instalada o comando que gera os tipos globais do Next
   (`next typegen`). Defina em `package.json`:
   ```json
   "typecheck": "prisma generate && next typegen && tsc --noEmit"
   ```
   (adicione o prefixo `DATABASE_URL=...` do item 1 se necessário).

**Verificar**: `pnpm typecheck; echo "exit=$?"` → exit 0.
- Se `next typegen` não existir nesta versão, use como fallback
  `"typecheck": "prisma generate && next build"` e registre isso no commit.
- Se o typecheck falhar por erros em código existente → PARADA (reporte a lista
  de diagnósticos; não corrija código de aplicação).

### Passo 3: adicionar o Vitest

```bash
pnpm add -D vitest
```

Crie `vitest.config.ts` na raiz:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

Em `package.json`, adicione `"test": "vitest run"`.

Se o `pnpm add` reclamar de build scripts ignorados (ex.: `esbuild`), adicione
a entrada correspondente em `allowBuilds` de `pnpm-workspace.yaml` com `false`
(`esbuild: false` funciona porque o binário vem como optionalDependency) e rode
`pnpm install` de novo.

**Verificar**: `pnpm exec vitest run; echo "exit=$?"` → "No test files found"
(exit 1) neste ponto é esperado; qualquer erro de configuração/resolução não é.

### Passo 4: testes de `lib/ronda.ts`

Crie `lib/ronda.test.ts` (`import { describe, expect, it } from "vitest"`,
`import { novaRonda, rondaSchema } from "@/lib/ronda"`)
cobrindo exatamente:

1. `novaRonda("2026-10-14", "08:00")` passa em `rondaSchema.safeParse` (success
   `true`), tem 9 ambientes e cada ambiente tem 4 tarefas, todas
   `concluida === false`.
2. `novaRonda(d, h, anterior)`: monte `anterior = novaRonda(...)`, marque uma
   tarefa como `concluida = true` e `observacao = "x"` no primeiro ambiente;
   a nova ronda mantém a lista de `nome`s, zera `concluida` e `observacao`, e
   nenhum `id` (ronda, ambiente, tarefa) coincide com os de `anterior`.
3. `rondaSchema` rejeita (cada um separado, partindo de um `novaRonda` válido):
   `hora: "24:00"`, `hora: "8:00"`, `data: "2026-13-01"`,
   `turno: "Madrugada"`, `id: "abc"`.
**Verificar**: `pnpm test -- lib/ronda.test.ts` → 3 testes (ou mais, se você
dividir casos) passam.

### Passo 5: testes de `lib/dashboard-txt.ts`

Crie `lib/dashboard-txt.test.ts`. Defina uma constante `TXT_BASE` (template
literal; **sem espaços no fim das linhas**) com este conteúdo:

```
ROTINA FACILITIES - ELINSA DO BRASIL
Base: Paragominas
Data: 2026-10-14
Responsável: Maria Silva

ID da ronda: 3f2b8a4e-1c5d-4e7a-9b6f-0a1b2c3d4e5f
Turno: Noite
Horário previsto: 21:00
Situação: Finalizada
Plantão iniciado em: 2026-10-14
GPS da ronda: -3.123456, -47.123456 (±12 m)
Checklist: 1/3 concluídos
Checklist detalhado

Ambiente: Copa
Prioridade: Urgente
Localização: -3.100000, -47.100000 (precisão aproximada: 8 m)
Observação: Torneira vazando
[X] Verificar limpeza e organização
[ ] Conferir pia, torneiras e pontos de água

Ambiente: Banheiros
Prioridade: Pouco urgente
Observação:
[ ] Verificar reposição de insumos

Observações gerais: Repor papel toalha
```

Casos (importe `parsearRondaTXT` de `@/lib/dashboard-txt`):

1. `parsearRondaTXT(TXT_BASE, "x.txt")` →
   `origemId === "3f2b8a4e-1c5d-4e7a-9b6f-0a1b2c3d4e5f"`; `ronda.data ===
   "2026-10-14"`, `turno === "Noite"`, `hora === "21:00"`, `responsavel ===
   "Maria Silva"`, `base === "Paragominas"`, `status === "Finalizada"`,
   `plantaoData === "2026-10-14"`, `gpsLatitude === -3.123456`,
   `gpsLongitude === -47.123456`, `gpsPrecisao === 12`,
   `observacoesGerais === "Repor papel toalha"`, 2 ambientes.
2. Ambiente 0: `nome "Copa"`, `prioridade "Urgente"`, `observacao "Torneira
   vazando"`, `localizacao "-3.100000, -47.100000 (precisão aproximada: 8 m)"`,
   tarefas `[{texto: "Verificar limpeza e organização", concluida: true},
   {texto: "Conferir pia, torneiras e pontos de água", concluida: false}]`
   (compare só `texto` e `concluida`, pois os `id`s são aleatórios).
3. Ambiente 1: `nome "Banheiros"`, `prioridade "Pouco urgente"`,
   `observacao ""`, 1 tarefa não concluída.
4. Variante com BOM e CRLF: `"﻿" + TXT_BASE.replaceAll("\n", "\r\n")`
   produz os mesmos valores do caso 1 (compare `data`, `responsavel`,
   quantidade de ambientes e `origemId`).
5. Vazio: `parsearRondaTXT("   \n", "x.txt")` lança "Arquivo vazio.".
6. Sem `Data:`: texto `"Base: X\nAmbiente: Copa\n[ ] Item"` com nome de
   arquivo `"facilities-2026-03-02-abc.txt"` → `ronda.data === "2026-03-02"`,
   `responsavel === "Não informado"`, `hora === "08:00"`.
7. Tarefas extras: `"Data: 2026-10-14\nTarefas extras\n[ ] Trocar lâmpada\nPintar parede"`
   → último ambiente `nome === "Tarefas extras"` com 2 tarefas
   (`"Trocar lâmpada"`, `"Pintar parede"`), ambas `concluida: false`.
8. Limite: `"Data: 2026-10-14\nAmbiente: Copa\nObservação: " + "x".repeat(4001)`
   lança "Dados do TXT inválidos ou fora dos limites aceitos.".

**Verificar**: `pnpm test` → 2 arquivos de teste, todos os casos passam.
Se algum caso falhar por o parser se comportar diferente da expectativa acima,
**não ajuste o parser**: confira se você digitou o fixture exatamente (sem
espaços no fim das linhas) e, persistindo, PARE e reporte qual caso divergiu e
o valor obtido — pode ser um bug real a planejar.

### Passo 6: documentar

No `README.md`, seção "Comandos", acrescente:

```
- `pnpm typecheck`: gera o Prisma Client e os tipos do Next e roda `tsc --noEmit`.
- `pnpm test`: roda os testes unitários (Vitest).
```

**Verificar**: `pnpm exec biome check vitest.config.ts lib/ronda.test.ts lib/dashboard-txt.test.ts package.json` → exit 0.

## Plano de testes

Descrito nos Passos 4 e 5. Padrão estrutural: não há teste existente — use
`describe`/`it` do Vitest, um `describe` por função exportada, nomes de teste em
português descrevendo o comportamento.

## Critérios de pronto

Todos devem valer:

- [ ] `pnpm typecheck` sai com 0
- [ ] `pnpm test` sai com 0 e reporta os 2 arquivos novos
- [ ] `pnpm exec biome check vitest.config.ts lib/ronda.test.ts lib/dashboard-txt.test.ts package.json` sai com 0
- [ ] `pnpm lint` não tem diagnósticos novos em relação ao Passo 1
- [ ] Nenhum arquivo de aplicação (`app/`, `components/`, `lib/*.ts` não-teste) foi modificado (`git status`)
- [ ] Linha do plano 002 atualizada em `plans/README.md`

## Condições de PARADA

Pare e reporte (sem improvisar) se:

- Os trechos de "Estado atual" não baterem com o código vivo.
- `pnpm typecheck` falhar por erro em código de aplicação existente.
- `prisma generate` exigir credenciais reais do Turso (use só placeholder/arquivo local).
- Você achar necessário alterar `lib/ronda.ts` ou `lib/dashboard-txt.ts` para os testes passarem.
- A verificação de um passo falhar duas vezes após uma correção razoável.

## Notas de manutenção

- Estes testes são a rede de segurança para qualquer mudança em
  `lib/dashboard-txt.ts` (única peça que ainda entende o formato TXT legado).
- Testes de rotas (`app/api/**`) exigem banco; fora deste plano. Um banco de
  arquivo (`file:`) com o script do plano 001 é o caminho natural.
- Revisor: confirme que nenhum código de aplicação mudou e que `vitest` entrou
  só em `devDependencies`.
- Considerar CI (GitHub Actions rodando `pnpm lint && pnpm typecheck && pnpm test`)
  como follow-up — não incluído porque o repo não tem hospedagem de CI definida.
