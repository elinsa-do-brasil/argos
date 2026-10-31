# Login pela conta Elinsa (kit `@elinsa/auth-kit`)

Estes arquivos vieram do registro `@elinsa` e ligam o app ao **Sextans**, o login central da Elinsa. Não edite aqui: para atualizar, rode `pnpm dlx shadcn@latest add @elinsa/auth-kit --overwrite` e revise o diff.

## O que falta fazer no app

1. **Variáveis** no `.env.local` (no servidor de produção, nas configurações dele):
   - `SEXTANS_URL`: o endereço do Sextans;
   - `SEXTANS_CLIENT_ID` e `SEXTANS_CLIENT_SECRET`: do aplicativo do app no Sextans. Quem está na equipe Desenvolvimento cria em **Minha conta → Meus aplicativos**, que já entrega o `.env.local` pronto; quem não está pede para entrar na equipe ali mesmo. O segredo fica só no servidor;
   - `BETTER_AUTH_SECRET`: gere um por app e por ambiente, com `openssl rand -hex 32`;
   - `BETTER_AUTH_URL`: a origem do app, sem barra no fim.

   O endereço de volta cadastrado no Sextans é `<BETTER_AUTH_URL>/api/auth/callback/sextans`, e o de depois de sair, `<BETTER_AUTH_URL>/`.

2. **`proxy.ts`** na raiz do app (troque `@/lib` pelo alias do app, se for outro):

   ```ts
   import type { NextRequest } from "next/server";
   import { sextansProxy } from "@/lib/sextans/proxy";

   export function proxy(request: NextRequest) {
     // Os caminhos que não pedem login (o /entrar já é aberto).
     return sextansProxy(request, { publicPaths: ["/"] });
   }

   export const config = {
     matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
   };
   ```

3. **Proteja no servidor** cada página, layout, route handler e server action restritos. O proxy é só a primeira barreira, e esconder um link não protege nada.
   - `requireSession(voltar)`: só quem entrou;
   - `requireOrganization("almoxarifado", voltar)`: só quem está na organização (ou numa da lista);
   - `getSession()`: a pessoa ou `null`, para mostrar quem entrou.

   Com Cache Components (o padrão do `create-next-app`), quem lê a sessão fica dentro de um `<Suspense>`:

   ```tsx
   import { Suspense } from "react";
   import { requireOrganization } from "@/lib/sextans/session";

   export default function EstoquePage() {
     return (
       <Suspense fallback={<p>Carregando…</p>}>
         <Estoque />
       </Suspense>
     );
   }

   async function Estoque() {
     const { user } = await requireOrganization("almoxarifado", "/estoque");
     return <p>Olá, {user.name}.</p>;
   }
   ```

4. **Menu do usuário**: `<MenuUsuario user={session.user} />`, com o botão de sair do app e do Sextans.

## Se algo der errado

O kit escreve no log do servidor do app, com `[sextans]` no começo, o motivo de cada recusa (sem token nem segredo):

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Volta para `/entrar` com "A sua sessão terminou" a cada 15 minutos, e o log diz `invalid_client` | `SEXTANS_CLIENT_ID` ou `SEXTANS_CLIENT_SECRET` errado (o segredo foi trocado no painel) | Gere um segredo novo na página do app e atualize o `.env.local` |
| O log diz que o ID token não passou na conferência (`aud` ou `iss`) | `SEXTANS_CLIENT_ID` ou `SEXTANS_URL` diferente do aplicativo cadastrado | Confira os dois valores com a página do app |
| "A sua conta não está liberada" | A pessoa não está em nenhuma organização exigida pelo app | Veja "Quem pode entrar" na página do app |
| Depois de "Sair", aparece "Logged out. The requested post-logout redirect was not registered." | O endereço depois de sair do app não é idêntico a `<BETTER_AUTH_URL>/` | Corrija em "Endereços depois de sair", na página do app |
| Fora de produção, a tela de entrar mostra "Código do erro" | O código vem do Better Auth (ex.: `state_mismatch` quando o login demorou demais) | Tente de novo; se repetir, veja o log |

## Como funciona

- A sessão do app é um cookie criptografado do próprio app, sem banco, e dura até 8 horas.
- A cada pedido, o proxy confere a sessão e, quando o token vence (15 minutos), renova no Sextans. Se o Sextans recusar (a pessoa saiu das organizações do app, foi bloqueada ou saiu da conta Elinsa), a sessão do app acaba e a pessoa volta a `/entrar` com um aviso.
- As organizações vêm do token mais recente. O proxy passa o token às páginas num cabeçalho interno, e `getSession()` confere a assinatura com as chaves públicas do Sextans.
- "Sair" encerra a sessão do app e a do Sextans e volta à página inicial.
