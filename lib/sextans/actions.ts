"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/sextans/auth";
import { sextansConfig } from "@/lib/sextans/config";

/**
 * Sai deste app e da conta Elinsa (o Sextans encerra a sessão dele e volta
 * para a página inicial do app, que precisa estar cadastrada como endereço
 * depois de sair).
 */
export async function signOut() {
  const auth = getAuth();
  const config = sextansConfig();
  const requestHeaders = await headers();
  let idToken: string | undefined;
  try {
    ({ idToken } = await auth.api.getAccessToken({
      body: { useAccountCookie: true },
      headers: requestHeaders,
    }));
  } catch {
    // Sem tokens válidos: sai só deste app.
  }
  await auth.api.signOut({ headers: requestHeaders });

  const url = new URL(`${config.issuer}/oauth2/end-session`);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  url.searchParams.set("post_logout_redirect_uri", `${config.appUrl}/`);
  redirect(url.toString());
}
