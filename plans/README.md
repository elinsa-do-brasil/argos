# Planos de implementação

Gerado pela skill `improve` em 2026-10-14, contra o commit `2cd8087`
(`main`, árvore limpa). Execute na ordem abaixo, respeitando as dependências.
Cada executor: leia o plano inteiro antes de começar, respeite as condições de
PARADA e atualize a sua linha ao terminar.

> **Modo de geração**: sessão não interativa — não havia como o mantenedor
> escolher os findings. Seguindo o padrão da skill, foram escritos planos para os
> 5 de maior alavancagem. Os demais estão listados em "Findings sem plano" e
> podem virar plano sob demanda (`improve plan <descrição>`).

## Decisões do mantenedor (2026-10-14) — aplicadas depois da auditoria

1. **Rondas só no banco de dados.** Removidas as saídas de arquivo: exportar TXT,
   exportar CSV, WhatsApp/compartilhar/copiar, "Backup de todas as rondas" e
   "Backup completo"/"Ver TXT" do dashboard. A ronda é salva (e finalizada) no
   banco. As **entradas** (importar TXT legado, restaurar backup JSON) foram
   mantidas. "Imprimir / PDF" do dashboard não estava na lista e foi mantido.
2. **Login com better-auth, mas depois.** Nada implementado ainda. O plano 004
   (paliativo) fica DEFERRED.
3. **Formulário migrado para componentes shadcn** (`Select`, `Checkbox`,
   `Input`/`Textarea` do registro base-luma, `AlertDialog`, `toast`, `Progress`,
   `Item`, `ScrollArea`, `Badge`, `Empty`). Já aplicado no working tree.

4. **Formulário enxuto (2026-10-14, segunda rodada).** Removidos: GPS da
   ronda e localização por ambiente (precisão do celular insuficiente), card
   "Situação", card de progresso, histórico de rondas (vai para tela própria,
   a fazer), "Restaurar backup JSON" e o botão "Salvar". Fica só "Finalizar
   ronda", que grava no banco e inicia uma ronda nova. Ocorrência por ambiente
   virou opcional (botão "Adicionar ocorrência"). Uma barra `Progress` fixa no
   topo mostra o preenchimento (campos obrigatórios + tarefas marcadas).

5. **Terceira rodada (2026-10-14).** A agenda do plantão noturno foi para a
   nova tela `/historico` (junto com a lista de rondas salvas; os slots abrem
   `/?id=` ou `/?data=&hora=&turno=&base=&plantao=` para iniciar a ronda já
   preenchida). Removidos o botão "Restaurar backup" do dashboard, a rota
   `/api/dashboard/restore` e `importarRondaLegada` — backup só no banco.
   O formulário guarda o preenchimento não finalizado em `localStorage`
   (`lib/rascunho.ts`) e o restaura ao reabrir; é apagado ao finalizar ou ao
   iniciar nova ronda. Planos 001 e 003 implementados.

6. **Rodada UI/UX implementada (2026-10-14).** Planos 006–010 aplicados, com
   as decisões do mantenedor:
   - **Turnos**: dias úteis por faixa (Manhã 07–13, Tarde 13–19, Noite 19–07);
     sábado e domingo com turno novo **"Dia todo"** (plantão das 07h às 07h);
     a madrugada pertence ao plantão do dia anterior. A agenda mostra 13
     horários em dia útil e 24 no fim de semana.
   - **"Marcar tudo"** por ambiente (UX-07), que vira "Desmarcar tudo".
   - **Bases** na constante `BASES` (`lib/ronda.ts`); formulário e agenda usam
     `Select` com essa lista (UX-10).
   - **Tema escuro** com `next-themes` e alternador no cabeçalho das três telas
     (direção D1).
   - **Edição por 10 minutos** após salvar (direção D3): aviso "Editando uma
     ronda salva" com o horário-limite; depois a ronda abre **somente leitura**.
     O servidor recusa `PUT`/`POST` fora do prazo com 409 e preserva o
     `finalizadoEm` original.
   - PWA (direção D2) fica para o futuro.

Efeito nos findings desta auditoria:

| Finding | Situação |
|---------|----------|
| SEC-02 (CSV) | **Moot** — exportação CSV removida (plano 005 REJECTED) |
| DUP-01 (serializadores de TXT) | **Moot** — os dois serializadores foram removidos |
| PERF-03 (export do formulário faz N+1) | **Resolvido** — export removido; o loop de importação sequencial permanece |
| PERF-01 (dashboard carrega tudo) | **Parcial** — `conteudoTXT` deixou de ser lido (`omit`) e enviado; payload completo e lista sem paginação permanecem |
| SEC-01 (sem auth) | **Aberto** — better-auth planejado |
| CORR-03 (Salvar reabre ronda finalizada) | **Moot** — não existe mais "Salvar"; o formulário só grava ao finalizar. Resta o detalhe de `finalizadoEm` ser regravado se uma ronda finalizada for reaberta e finalizada de novo |
| CORR-05 (restauração do formulário duplica) | **Moot** — "Restaurar backup JSON" saiu do formulário (a restauração do dashboard continua) |
| CORR-01 (migração em banco novo) | **Resolvido** — plano 001 (pendente só a execução no Turso após o merge) |
| CORR-02 (POST não idempotente) | **Resolvido** — plano 003 |
| SEC-03 (corpo lido antes do limite) | **Parcial** — a rota de restauração saiu; resta `app/api/dashboard/import/route.ts` |
| PERF-02 (escrita sequencial) | **Parcial** — a restauração saiu; resta a importação de TXT |
| Direção 2 (rascunho local) | **Feito** — `lib/rascunho.ts` |
| CORR-04, DX-01, DX-02 | **Abertos** |

## Ordem de execução e status

| Plano | Título | Prioridade | Esforço | Depende de | Status |
|-------|--------|------------|---------|------------|--------|
| [001](001-migracoes-turso-ordem.md) | Aplicar as migrações do Turso na ordem correta em banco novo | P1 | S | — | DONE (2026-10-14; falta rodar `pnpm db:migrate:turso` uma vez no Turso após o merge) |
| [002](002-baseline-typecheck-testes.md) | Base de verificação: `pnpm typecheck` + `pnpm test` + testes do núcleo puro | P1 | M | — | TODO |
| [003](003-salvar-ronda-idempotente.md) | Salvar ronda de forma idempotente; 400 para JSON malformado | P1 | S | 001 | DONE (2026-10-14; verificado: 201, 200, 400, 400, 1) |
| [004](004-barreira-de-acesso.md) | Barreira de acesso paliativa (senha compartilhada) para páginas e API | P1 | M | — | DEFERRED (login virá com better-auth; plano só vale como paliativo antes disso) |
| [005](005-csv-sem-injecao-de-formula.md) | Neutralizar injeção de fórmula no CSV do dashboard | — | S | 002 | REJECTED (CSV removido do projeto em 2026-10-14) |
| [006](006-turno-horario-agenda.md) | Valores iniciais da ronda coerentes com o horário e com a agenda | P1 | M | — | DONE (2026-10-14; com plantão "Dia todo" no fim de semana) |
| [007](007-consistencia-visual-texto.md) | Consistência visual, de texto e de acessibilidade | P1 | S | — | DONE (2026-10-14) |
| [008](008-contexto-de-edicao.md) | Deixar claro quando uma ronda salva está sendo editada | P1 | S | — | DONE (2026-10-14; ampliado: edição só por 10 min, depois somente leitura) |
| [009](009-acao-fixa-e-atalhos-com-estado.md) | Ação de finalizar sempre visível e atalhos com estado (celular) | P2 | M | — | DONE (2026-10-14) |
| [010](010-checklist-editavel-no-ambiente.md) | Adicionar tarefas e ambientes no próprio lugar, com Enter e erros no campo | P2 | M | — | DONE (2026-10-14; campo de tarefa abre por botão "+ Tarefa") |

Valores de status: TODO | IN PROGRESS | DONE | BLOCKED (motivo) | DEFERRED (motivo) | REJECTED (motivo)

## Rodada UI/UX (2026-10-14)

Segunda execução da skill, com foco em UI e UX, sobre o **working tree não
commitado** (base `2cd8087`). Auditoria direta (sem subagentes) do código das
três telas e inspeção no navegador em viewport de celular (390×844) e desktop,
numa cópia isolada com SQLite e dados de teste. Sessão não interativa: planos
escritos para os 5 findings de maior alavancagem (006–010); os demais estão
abaixo.

**Ordem de execução**: 006 → 007 → 008 → 009 → 010, **em sequência** — todos
tocam `components/ronda-form.tsx`, então rodar em paralelo gera conflito.
Recomenda-se commitar o estado atual antes, para que a checagem de drift tenha
uma base.

### Findings UI/UX

| # | Finding | Impacto | Esforço | Evidência | Plano |
|---|---------|---------|---------|-----------|-------|
| UX-02 | Ronda nova sempre começa como "Manhã", mesmo à noite (visto às 20:49); rondas noturnas gravadas com turno errado | ALTO (dado errado + agenda) | S | `lib/ronda.ts:117`, `components/ronda-form.tsx:374` | 006 |
| UX-03 | Agenda só reconhece hora exata e turno "Noite": ronda das 20:13 ou "Manhã" às 22:05 aparece como vazia; vazios passados aparecem como "Programada" | ALTO (supervisão do plantão) | S | `components/historico-rondas.tsx:77-82,190`; visto no celular | 006 |
| UX-11 | Responsável e base redigitados a cada abertura do formulário (só ficam em memória) | MED | S | `components/ronda-form.tsx:374`, `lerPrefill` sem responsável | 006 |
| UX-01 | Links com estilo de botão sem borda: `buttonVariants()` sem `cn()` deixa `border-transparent` vencer `border-border` | MED (inconsistência em todas as telas) | S | `ronda-form.tsx:613-624,701-707`; `historico-rondas.tsx:112-118,244-249`; `dashboard-facilities.tsx:382-389,739-743`; visto em captura | 007 |
| UX-09 | Jargão e texto desatualizado: "Banco Turso ativo", "Ronda no Turso", "…GPS…", "Close toast" | MED | S | `dashboard-facilities.tsx:94,110,233,401,508,727,771`; `ui/toast.tsx:126` | 007 |
| UX-12 | Formulário só tem `h1`: nomes de ambiente e cartões são `div`, leitor de tela não navega entre ambientes | MED (a11y) | S | `ui/card.tsx:35-43`; medido: 1 título na página | 007 |
| UX-14 | `body` com cores fixas em hexadecimal fora da camada de tokens; `.dark` definido mas inalcançável | LOW (bloqueia tema) | S | `app/globals.css:87-91,93-125` | 007 |
| UX-04 | Ronda salva aberta por "Abrir" parece uma ronda nova; "Finalizar" substitui o registro sem aviso | MED–ALTO | S | `ronda-form.tsx:356` (`persistido` nunca exibido), `:806-821` | 008 |
| UX-05 | Formulário com ~4.400 px no celular; único botão de ação no fim; atalhos sem estado e só no topo | MED–ALTO (uso em campo) | M | medido em 390 px; `ronda-form.tsx:699-709,806-821` | 009 |
| UX-06 | Personalização do checklist longe dos ambientes (select + input no fim), Enter não funciona, erros em aviso flutuante, sem remover | MED | M | `ronda-form.tsx:536-577,631,744-804` | 010 |
| UX-08 | Navegação inconsistente: três cabeçalhos feitos à mão com conjuntos e variantes diferentes, sem estado ativo; dashboard ainda tem sua própria lista de rondas (seção 04) duplicando `/historico` | MED | M | `ronda-form.tsx:603-629`, `historico-rondas.tsx:102-123`, `dashboard-facilities.tsx:369-399,700-768` | — (decidir o destino da seção 04) |
| UX-07 | Sem "Marcar tudo" por ambiente: 36 toques por ronda | MED | S | `AmbienteFields` | — (decisão: agiliza, mas facilita marcar sem verificar) |
| UX-10 | Base é texto livre no formulário e lista derivada dos dados na agenda: erro de digitação cria "base fantasma" que quebra agenda e dashboard | MED | S–M | `ronda-form.tsx:650-658`, `historico-rondas.tsx:61` | — (decidir a fonte da lista de bases) |
| UX-13 | Alvos de toque pequenos para uso em campo: 61 de 62 com menos de 40 px de altura (botões `sm` 32 px, select 36 px) | LOW–MED | S–M | medido no formulário | — |
| UX-15 | Ao finalizar com erro de validação, só o campo é focado no topo; nenhum aviso explica | LOW | S | `ronda-form.tsx:499` (`handleSubmit`) | — |
| UX-16 | Tabela de ocorrências do dashboard (7 colunas) rola na horizontal no celular | LOW | M | `dashboard-facilities.tsx:615-680` | — (dashboard é uso de escritório) |

### Direção (UI/UX)

- **D1. Modo escuro para o plantão noturno.** A agenda cobre 19h–07h e a paleta
  `.dark` já existe em `app/globals.css:93-125`, mas não há como ativá-la e o
  `body` tem cores fixas (UX-14). Seguir `prefers-color-scheme` (ou um
  seletor) reduz o brilho à noite. Esforço grosso: S–M depois do plano 007.
- **D2. App instalável e tolerante a falta de sinal (PWA).** O preenchimento já
  fica no aparelho (`lib/rascunho.ts`) e só vai ao banco ao finalizar; com
  manifesto e cache da casca, o formulário abriria sem rede e a finalização
  poderia esperar a conexão. Esforço grosso: M–L.
- **D3. Visualização somente leitura de rondas finalizadas**, com "Editar"
  explícito, em vez de abrir direto no formulário editável (complementa o
  plano 008). Esforço grosso: M.

### Considerado e rejeitado (UI/UX)

- Trocar `input type="date|time"` por `Calendar`/date picker do shadcn: os
  seletores nativos são melhores no celular, que é o uso principal.
- `ToggleGroup` para prioridade: o mantenedor pediu `Select`; não reaberto.
- Virtualizar a lista do histórico: limitada a 200 itens.
- `Button render={<Link/>} nativeButton={false}` para os links com estilo de
  botão: com `nativeButton={false}` o Base UI passa a tratar o elemento como
  botão (papel e teclado), o que pode apagar a semântica de link;
  `cn(buttonVariants(...))` resolve sem esse risco.

### Não auditado nesta rodada

Modo escuro (inalcançável hoje), estilos de impressão, teste com leitor de tela
real (só a árvore de acessibilidade), aparelhos físicos/uso com luvas,
contraste medido por ferramenta.

## Notas de dependência

- **003 → 001**: a verificação do 003 cria um banco SQLite de arquivo usando
  `scripts/migrate-turso.mjs`, que só funciona em banco novo depois do 001.
- **005 → 002**: o 005 usa o runner de testes (`pnpm test`) criado pelo 002.
- **002** deve entrar cedo: ele é a rede de segurança para qualquer refactor do
  parser de TXT legado (`lib/dashboard-txt.ts`).
- **004** ficou DEFERRED: o login será feito com better-auth (decisão do
  mantenedor). O plano só serve de paliativo se a aplicação precisar ser exposta
  antes disso; ao iniciar o better-auth, escreva um plano novo no lugar dele.
- 001, 002 e 003 são independentes entre si além da seta acima e podem rodar em
  branches separadas.

## Findings (vetados — evidência aberta e confirmada pelo advisor)

Ordenados por alavancagem (impacto ÷ esforço, descontada a confiança).

| # | Finding | Categoria | Impacto | Esforço | Risco do fix | Evidência | Plano |
|---|---------|-----------|---------|---------|--------------|-----------|-------|
| CORR-01 | `db:migrate:turso` falha em banco novo: `20261014_dashboard_imports` ordena antes de `20261014_init` | bug | ALTO (README passo 3 quebra) | S | MED (renomear migrações já aplicadas) | `scripts/migrate-turso.mjs:15-18`, `prisma/migrations/20261014_dashboard_imports/migration.sql:2-4` | 001 |
| DX-01 | Sem testes, sem `typecheck`, sem CI; parser de TXT (246 linhas de regex) sem cobertura | dx/tests | ALTO (bloqueia refactors seguros) | M | LOW | `package.json:5-13`, `lib/dashboard-txt.ts` | 002 |
| CORR-02 | `POST /api/rondas` não é idempotente: perda de resposta deixa o formulário preso em 500; JSON malformado vira 500 | bug | ALTO p/ uso em campo (rede móvel) | S | LOW | `components/ronda-form.tsx:394-417`, `app/api/rondas/route.ts:19-35`, `lib/ronda-db.ts:87` | 003 |
| SEC-01 | Nenhuma rota exige identidade; `DELETE /api/dashboard/imports` apaga todos os registros importados; dados com nomes e GPS lidos sem login (reconhecido em `README.md:21`) | segurança | ALTO se exposto | M | MED | `app/api/dashboard/imports/route.ts:5-16`, `app/api/rondas/[id]/route.ts:26-48`, `README.md:21` | 004 |
| SEC-02 | ~~CSV exportado não neutraliza células iniciadas por `=`, `+`, `-`, `@` (injeção de fórmula no Excel)~~ — **moot: CSV removido** | segurança | — | — | — | (era `components/dashboard-facilities.tsx:406`) | 005 (rejeitado) |

### Findings sem plano (ainda)

| # | Finding | Categoria | Impacto | Esforço | Risco | Evidência | Observação |
|---|---------|-----------|---------|---------|-------|-----------|------------|
| DUP-01 | Dois serializadores de TXT divergentes: o do dashboard (`textoRonda`) omite `Plantão iniciado em`, `GPS da ronda` e `Checklist: x/y` que o do formulário (`textoResumo`) emite → "Ver TXT" de ronda do formulário perde GPS e data do plantão | tech-debt/bug | MED | S–M | LOW | `components/ronda-form.tsx:183-214` × `components/dashboard-facilities.tsx:84-108` | Extrair `lib/ronda-txt.ts` + teste de ida-e-volta com `parsearRondaTXT`. Depende de 002. |
| PERF-01 | O dashboard carrega **todo** o banco (rondas + ambientes + tarefas + `conteudoTXT` de até 1 MB cada) e serializa tudo para o cliente; a lista de rondas renderiza todas sem paginação | perf | MED→ALTO conforme o histórico cresce | M | MED | `lib/dashboard-data.ts:6-14`, `app/dashboard/page.tsx:12-14`, `components/dashboard-facilities.tsx:854` | Tirar `conteudoTXT` do payload (buscar sob demanda), agregar indicadores no servidor, paginar. O botão "Backup completo" usa o array do cliente — precisa de endpoint de exportação (junto com PERF-03). |
| CORR-03 | "Salvar ronda" força `status: "Em andamento"` e todo save de ronda finalizada regrava `finalizadoEm = now`: editar uma ronda finalizada a reabre em silêncio e o horário real de finalização se perde | bug | MED (dado de auditoria) | S | LOW | `components/ronda-form.tsx:303`, `lib/ronda-db.ts:60` | **Precisa de decisão de produto**: reabrir pode ser intencional. `finalizadoEm` ainda não é exibido em lugar nenhum. |
| PERF-02 | Importação/restauração fazem escrita sequencial por ronda; cada ronda gera ~1 + N INSERTs (ambientes e tarefas) com ida e volta ao Turso; README promete até 500 rondas / 50 TXT por operação | perf | MED (risco de timeout em serverless) | M | MED | `app/api/dashboard/restore/route.ts:63-128`, `app/api/dashboard/import/route.ts:31-64`, `lib/ronda-db.ts:83-95` | Confiança MED: depende do batching do adaptador e do alvo de deploy (indefinido). Opção: lotes `createMany` em transação ou restauração em blocos pelo cliente. |
| CORR-04 | A importação de TXT lê `ID da ronda` mas grava a ronda com UUID aleatório; reimportar um TXT reexportado (hash diferente) de uma ronda que já foi importada cria duplicata, ao contrário do que o README sugere ("ignora duplicatas pelo ... ID da ronda") | bug | LOW–MED | S | LOW | `lib/dashboard-txt.ts:226-227,245`, `app/api/dashboard/import/route.ts:38-41` | Usar `origemId` como `id` quando for UUID válido. |
| CORR-05 | A restauração do formulário (`importarBackup`) sempre gera `id`s novos: reimportar o backup do próprio projeto duplica todas as rondas; o caminho do dashboard deduplica por `id` | bug | LOW–MED | S | LOW | `components/ronda-form.tsx:496`, `lib/ronda.ts:164` × `app/api/dashboard/restore/route.ts:66-67` | Dois caminhos de restauração com semânticas diferentes; unificar (formulário chamar `/api/dashboard/restore`). |
| PERF-03 | "Backup de todas as rondas" do formulário faz 1 `GET /api/rondas/[id]` por ronda, todos em paralelo (`Promise.all`); a importação faz 1 `POST` sequencial por ronda | perf | LOW–MED | S–M | LOW | `components/ronda-form.tsx:445-456,498-506` | Resolvido junto com PERF-01 (endpoint de exportação no servidor). |
| SEC-03 | Corpos de requisição são lidos por inteiro antes dos limites (`request.text()` e *depois* checa 20 MB; `request.json()` sem teto) | segurança | LOW (somente sem auth / já coberto por SEC-01) | S | LOW | `app/api/dashboard/restore/route.ts:45-47`, `app/api/dashboard/import/route.ts:22` | Checar `Content-Length` antes de ler; ou limite na borda. |
| DX-02 | (investigar, confiança LOW) `prisma.config.ts` usa `env("DATABASE_URL")`, o que pode derrubar `prisma generate` em CI/build sem a variável; `next.config.ts` liga `experimental.agentFeedback` incondicionalmente | dx | LOW | S | LOW | `prisma.config.ts:7`, `next.config.ts:6-8` | O plano 002 já testa o primeiro ponto (Passo 2). Segundo ponto: conferir na doc instalada do Next. |

## Direção (opções para o mantenedor — não competem com os bugs acima)

1. **Ciclo de vida da ocorrência.** O dashboard calcula "Urgentes — requerem
   atenção prioritária" (`components/dashboard-facilities.tsx:272-277`), mas
   uma ocorrência (`Ocorrencia`, `lib/dashboard-types.ts:10-21`) não tem estado
   nem responsável: não dá para marcar "resolvida" ou "encaminhada", então a
   contagem de urgentes só cresce. Evidência: tipo sem `status`; nenhum endpoint
   de escrita sobre ocorrências. Trade-off: exige modelar ocorrência como
   entidade (hoje é derivada de `Ambiente.observacao`), migração de dados e
   decisão de quem pode fechar. Esforço grosso: M–L.
2. **Rascunho tolerante a falha de rede** (mais urgente agora que só se grava
   ao finalizar). A ronda é preenchida em campo, no celular, e só chega ao banco
   no "Finalizar ronda"; não há rascunho local (`grep localStorage` não
   encontra nada), então fechar a aba ou perder o app no meio da ronda perde
   tudo. Trade-off: precisa de política de conflito entre rascunho local e
   versão do servidor (e de limpar o rascunho após finalizar). Esforço grosso: M.
3. **Checklist editável e por unidade.** O formulário permite *adicionar*
   ambiente/tarefa, mas não remover nem renomear
   (`components/ronda-form.tsx:849-909`), e o checklist padrão é fixo no código
   para uma unidade (`lib/ronda.ts:42-106`, `base` padrão "Paragominas"),
   embora `base` seja campo livre e exista índice `@@index([base, turno, data])`
   (`prisma/schema.prisma:33`). Trade-off: modelo de "modelo de checklist por
   unidade" muda o esquema e a UI de administração. Esforço grosso: M.

## Considerado e rejeitado

- **Pacote `cn` suspeito**: `lib/utils.ts` faz `export { cn } from "cn"`, em vez
  do usual `clsx` + `tailwind-merge`. Verificado no registro: `cn@0.4.0` é o
  pacote oficial `shadcn-ui/cn` (palavras-chave `tailwind-merge`, `clsx`) e
  `cn@0.2.6` vem como dependência do `shadcn@4.21.4`. Não é problema.
- **Advisory `braces` (alta) em `pnpm audit --prod`**: caminho
  `shadcn > fast-glob > micromatch > braces`. É a CLI do shadcn, usada só em
  tempo de build (`@import "shadcn/tailwind.css"`), fora do código de runtime do
  app; instalação padrão do shadcn v4 a põe em `dependencies`. Sem plano.
- **Segredos no histórico git**: varredura por padrões de token/URL do Turso em
  todos os commits só encontrou placeholders (`.env.example`, docs de skills).
  `.env` está no `.gitignore` e nunca foi versionado.
- **Condição de corrida na deduplicação** (checar-depois-criar na importação):
  o índice único em `hashTXT` e a PK de `id` fazem a corrida falhar com
  segurança (vira erro por arquivo/registro), sem duplicata.
- **`useWatch({ control })` no formulário inteiro**: re-renderiza a página a
  cada tecla, mas com o checklist padrão (9 ambientes × 4 tarefas) não é gargalo.
- **`import "server-only"` sem a dependência no `package.json`**: o Next resolve
  o módulo internamente; se não resolvesse, o build falharia de forma evidente.
  O `pnpm typecheck`/`build` do plano 002 confirma.
- **Data de fallback em UTC no parser de TXT** (`lib/dashboard-txt.ts:225`):
  só vale para TXT sem `Data:` e sem data no nome do arquivo; caso raro.
- **Rótulo "Ver TXT" que na verdade baixa o arquivo**: cosmético.

## O que NÃO foi auditado (e por quê)

- **Execução**: `node_modules` não existe e instalar é proibido no modo advisor,
  então `pnpm lint`, `pnpm typecheck` e `pnpm build` **não foram executados**;
  nenhum teste dinâmico contra o Turso foi feito. O estado verde/vermelho do lint
  atual é desconhecido (os planos pedem uma linha de base).
- **Documentação do Next 16.4 instalada** (`node_modules/next/dist/docs/`):
  inacessível; afirmações específicas do framework (`proxy.ts`, `next typegen`)
  nos planos 002 e 004 estão marcadas para conferência pelo executor.
- **Comportamento do Prisma 7 + adaptador libSQL**: aplicação de `ON DELETE
  CASCADE` e batching de nested writes não foram verificados.
- `components/ui/*` (936 linhas, geradas pelo shadcn) e `.agents/skills/**`
  (documentação de terceiros) — fora de escopo; nenhuma instrução embutida em
  arquivos do repo foi seguida.
- Alvo de deploy: indefinido no repo (sem Dockerfile, CI ou `vercel.json`);
  limites de corpo/tempo de função não puderam ser avaliados.

## Auditoria

Nível `standard`, feita diretamente pelo advisor (≈2,8 mil linhas próprias,
sem subagentes): `app/`, `lib/`, `components/ronda-form.tsx`,
`components/dashboard-facilities.tsx`, `prisma/`, `scripts/`, configs de raiz,
README, histórico git e `pnpm audit --prod`.
