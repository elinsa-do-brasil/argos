# Argos · Ronda de Facilities

Formulário React para a ronda de Facilities da Elinsa. Usa Next.js 16, componentes shadcn, React Hook Form, Zod, Prisma ORM 7 e Turso.

## Configuração

1. Instale as dependências com `pnpm install`.
2. Crie `.env` a partir de `.env.example` e informe `DATABASE_URL` (`libsql://...`) e `TURSO_TOKEN`. Nunca exponha o token no cliente.
3. Execute `pnpm db:migrate:turso` para criar as tabelas `Ronda`, `Ambiente` e `Tarefa` no banco indicado. O comando registra migrações aplicadas em `_argos_migrations` e pode ser executado novamente.
4. Execute `pnpm dev` e abra [http://localhost:3000](http://localhost:3000).

`pnpm dev` e `pnpm build` geram o Prisma Client antes de iniciar o Next.js. O client gerado fica fora do Git. O comando `prisma migrate deploy` apresentou erro de schema engine com a URL Turso `libsql:` neste ambiente; `pnpm db:migrate:turso` aplica, em transação, o SQL versionado em `prisma/migrations/`.

## Uso

O formulário em `/` salva e finaliza rondas no Turso. Permite histórico, agenda de plantão noturno, GPS, ambientes e tarefas adicionais, exportação TXT, compartilhamento e backups JSON. O campo de restauração aceita backups do formulário HTML original e cria novos registros no banco.

O dashboard em `/dashboard` mostra todas as rondas do Turso, indicadores, ocorrências por prioridade e ambiente, filtros, histórico e exportação CSV. Aceita um ou vários TXT do formulário antigo ou atual, ignora duplicatas pelo conteúdo ou ID da ronda e preserva o TXT original para download. Também exporta um backup JSON completo e restaura backups do dashboard HTML antigo ou do projeto. O botão **Remover importações TXT** apaga somente os registros importados; rondas preenchidas no formulário permanecem no banco. A importação aceita até 50 TXT de 1 MB por operação; a restauração aceita até 500 rondas em um JSON de 20 MB.

O endpoint de rondas ainda não tem autenticação, pois o projeto não possui usuários ou login. Configure autenticação e autorização antes de expor esta aplicação publicamente.

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
