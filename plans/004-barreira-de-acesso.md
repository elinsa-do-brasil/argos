# Plano 004: Proteger páginas e API com uma barreira de acesso (senha compartilhada)

> **ADIADO — decisão do mantenedor (2026-10-14).** O login será implementado
> com **better-auth**, em uma etapa posterior. Este plano descreve só uma
> barreira **paliativa** (senha única compartilhada via HTTP Basic) e fica como
> opção caso a aplicação precise ser exposta antes do login existir. Quando o
> trabalho do better-auth começar, substitua este plano por um plano de
> autenticação por usuário (sessão, proteção de páginas e das rotas
> `app/api/**`, e autorização por rota).
>
> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Antes de escrever código**: o `AGENTS.md` do repo avisa que este Next.js
> (16.4) tem mudanças incompatíveis com o que você conhece. Em 16, o antigo
> `middleware.ts` foi renomeado/substituído por `proxy.ts` — **confirme** o nome
> do arquivo, a assinatura exportada e o formato do `matcher` lendo
> `node_modules/next/dist/docs/` (procure por `proxy`) antes de escrever o
> arquivo. Onde a documentação instalada divergir deste plano, ela vence.
>
> **Checagem de drift (rode primeiro)**:
> `git diff --stat 2cd8087..HEAD -- app README.md .env.example next.config.ts`
> Se algum arquivo do escopo mudou, compare os trechos de "Estado atual" com o
> código vivo; se divergirem, trate como condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: MED (pode bloquear o acesso legítimo se mal configurada)
- **Depende de**: nenhum (decisão do mantenedor)
- **Categoria**: security
- **Planejado em**: commit `2cd8087`, 2026-10-14

## Por que importa

Nenhuma rota exige identidade. Quem alcançar a aplicação pode: ler todas as
rondas (nomes de responsáveis e coordenadas GPS) em `/dashboard` e
`GET /api/rondas*`; sobrescrever rondas via `PUT /api/rondas/[id]`; inserir
dados via `POST /api/dashboard/import|restore`; e apagar todos os registros
importados com um único `DELETE /api/dashboard/imports`. O README (linha 21)
reconhece a lacuna ("Configure autenticação e autorização antes de expor esta
aplicação publicamente") mas nada no código impede a exposição. Uma barreira na
borda (um único arquivo) fecha o buraco sem tocar nos handlers.

## Estado atual

- Não existe `proxy.ts`/`middleware.ts` na raiz; `app/` contém `page.tsx`,
  `dashboard/page.tsx` e as rotas `app/api/rondas/**`, `app/api/dashboard/**`.
- Rotas destrutivas sem checagem:
  - `app/api/dashboard/imports/route.ts:5-16` — `DELETE` →
    `prisma.ronda.deleteMany({ where: { hashTXT: { not: null } } })`
  - `app/api/dashboard/imports/[id]/route.ts` — `DELETE` por id
  - `app/api/rondas/[id]/route.ts` — `PUT`
  - `app/api/dashboard/import/route.ts`, `app/api/dashboard/restore/route.ts` — `POST`
- `README.md:21`:
  > O endpoint de rondas ainda não tem autenticação, pois o projeto não possui
  > usuários ou login. Configure autenticação e autorização antes de expor esta
  > aplicação publicamente.
- `.env.example` hoje:
  ```
  DATABASE_URL="libsql://seu-banco.turso.io"
  TURSO_TOKEN="seu-token"
  ```
- Os componentes do cliente fazem `fetch("/api/...")` same-origin; navegadores
  reenviam automaticamente as credenciais Basic já aceitas para a mesma origem,
  então **nenhum código de cliente precisa mudar**.
- Convenções: PT-BR em mensagens e identificadores, aspas duplas, 2 espaços,
  Biome (`pnpm lint`).

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Build | `pnpm build` | exit 0 |
| Lint (arquivos tocados) | `pnpm exec biome check proxy.ts` | exit 0 |

## Escopo

**Dentro do escopo**:

- `proxy.ts` (criar, na raiz — ou o nome que a documentação instalada exigir)
- `.env.example` (uma linha)
- `README.md` (substituir o parágrafo da linha 21 e listar a variável)

**Fora do escopo** (NÃO toque):

- Os route handlers em `app/api/**` e os componentes — a barreira é externa a eles.
- `.env` real (nunca leia nem imprima).
- Qualquer modelo de usuários/sessões/OAuth — é o follow-up, não este plano.

## Fluxo Git

- Branch: `advisor/004-barreira-de-acesso`
- Commit sugerido: `feat(seguranca): protege páginas e API com senha compartilhada`
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: criar `proxy.ts`

Comportamento exigido:

1. Lê `process.env.ARGOS_ACCESS_PASSWORD`.
2. **Variável ausente**: em `NODE_ENV === "production"` responde `503` com texto
   `Acesso não configurado.` (falha fechada); fora de produção deixa passar
   (desenvolvimento local continua simples).
3. **Variável presente**: exige cabeçalho `Authorization: Basic ...`; o usuário é
   ignorado e a senha (tudo após o primeiro `:`) é comparada com a variável.
   Sem cabeçalho ou senha errada → `401` com
   `WWW-Authenticate: Basic realm="Argos", charset="UTF-8"`.
4. Comparação em tempo constante: aplique SHA-256 (Web Crypto
   `crypto.subtle.digest`) às duas strings e compare os digests com acumulador
   XOR — funciona em qualquer runtime do proxy.
5. O `matcher` cobre tudo **exceto** `_next/static`, `_next/image` e
   `favicon.ico`.

Forma-alvo (ajuste nome/assinatura/matcher ao que a documentação instalada
mandar):

```ts
import { type NextRequest, NextResponse } from "next/server";

async function sha256(valor: string) {
  const bytes = new TextEncoder().encode(valor);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

async function senhaConfere(informada: string, esperada: string) {
  const [a, b] = await Promise.all([sha256(informada), sha256(esperada)]);
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

function senhaDoCabecalho(cabecalho: string) {
  if (!cabecalho.startsWith("Basic ")) return null;
  try {
    const binario = atob(cabecalho.slice(6));
    const texto = new TextDecoder().decode(
      Uint8Array.from(binario, (c) => c.charCodeAt(0)),
    );
    return texto.slice(texto.indexOf(":") + 1);
  } catch {
    return null; // Base64 inválido: tratado como credencial ausente.
  }
}

export async function proxy(request: NextRequest) {
  const esperada = process.env.ARGOS_ACCESS_PASSWORD;
  if (!esperada) {
    if (process.env.NODE_ENV === "production")
      return new NextResponse("Acesso não configurado.", { status: 503 });
    return NextResponse.next();
  }
  const senha = senhaDoCabecalho(request.headers.get("authorization") ?? "");
  if (senha !== null && (await senhaConfere(senha, esperada)))
    return NextResponse.next();
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Argos", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Verificar**: `pnpm exec biome check proxy.ts` → exit 0.

### Passo 2: documentar a variável

- `.env.example`: acrescente `ARGOS_ACCESS_PASSWORD="troque-esta-senha"`.
- `README.md`: substitua o parágrafo da linha 21 por um texto que diga que o
  acesso é protegido por senha compartilhada definida em
  `ARGOS_ACCESS_PASSWORD` (obrigatória em produção; sem ela o servidor responde
  503) e que isso **não** substitui login por usuário.

**Verificar**: `grep -n "ARGOS_ACCESS_PASSWORD" README.md .env.example` → ao
menos 1 ocorrência em cada arquivo.

### Passo 3: verificação ponta a ponta (sem tocar no Turso)

A página `/` não consulta o banco, então não é preciso `DATABASE_URL` válida
para estas checagens. Não rode requisições autenticadas contra rotas `/api`
que usem o banco.

Se o `pnpm build` falhar pedindo `DATABASE_URL` (o `prisma generate` lê essa
variável), rode-o como `DATABASE_URL=file:./placeholder.db pnpm build` — nunca
com a URL do Turso real.

```bash
pnpm build
export PORT=3112
ARGOS_ACCESS_PASSWORD=segredo-de-teste ./node_modules/.bin/next start --port $PORT > /tmp/argos-004.log 2>&1 &
SERVER_PID=$!
sleep 6
for args in "localhost:$PORT/api/rondas" "-X DELETE localhost:$PORT/api/dashboard/imports" "-u x:errada localhost:$PORT/" "-u x:segredo-de-teste localhost:$PORT/"; do
  curl -s -o /dev/null -w '%{http_code}\n' $args
done
kill $SERVER_PID
unset PORT
```

**Verificar** (quatro linhas, nesta ordem): `401`, `401`, `401`, `200`.

Agora sem a variável, em produção:

```bash
PORT=3112 ./node_modules/.bin/next start --port 3112 > /tmp/argos-004b.log 2>&1 &
SERVER_PID=$!
sleep 6
curl -s -o /dev/null -w '%{http_code}\n' localhost:3112/
kill $SERVER_PID
```

**Verificar**: `503`. (Se `ARGOS_ACCESS_PASSWORD` estiver exportada na sua shell,
rode `env -u ARGOS_ACCESS_PASSWORD ...`.)

## Plano de testes

Sem testes automatizados (o roteiro do Passo 3 é a verificação ponta a ponta).
Se o plano 002 já tiver sido aplicado e você extrair `senhaDoCabecalho` /
`senhaConfere` para `lib/acesso.ts`, adicione `lib/acesso.test.ts` cobrindo:
senha correta, senha errada, cabeçalho sem `Basic `, Base64 inválido, senha com
`:` e com caractere não-ASCII — mas isso é opcional neste plano.

## Critérios de pronto

Todos devem valer:

- [ ] Passo 3 imprime `401 401 401 200` e depois `503`
- [ ] `pnpm build` sai com 0
- [ ] `pnpm exec biome check proxy.ts` sai com 0
- [ ] `git status` mostra só `proxy.ts`, `.env.example` e `README.md`
- [ ] Nenhum valor real de senha/token foi escrito em arquivo versionado
- [ ] Linha do plano 004 atualizada em `plans/README.md`

## Condições de PARADA

Pare e reporte (sem improvisar) se:

- A documentação instalada indicar que `proxy.ts` não é o mecanismo correto
  nesta versão do Next, ou que ele não intercepta rotas de API.
- Os trechos de "Estado atual" não baterem com o código vivo.
- Você precisar editar route handlers ou componentes para a barreira funcionar.
- O mantenedor não tiver confirmado o modelo (veja o aviso no topo).

## Notas de manutenção

- Senha única compartilhada não identifica quem fez a ação nem permite revogar
  acesso individual. Se houver mais de um perfil (ex.: só leitura no dashboard vs.
  edição), o próximo passo é login por usuário (sessão assinada) e checagem de
  autorização **por rota** — o `proxy` não substitui isso.
- A senha trafega em Base64: só use sob HTTPS.
- O navegador guarda a credencial Basic por sessão; não há "sair". Aceitável
  para o paliativo.
- Revisor: confirme que `_next/static` fica fora do `matcher` (senão o CSS/JS
  falha antes do prompt de senha) e que a ausência da variável em produção
  falha fechado.
