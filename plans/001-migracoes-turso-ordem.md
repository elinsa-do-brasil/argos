# Plano 001: Aplicar as migrações do Turso na ordem correta em um banco novo

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Checagem de drift (rode primeiro)**:
> `git diff --stat 2cd8087..HEAD -- scripts/migrate-turso.mjs prisma/migrations README.md`
> Se algum arquivo do escopo mudou desde que o plano foi escrito, compare os
> trechos de "Estado atual" com o código vivo; se divergirem, trate como
> condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: MED (renomeia migrações que já podem estar aplicadas no Turso real)
- **Depende de**: nenhum
- **Categoria**: bug
- **Planejado em**: commit `2cd8087`, 2026-10-14

## Por que importa

O passo 3 do README manda rodar `pnpm db:migrate:turso` para "criar as tabelas".
Em um banco **vazio** esse comando falha: o script ordena as pastas de migração
com `localeCompare` e `20261014_dashboard_imports` (que faz `ALTER TABLE "Ronda"`)
vem antes de `20261014_init` (que faz `CREATE TABLE "Ronda"`) porque `d` < `i`.
Quem clonar o projeto ou criar um banco novo (staging, recuperação de desastre)
não consegue subir o esquema. Hoje só funciona em bancos que receberam `init`
antes de `dashboard_imports` existir.

## Estado atual

Arquivos relevantes:

- `scripts/migrate-turso.mjs` — aplica `prisma/migrations/*/migration.sql` em
  ordem e registra o nome da pasta em `_argos_migrations`.
- `prisma/migrations/20261014_init/migration.sql` — `CREATE TABLE "Ronda"`,
  `"Ambiente"`, `"Tarefa"` + índices.
- `prisma/migrations/20261014_dashboard_imports/migration.sql` — três
  `ALTER TABLE "Ronda" ADD COLUMN` (arquivoOrigem, conteudoTXT, hashTXT) + índice
  único `Ronda_hashTXT_key`.

Trecho atual de `scripts/migrate-turso.mjs` (linhas 9–23):

```js
const db = createClient({ url, authToken: process.env.TURSO_TOKEN });
try {
  await db.execute(`CREATE TABLE IF NOT EXISTS "_argos_migrations" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const root = join(process.cwd(), "prisma", "migrations");
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const applied = await db.execute({
      sql: 'SELECT 1 FROM "_argos_migrations" WHERE "name" = ?',
      args: [entry.name],
    });
    if (applied.rows.length) continue;
```

Confirmado pelo advisor: `["20261014_init","20261014_dashboard_imports"].sort((a,b)=>a.localeCompare(b))`
→ `[ '20261014_dashboard_imports', '20261014_init' ]`.

Convenção do repo: scripts `.mjs` em ESM, aspas duplas, `prisma/migrations/<nome>/migration.sql`.
Mensagens de log em PT-BR (`Migração aplicada: ...`, `Migrações Turso em dia.`).

**Restrição importante**: o banco Turso real do projeto provavelmente já tem as
linhas `20261014_init` e `20261014_dashboard_imports` em `_argos_migrations`. Se
as pastas forem renomeadas sem tratar isso, o script tentaria reaplicar o SQL e
falharia (`table already exists` / `duplicate column`). Por isso o passo 2
renomeia as linhas legadas antes de aplicar.

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Migrar (SEMPRE com banco de arquivo, veja aviso) | `DATABASE_URL=file:/tmp/argos-001.db node scripts/migrate-turso.mjs` | ver passos |
| Lint dos arquivos tocados | `pnpm exec biome check scripts/migrate-turso.mjs` | exit 0 |

(Comandos do `package.json`; o advisor não os executou porque `node_modules`
não está instalado e instalar é proibido no modo advisor.)

> **AVISO DE SEGURANÇA**: o `.env` local aponta para o Turso real. O script usa
> `dotenv/config`, que **não sobrescreve** variáveis já definidas no ambiente —
> por isso todo comando de verificação abaixo define `DATABASE_URL=file:...`
> inline. Nunca rode `node scripts/migrate-turso.mjs` sem esse prefixo durante
> este plano. Nunca imprima o conteúdo do `.env`.

## Escopo

**Dentro do escopo** (únicos arquivos que você pode modificar):

- `scripts/migrate-turso.mjs`
- `prisma/migrations/20261014_init/` → renomear para `prisma/migrations/20261014000000_init/` (via `git mv`)
- `prisma/migrations/20261014_dashboard_imports/` → renomear para `prisma/migrations/20261014000100_dashboard_imports/` (via `git mv`)
- `README.md` (uma frase, passo 3)

**Fora do escopo** (NÃO toque):

- O **conteúdo** de qualquer `migration.sql` — só os nomes das pastas mudam.
- `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`, `prisma.config.ts`.
- `.env` e qualquer conexão com o Turso real.

## Fluxo Git

- Branch: `advisor/001-migracoes-turso-ordem`
- Um commit por passo lógico, estilo do repo (português, conventional commits),
  ex.: `fix(db): ordena migrações do Turso por timestamp`.
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 0: reproduzir o bug (antes de mudar qualquer coisa)

```bash
pnpm install
rm -f /tmp/argos-001.db
DATABASE_URL=file:/tmp/argos-001.db node scripts/migrate-turso.mjs
echo "exit=$?"
```

**Verificar**: o comando termina com `exit` diferente de 0 e a mensagem de erro
menciona a tabela `Ronda` (ex.: `no such table`). Se terminar com sucesso, o bug
não reproduz → PARADA.

### Passo 1: renomear as pastas de migração

```bash
git mv prisma/migrations/20261014_init prisma/migrations/20261014000000_init
git mv prisma/migrations/20261014_dashboard_imports prisma/migrations/20261014000100_dashboard_imports
```

**Verificar**: `ls prisma/migrations` imprime exatamente
`20261014000000_init  20261014000100_dashboard_imports  migration_lock.toml`
(em linhas separadas) e `git status --short` mostra só renomeações (`R`).

### Passo 2: ordenar por código de caractere e migrar nomes legados

Em `scripts/migrate-turso.mjs`:

a) Logo após o `CREATE TABLE IF NOT EXISTS "_argos_migrations"` (dentro do
`try`), adicione:

```js
// Bancos já migrados registraram os nomes antigos das pastas. Renomeia as
// linhas antes de aplicar, senão o SQL seria reaplicado.
const nomesLegados = {
  "20261014_init": "20261014000000_init",
  "20261014_dashboard_imports": "20261014000100_dashboard_imports",
};
for (const [antigo, novo] of Object.entries(nomesLegados)) {
  await db.execute({
    sql: 'UPDATE "_argos_migrations" SET "name" = ? WHERE "name" = ?',
    args: [novo, antigo],
  });
}
```

b) Troque a ordenação para comparação por código de caractere (igual à do
Prisma; independe de locale):

```js
.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
```

**Verificar**: `pnpm exec biome check scripts/migrate-turso.mjs` → exit 0.

### Passo 3: documentar a convenção

No `README.md`, no passo 3 de "Configuração" (parágrafo que cita
`pnpm db:migrate:turso`), acrescente uma frase: "As pastas em
`prisma/migrations/` usam o prefixo `AAAAMMDDHHMMSS_` e são aplicadas em ordem
alfabética."

**Verificar**: `grep -n "AAAAMMDDHHMMSS" README.md` → 1 ocorrência.

### Passo 4: verificar banco novo, idempotência e upgrade de banco legado

```bash
rm -f /tmp/argos-001.db
DATABASE_URL=file:/tmp/argos-001.db node scripts/migrate-turso.mjs
```

**Verificar** (saída esperada, nesta ordem):
```
Migração aplicada: 20261014000000_init
Migração aplicada: 20261014000100_dashboard_imports
Migrações Turso em dia.
```

Segunda execução (idempotência):

```bash
DATABASE_URL=file:/tmp/argos-001.db node scripts/migrate-turso.mjs
```

**Verificar**: imprime só `Migrações Turso em dia.`, exit 0.

Inspecionar o resultado:

```bash
DATABASE_URL=file:/tmp/argos-001.db node --input-type=module <<'EOF'
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL });
const tabelas = await db.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
console.log("tabelas:", tabelas.rows.map((r) => r.name).join(","));
const colunas = await db.execute(`PRAGMA table_info("Ronda")`);
console.log("hashTXT:", colunas.rows.some((r) => r.name === "hashTXT"));
const mig = await db.execute(`SELECT name FROM "_argos_migrations" ORDER BY name`);
console.log("migracoes:", mig.rows.map((r) => r.name).join(","));
db.close();
EOF
```

**Verificar**:
```
tabelas: Ambiente,Ronda,Tarefa,_argos_migrations
hashTXT: true
migracoes: 20261014000000_init,20261014000100_dashboard_imports
```

Simular um banco legado (linhas com os nomes antigos) e rodar de novo:

```bash
DATABASE_URL=file:/tmp/argos-001.db node --input-type=module <<'EOF'
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.DATABASE_URL });
await db.execute(`UPDATE "_argos_migrations" SET "name" = '20261014_init' WHERE "name" = '20261014000000_init'`);
await db.execute(`UPDATE "_argos_migrations" SET "name" = '20261014_dashboard_imports' WHERE "name" = '20261014000100_dashboard_imports'`);
db.close();
EOF
DATABASE_URL=file:/tmp/argos-001.db node scripts/migrate-turso.mjs
```

**Verificar**: imprime só `Migrações Turso em dia.` (nenhuma linha `Migração
aplicada`), exit 0; e a consulta de inspeção acima volta a mostrar
`migracoes: 20261014000000_init,20261014000100_dashboard_imports`.

Limpeza: `rm -f /tmp/argos-001.db`.

## Plano de testes

Sem suíte de testes no repo neste commit (ver plano 002). A verificação é o
roteiro do Passo 4 contra um banco de arquivo descartável. Se o plano 002 já
tiver sido aplicado, **não** adicione teste aqui — o script não é importável sem
efeitos colaterais.

## Critérios de pronto

Todos devem valer:

- [ ] Passo 0 reproduziu a falha antes da mudança
- [ ] Passo 4: banco novo migra sem erro e na ordem esperada; segunda execução é no-op; banco "legado" é renomeado sem reaplicar SQL
- [ ] `pnpm exec biome check scripts/migrate-turso.mjs` sai com 0
- [ ] `git diff --stat 2cd8087..HEAD -- prisma/migrations` mostra apenas renomeações (similaridade 100%)
- [ ] Nenhum arquivo fora do escopo foi modificado (`git status`)
- [ ] Linha do plano 001 atualizada em `plans/README.md`

## Condições de PARADA

Pare e reporte (sem improvisar) se:

- O Passo 0 não reproduzir a falha, ou os arquivos divergirem dos trechos acima.
- Qualquer comando de verificação precisar tocar o Turso real (URL `libsql:`).
- Você achar necessário editar o conteúdo de um `migration.sql`.
- O Passo 4 mostrar `Migração aplicada` para as migrações legadas (o renome de
  linhas não funcionou).

## Notas de manutenção

- Toda migração nova deve usar prefixo de 14 dígitos (`AAAAMMDDHHMMSS_nome`).
  Um teste automático que valide o formato das pastas seria um bom follow-up
  (depende do plano 002).
- O banco Turso de produção só é "consertado" na primeira execução do script
  novo contra ele — o operador deve rodar `pnpm db:migrate:turso` uma vez após
  o merge e conferir `_argos_migrations`.
- A divisão de statements do script (`split(/;\s*(?:\r?\n|$)/)`) é frágil para
  triggers ou strings com `;` + quebra de linha. Não afeta as migrações atuais;
  fica fora deste plano.
- Revisor: confirme que os `migration.sql` aparecem como renomeações puras e
  que o mapa `nomesLegados` cobre as duas pastas.
