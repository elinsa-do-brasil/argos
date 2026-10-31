import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  ID_TOKEN_HEADER,
  sextansConfig,
} from "@/lib/sextans/config";

export type Organization = { slug: string; role: string };

export type SextansUser = {
  /** ID da pessoa no Sextans: o mesmo em todos os apps. */
  id: string;
  name: string;
  email: string;
  /** As organizações da pessoa, do token mais recente (no máximo 15 minutos). */
  organizations: Organization[];
};

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

/**
 * Quem está usando o app, ou `null`. Vem do ID token que o proxy pôs no
 * pedido depois de conferir (e, se preciso, renovar) a sessão no Sextans; a
 * assinatura é conferida aqui, com as chaves públicas do Sextans. Só funciona
 * nas rotas que passam pelo proxy (veja o `matcher` do proxy.ts).
 *
 * É lida a cada pedido: com Cache Components (o padrão do create-next-app),
 * chame dentro de um componente envolto em `<Suspense>`.
 */
export async function getSession(): Promise<{ user: SextansUser } | null> {
  // A conferência do token depende da hora: fica fora de qualquer pré-render.
  await connection();
  const idToken = (await headers()).get(ID_TOKEN_HEADER);
  if (!idToken) return null;
  const config = sextansConfig();
  jwks ??= createRemoteJWKSet(new URL(`${config.issuer}/jwks`));
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: config.issuer,
      audience: config.clientId,
      clockTolerance: 30,
    }));
  } catch (error) {
    // Um token recusado costuma ser configuração: o SEXTANS_CLIENT_ID (aud) ou
    // o SEXTANS_URL (iss) diferentes do aplicativo cadastrado no Sextans.
    console.warn(
      `[sextans] O ID token não passou na conferência (${String((error as { code?: string })?.code ?? error).slice(0, 120)}). Confira SEXTANS_URL e SEXTANS_CLIENT_ID.`,
    );
    return null;
  }
  return {
    user: {
      id: String(payload.sub),
      name: String(payload.name ?? payload.email ?? ""),
      email: String(payload.email ?? ""),
      organizations: Array.isArray(payload.orgs)
        ? (payload.orgs as Organization[])
        : [],
    },
  };
}

/** A sessão, ou manda para a tela de entrar (voltando depois para `returnTo`). */
export async function requireSession(returnTo = "/") {
  const session = await getSession();
  if (!session) redirect(`/entrar?voltar=${encodeURIComponent(returnTo)}`);
  return session;
}

/**
 * A sessão de quem está em pelo menos uma das organizações; quem não está vai
 * para a tela de entrar com o aviso de sem acesso. Use nas páginas, layouts,
 * route handlers e server actions de áreas restritas: esconder o link não
 * protege nada.
 */
export async function requireOrganization(
  slugs: string | string[],
  returnTo = "/",
) {
  const session = await requireSession(returnTo);
  const allowed = Array.isArray(slugs) ? slugs : [slugs];
  if (!session.user.organizations.some((org) => allowed.includes(org.slug))) {
    redirect("/entrar?erro=sem-acesso");
  }
  return session;
}
