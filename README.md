# Argos · Ronda de Facilities

Formulário React para a ronda de Facilities da Elinsa. Usa Next.js 16, componentes shadcn, React Hook Form, Zod, Prisma ORM 7 e Turso.

## Configuração

1. Instale as dependências com `pnpm install`.
2. Crie `.env` a partir de `.env.example` e informe `DATABASE_URL` (`libsql://...`) e `TURSO_TOKEN`. Nunca exponha o token no cliente.
3. Execute `pnpm db:migrate:turso` para criar as tabelas `Ronda`, `Ambiente` e `Tarefa` no banco indicado. O comando registra migrações aplicadas em `_argos_migrations` e pode ser executado novamente. As pastas em `prisma/migrations/` usam o prefixo `AAAAMMDDHHMMSS_` e são aplicadas em ordem alfabética.
4. Execute `pnpm dev` e abra [http://localhost:3000](http://localhost:3000).

`pnpm dev` e `pnpm build` geram o Prisma Client antes de iniciar o Next.js. O client gerado fica fora do Git. O comando `prisma migrate deploy` apresentou erro de schema engine com a URL Turso `libsql:` neste ambiente; `pnpm db:migrate:turso` aplica, em transação, o SQL versionado em `prisma/migrations/`.

## Uso

O formulário em `/` grava a ronda no Turso ao finalizá-la; a ronda existe somente no banco de dados, sem exportação de arquivos nem compartilhamento. Traz o checklist padrão por ambiente, ocorrências opcionais (prioridade e descrição) por ambiente, observações gerais e ambientes e tarefas adicionais. Uma barra no topo da tela mostra o preenchimento. Enquanto a ronda não é finalizada, o preenchimento fica guardado no navegador (`localStorage`) e volta se a página for fechada ou recarregada; ele é apagado ao finalizar ou ao iniciar uma nova ronda.

Regras da ronda:

- **Turno inicial pelo horário**: em dias úteis, Manhã (07h–13h), Tarde (13h–19h) e Noite (19h–07h). Sábado e domingo têm plantão de dia todo (turno "Dia todo"), das 07h às 07h do dia seguinte; a madrugada pertence ao plantão do dia anterior. As faixas ficam em `lib/ronda.ts`.
- **Bases**: a lista de unidades é a constante `BASES` em `lib/ronda.ts`.
- **Edição**: uma ronda pode ser alterada por até 10 minutos depois de salva (`PRAZO_EDICAO_MINUTOS`); depois abre somente para leitura. O servidor recusa alterações fora do prazo (HTTP 409).
- O formulário lembra o último responsável e a base neste aparelho.
- Cada ambiente tem "Marcar tudo", adição de tarefas e ocorrência opcional.

O histórico em `/historico` traz a agenda do plantão (dias úteis: 19h às 07h; fim de semana: dia todo) e as rondas salvas. Cada horário abre a ronda existente ou inicia uma nova já preenchida.

O tema claro, escuro ou do sistema é escolhido pelo botão de tema no cabeçalho (`next-themes`).

O dashboard em `/dashboard` mostra todas as rondas do Turso, indicadores, ocorrências por prioridade e ambiente, filtros e histórico. Aceita um ou vários TXT do formulário antigo, ignora duplicatas pelo conteúdo ou ID da ronda e guarda o TXT original junto ao registro. O botão **Remover importações TXT** apaga somente os registros importados; rondas preenchidas no formulário permanecem no banco. A importação aceita até 50 TXT de 1 MB por operação. O backup das rondas é responsabilidade do banco de dados (Turso); a aplicação não exporta nem restaura arquivos.

O projeto ainda não tem autenticação: nenhuma rota exige login. O login será implementado com [better-auth](https://www.better-auth.com/) em uma etapa posterior; até lá, não exponha esta aplicação publicamente.

## Comandos

- `pnpm db:generate`: gera o Prisma Client.
- `pnpm db:migrate:turso`: aplica as migrações no Turso.
- `pnpm dev`: inicia o servidor de desenvolvimento.
- `pnpm build`: gera a versão de produção.
- `pnpm start`: inicia a versão de produção.
- `pnpm lint`: verifica o código com Biome.

## Referências

- [Prisma ORM 7 com SQLite e Turso](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/sqlite)
- [Prisma Client e adaptadores](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
- [Turso com Prisma](https://docs.turso.tech/sdk/ts/orm/prisma)
