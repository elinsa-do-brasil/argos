# Plano 005: Neutralizar injeção de fórmula na exportação CSV do dashboard

> **OBSOLETO — NÃO EXECUTAR (2026-10-14).** O mantenedor decidiu remover todas
> as saídas de arquivo do projeto (TXT, CSV, backup, compartilhar/copiar). O
> botão "Exportar CSV" e a função `exportarCSV` deixaram de existir, então não há
> mais superfície de injeção de fórmula. Mantido apenas como registro; se uma
> exportação CSV voltar um dia, retome este plano.

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Checagem de drift (rode primeiro)**:
> `git diff --stat 2cd8087..HEAD -- components/dashboard-facilities.tsx lib`
> Se algum arquivo do escopo mudou, compare os trechos de "Estado atual" com o
> código vivo; se divergirem, trate como condição de PARADA.

## Status

- **Prioridade**: — (obsoleto)
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: `plans/002-baseline-typecheck-testes.md` (runner de testes `pnpm test`)
- **Categoria**: security
- **Planejado em**: commit `2cd8087`, 2026-10-14

## Por que importa

O botão "Exportar CSV" do dashboard grava os campos de ocorrência exatamente
como estão. Esses campos (observação, localização, responsável, nome do arquivo
importado) vêm de formulário aberto e de TXT importados de terceiros. Uma célula
que comece com `=`, `+`, `-` ou `@` é interpretada como **fórmula** quando a
equipe abre o CSV no Excel/LibreOffice, o que permite exfiltrar dados da
planilha ou acionar funções externas. Neutralizar o início da célula é a
mitigação padrão e custa poucas linhas.

## Estado atual

`components/dashboard-facilities.tsx:385-408`:

```tsx
function exportarCSV() {
  const linhas = [
    [
      "Data",
      "Ambiente",
      "Prioridade",
      "Observação",
      "Localização",
      "Responsável",
      "Arquivo",
    ],
    ...filtradas.map((o) => [
      o.data,
      o.ambiente,
      o.prioridade,
      o.observacao,
      o.localizacao,
      o.responsavel,
      o.arquivo,
    ]),
  ];
  const csv = `﻿${linhas.map((linha) => linha.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n")}`;
  baixar("ocorrencias_facilities_elinsa.csv", csv, "text/csv;charset=utf-8");
}
```

- Delimitador `;`, BOM UTF-8 `﻿`, quebra `\r\n`, todos os campos entre
  aspas duplas com `"` duplicado — **mantenha exatamente isso**.
- `lib/` é onde ficam utilitários puros (`lib/utils.ts`, `lib/ronda.ts`).
  Módulos novos usados por componentes cliente **não** podem importar
  `server-only`/Prisma.
- O Vitest (plano 002) roda `lib/**/*.test.ts`; alias `@` aponta para a raiz.
- Convenção: nomes em português (`celulaCSV`, `montarCSV`), aspas duplas,
  2 espaços.

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Testes | `pnpm test` | todos passam |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint (arquivos tocados) | `pnpm exec biome check lib/csv.ts lib/csv.test.ts components/dashboard-facilities.tsx` | exit 0 |

## Escopo

**Dentro do escopo**:

- `lib/csv.ts` (criar)
- `lib/csv.test.ts` (criar)
- `components/dashboard-facilities.tsx` (somente `exportarCSV` e o import)

**Fora do escopo** (NÃO toque):

- Qualquer outra parte de `dashboard-facilities.tsx` (o arquivo tem 930 linhas;
  mexa só nas linhas citadas).
- Formato dos TXT exportados e o backup JSON.
- `lib/dashboard-txt.ts`, `lib/ronda.ts`.

## Fluxo Git

- Branch: `advisor/005-csv-sem-injecao-de-formula`
- Commit sugerido: `fix(dashboard): neutraliza fórmulas na exportação CSV`
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: utilitário `lib/csv.ts`

```ts
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export function celulaCSV(valor: unknown): string {
  const texto = String(valor ?? "");
  const seguro = INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replaceAll('"', '""')}"`;
}

export function montarCSV(linhas: unknown[][]): string {
  return `﻿${linhas
    .map((linha) => linha.map(celulaCSV).join(";"))
    .join("\r\n")}`;
}
```

**Verificar**: `pnpm exec biome check lib/csv.ts` → exit 0.

### Passo 2: usar o utilitário no dashboard

Em `components/dashboard-facilities.tsx`:

- adicione `import { montarCSV } from "@/lib/csv";` junto dos demais imports de
  `@/lib/...` (o Biome ordena; rode `pnpm exec biome check --write` **apenas**
  neste arquivo se precisar reordenar imports e confira o diff);
- substitua a linha `const csv = ...` por `const csv = montarCSV(linhas);`.

**Verificar**: `pnpm exec biome check components/dashboard-facilities.tsx` →
exit 0 e `git diff --stat` mostra poucas linhas alteradas nesse arquivo
(≈ 2 adições de import/uso e 1 remoção).

### Passo 3: testes

Crie `lib/csv.test.ts` (`import { describe, expect, it } from "vitest"`):

1. `celulaCSV("normal")` → `'"normal"'`.
2. `celulaCSV('ele disse "oi"')` → `'"ele disse ""oi"""'`.
3. `celulaCSV(null)` e `celulaCSV(undefined)` → `'""'`.
4. Para cada um de `"=1+1"`, `"+SUM(A1)"`, `"-2+3"`, `"@cmd"`, `"\tx"`, `"\rx"`:
   o resultado começa com `"'` (aspas, apóstrofo).
5. `celulaCSV("=1+1")` → `` `"'=1+1"` `` (valor completo).
6. Compromisso conhecido: `celulaCSV("-3.123456, -47.123456")` →
   `` `"'-3.123456, -47.123456"` `` (coordenadas negativas também recebem o
   apóstrofo; é o preço da regra simples — documente isso no próprio teste).
7. `celulaCSV(" =x")` (espaço inicial) → `` `" =x"` `` (não neutraliza).
8. `montarCSV([["a", "=b"], ["c", "d"]])` →
   `"﻿\"a\";\"'=b\"\r\n\"c\";\"d\""`.

**Verificar**: `pnpm test -- lib/csv.test.ts` → todos passam.

## Plano de testes

Descrito no Passo 3. Padrão estrutural: `lib/ronda.test.ts` e
`lib/dashboard-txt.test.ts` criados pelo plano 002 (`describe`/`it` do Vitest,
nomes em português).

## Critérios de pronto

Todos devem valer:

- [ ] `pnpm test` sai com 0 e inclui `lib/csv.test.ts`
- [ ] `pnpm typecheck` sai com 0
- [ ] `pnpm exec biome check lib/csv.ts lib/csv.test.ts components/dashboard-facilities.tsx` sai com 0
- [ ] `grep -n "uFEFF" components/dashboard-facilities.tsx` não encontra nada (a montagem inline saiu) e `grep -n "montarCSV" components/dashboard-facilities.tsx` encontra 2 linhas (import e uso)
- [ ] `git status` mostra só os 3 arquivos do escopo
- [ ] Linha do plano 005 atualizada em `plans/README.md`

## Condições de PARADA

Pare e reporte (sem improvisar) se:

- Os trechos de "Estado atual" não baterem com o código vivo.
- O plano 002 não estiver aplicado (`pnpm test` inexistente).
- Você achar que precisa mudar o delimitador, o BOM ou as colunas do CSV.
- A verificação de um passo falhar duas vezes após uma correção razoável.

## Notas de manutenção

- Qualquer novo export CSV do projeto deve usar `montarCSV`.
- O apóstrofo aparece literalmente na célula no Excel; é a mitigação
  recomendada pela OWASP para CSV injection. Se a equipe reclamar das
  coordenadas negativas na coluna "Localização", uma alternativa é emitir essa
  coluna só com o par `lat, lon` já validado por regex numérica — decisão
  deliberada de produto, fora deste plano.
- Revisor: confirme que `exportarCSV` produz exatamente os mesmos bytes que
  antes para células sem caractere inicial perigoso (BOM, `;`, `\r\n`, aspas).
