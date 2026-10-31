import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import {
  SESSION_MAX_AGE_SECONDS,
  SEXTANS_PROVIDER_ID,
  sextansConfig,
} from "@/lib/sextans/config";

function createAuth() {
  const config = sextansConfig();
  return betterAuth({
    baseURL: config.appUrl,
    secret: config.secret,
    // Sem banco: a sessão e os tokens do Sextans ficam em cookies
    // criptografados deste app, que duram no máximo SESSION_MAX_AGE_SECONDS.
    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
      cookieCache: {
        enabled: true,
        strategy: "jwe",
        maxAge: SESSION_MAX_AGE_SECONDS,
        refreshCache: false,
      },
    },
    account: { storeStateStrategy: "cookie", storeAccountCookie: true },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: SEXTANS_PROVIDER_ID,
            discoveryUrl: `${config.issuer}/.well-known/openid-configuration`,
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            tokenEndpointAuth: { method: "client_secret_basic" },
            scopes: ["openid", "profile", "email", "offline_access"],
            pkce: true,
            requireIdTokenVerification: true,
          },
        ],
      }),
      // Aplica os cookies do Better Auth em server actions (precisa ser o último).
      nextCookies(),
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

/** O Better Auth deste app (criado na primeira chamada, já com o .env lido). */
export function getAuth() {
  auth ??= createAuth();
  return auth;
}
