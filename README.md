# Argos · Ronda de Facilities

Formulário React para a ronda de Facilities da Elinsa. Usa Next.js 16, componentes shadcn, React Hook Form, Zod, Prisma ORM 7 e Turso.

## Configuração

1. Instale as dependências com `pnpm install`.
2. Crie `.env` a partir de `.env.example` e informe `DATABASE_URL` (`libsql://...`) e `TURSO_TOKEN`. Nunca exponha o token no cliente.
   Para salvar fotos, crie um bucket privado no Cloudflare R2, gere credenciais de API com permissão de leitura e gravação nesse bucket e configure `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` no servidor. Não use o prefixo `NEXT_PUBLIC_` nessas variáveis.
3. Execute `pnpm db:migrate:turso` para criar as tabelas `Ronda`, `Ambiente` e `Tarefa` no banco indicado. O comando registra migrações aplicadas em `_argos_migrations` e pode ser executado novamente. As pastas em `prisma/migrations/` usam o prefixo `AAAAMMDDHHMMSS_` e são aplicadas em ordem alfabética.
   Execute `pnpm db:add-photos` para acrescentar `Ambiente.fotosJson` ao banco existente. O comando verifica se a coluna já existe antes de alterá-la.
4. Execute `pnpm dev` e abra [http://localhost:3000](http://localhost:3000).

`pnpm dev` e `pnpm build` geram o Prisma Client antes de iniciar o Next.js. O client gerado fica fora do Git. O comando `prisma migrate deploy` apresentou erro de schema engine com a URL Turso `libsql:` neste ambiente; `pnpm db:migrate:turso` aplica, em transação, o SQL versionado em `prisma/migrations/`.

## Uso

O formulário em `/` grava a ronda no Turso ao finalizá-la; a ronda existe somente no banco de dados, sem exportação de arquivos nem compartilhamento. Traz o checklist padrão por ambiente, ocorrências opcionais (prioridade e descrição) por ambiente, observações gerais e ambientes e tarefas adicionais. Uma barra no topo da tela mostra o preenchimento. Enquanto a ronda não é finalizada, o preenchimento fica guardado no navegador (`localStorage`) e volta se a página for fechada ou recarregada; ele é apagado ao finalizar ou ao iniciar uma nova ronda.

Cada ocorrência aceita até cinco fotos JPG, PNG ou WebP de até 10 MB na seleção. O navegador converte e reduz as imagens para JPEG de até 180 KB antes de salvar. Ao finalizar a ronda, o servidor envia as fotos ao R2 e grava somente as chaves em `Ambiente.fotosJson`; fotos antigas que já estejam salvas como `dataUrl` continuam legíveis. A visualização e o download das fotos do R2 passam por `/api/fotos/...`, mantendo o bucket privado. Se o R2 falhar, a ronda não é salva e o rascunho permanece no navegador. Remover uma foto da ronda também a remove do R2 após a gravação no banco.

Regras da ronda:

- **Turno inicial pelo horário**: em dias úteis, Manhã (07h–13h), Tarde (13h–19h) e Noite (19h–07h). Sábado e domingo têm plantão de dia todo (turno "Dia todo"), das 07h às 07h do dia seguinte; a madrugada pertence ao plantão do dia anterior. As faixas ficam em `lib/ronda.ts`.
- **Bases**: a lista de unidades é a constante `BASES` em `lib/ronda.ts`.
- **Edição**: uma ronda pode ser alterada por até 10 minutos depois de salva (`PRAZO_EDICAO_MINUTOS`); depois abre somente para leitura. O servidor recusa alterações fora do prazo (HTTP 409).
- O formulário lembra o último responsável e a base neste aparelho.
- Cada ambiente tem "Marcar tudo", adição de tarefas e ocorrência opcional.

O histórico em `/historico` traz a agenda do plantão (dias úteis: 19h às 07h; fim de semana: dia todo) e as rondas salvas. Cada horário abre a ronda existente ou inicia uma nova já preenchida.

O tema claro, escuro ou do sistema é escolhido pelo botão de tema no cabeçalho (`next-themes`).

O dashboard em `/dashboard` mostra todas as rondas do Turso, indicadores, ocorrências por prioridade e ambiente, filtros e histórico. Aceita um ou vários TXT do formulário antigo, ignora duplicatas pelo conteúdo ou ID da ronda e guarda o TXT original junto ao registro. O botão **Remover importações TXT** apaga somente os registros importados; rondas preenchidas no formulário permanecem no banco. A importação aceita até 50 TXT de 1 MB por operação. O backup das rondas é responsabilidade do banco de dados (Turso); a aplicação não exporta nem restaura arquivos.

## Login com a Conta da Elinsa

O Dashboard em `/dashboard` e todas as APIs em `/api/dashboard/*` exigem login pela Conta da Elinsa, usando o kit `@elinsa/auth-kit` (Better Auth e Sextans, sem banco de sessões). A página valida a sessão no servidor antes de consultar as rondas. As APIs também validam a sessão e devolvem HTTP 401 em JSON quando ela não é válida. O formulário, o histórico e suas APIs continuam públicos.

Configure no `.env.local` as variáveis `SEXTANS_URL`, `SEXTANS_CLIENT_ID`, `SEXTANS_CLIENT_SECRET`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`, conforme `.env.example`. Gere um `BETTER_AUTH_SECRET` exclusivo por ambiente. Todos esses valores ficam somente no servidor; nunca use `NEXT_PUBLIC_`. Reinicie o servidor depois de alterar as variáveis.

No aplicativo **Argos** no Sextans, cadastre:

- Retorno do login: `http://localhost:3000/api/auth/callback/sextans`.
- Retorno depois de sair: `http://localhost:3000/`.
- As organizações autorizadas a entrar e a opção de desenvolvimento para aceitar localhost.

Em produção, use a origem HTTPS real em `BETTER_AUTH_URL` e cadastre os mesmos caminhos de retorno nessa origem. A porta precisa coincidir com a usada pelo app.

Ao abrir o Dashboard sem sessão, o app encaminha para `/entrar?voltar=...`. O botão **Entrar com a conta Elinsa** inicia o login e retorna ao destino solicitado; abrir `/entrar` diretamente retorna ao Dashboard. O cabeçalho mostra quem entrou e oferece **Sair**, que encerra a sessão do app e a do Sextans. As organizações permitidas são definidas no aplicativo do Sextans.

O registro `@elinsa` já está configurado em `components.json`. Para atualizar o kit, guarde o token pessoal `ELINSA_REGISTRY_TOKEN` no `.env.local` e use `pnpm dlx shadcn@latest add @elinsa/auth-kit --diff`; preserve as adaptações locais de `/entrar`. O token não é necessário para executar o app. Os arquivos do conector e sua documentação ficam em `lib/sextans/`.

## Comandos

- `pnpm db:generate`: gera o Prisma Client.
- `pnpm db:migrate:turso`: aplica as migrações no Turso.
- `pnpm db:add-photos`: adiciona a coluna de fotos ao Turso, se necessário.
- `pnpm dev`: inicia o servidor de desenvolvimento.
- `pnpm build`: gera a versão de produção.
- `pnpm start`: inicia a versão de produção.
- `pnpm lint`: verifica o código com Biome.

## Referências

- [Prisma ORM 7 com SQLite e Turso](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/sqlite)
- [Prisma Client e adaptadores](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
- [Turso com Prisma](https://docs.turso.tech/sdk/ts/orm/prisma)
- [Cloudflare R2 com AWS SDK para JavaScript](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
