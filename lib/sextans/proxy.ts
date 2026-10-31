import { type NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/sextans/auth";
import { ID_TOKEN_HEADER } from "@/lib/sextans/config";

/** Caminhos que nunca pedem login (as rotas do Better Auth se cuidam sozinhas). */
const ALWAYS_PUBLIC = ["/entrar"];

/**
 * Chame no `proxy.ts` do app. Em cada pedido de uma rota protegida:
 * - sem sessão, manda para /entrar (voltando depois para onde a pessoa ia);
 * - com sessão, renova os tokens no Sextans quando eles vencem (a cada 15
 *   minutos). Se o Sextans recusar (a pessoa saiu da organização, foi
 *   bloqueada ou saiu da conta Elinsa), a sessão do app acaba;
 * - passa o ID token mais recente para as páginas (veja session.ts).
 *
 * `publicPaths`: caminhos do app que não pedem login (ex.: ["/", "/sobre"]).
 */
export async function sextansProxy(
  request: NextRequest,
  { publicPaths = [] }: { publicPaths?: string[] } = {},
) {
  const { pathname } = request.nextUrl;
  // O cabeçalho do ID token só vale quando é o proxy que o põe.
  const forwarded = new Headers(request.headers);
  forwarded.delete(ID_TOKEN_HEADER);
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next({ request: { headers: forwarded } });
  }

  const isPublic = [...ALWAYS_PUBLIC, ...publicPaths].some(
    (path) =>
      pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    if (isPublic) return NextResponse.next({ request: { headers: forwarded } });
    return signInRedirect(request);
  }

  try {
    const { response: tokens, headers: authHeaders } =
      await auth.api.getAccessToken({
        body: { useAccountCookie: true },
        headers: request.headers,
        returnHeaders: true,
      });
    if (tokens.idToken) forwarded.set(ID_TOKEN_HEADER, tokens.idToken);
    const response = NextResponse.next({ request: { headers: forwarded } });
    for (const cookie of authHeaders.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    // O Sextans recusou a renovação: a sessão deste app acaba aqui. O motivo
    // vai para o log do servidor (sem token), para o dev saber o porquê.
    console.warn(`[sextans] ${renewalFailure(error)}`);
    const response = signInRedirect(request, "sessao-encerrada");
    const { headers: signOutHeaders } = await auth.api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });
    for (const cookie of signOutHeaders.getSetCookie()) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  }
}

function signInRedirect(request: NextRequest, error?: string) {
  const url = new URL("/entrar", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/entrar") url.searchParams.set("voltar", pathname + search);
  if (error) url.searchParams.set("erro", error);
  return NextResponse.redirect(url);
}

/**
 * O motivo de uma renovação recusada, numa linha, para o log do servidor.
 * Nunca leva token nem segredo: só o código do erro e uma dica.
 */
function renewalFailure(error: unknown) {
  const details = error as {
    message?: string;
    body?: { code?: string; message?: string; error?: string };
  };
  const reason = String(
    details?.body?.error ??
      details?.body?.code ??
      details?.body?.message ??
      details?.message ??
      error,
  ).slice(0, 200);
  const hint = /invalid_client|unauthorized_client|401/i.test(reason)
    ? " Confira SEXTANS_CLIENT_ID e SEXTANS_CLIENT_SECRET (o segredo pode ter sido trocado no painel)."
    : /invalid_grant|access_denied|403/i.test(reason)
      ? " A pessoa saiu das organizações do app, foi bloqueada ou saiu da conta Elinsa."
      : "";
  return `A renovação no Sextans foi recusada (${reason}); a sessão do app acabou.${hint}`;
}
