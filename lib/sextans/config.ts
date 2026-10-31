export const SEXTANS_PROVIDER_ID = "sextans";

/**
 * Tempo máximo da sessão deste app. Depois dele, a pessoa passa de novo pelo
 * Sextans (sem digitar nada, se a conta Elinsa ainda estiver aberta).
 */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Cabeçalho interno com o ID token mais recente, posto pelo proxy. */
export const ID_TOKEN_HEADER = "x-sextans-id-token";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Defina ${name} no .env do app (veja o README do @elinsa/auth-kit).`,
    );
  }
  return value;
}

export function sextansConfig() {
  const sextansUrl = required("SEXTANS_URL").replace(/\/$/, "");
  return {
    sextansUrl,
    issuer: `${sextansUrl}/api/auth`,
    clientId: required("SEXTANS_CLIENT_ID"),
    clientSecret: required("SEXTANS_CLIENT_SECRET"),
    appUrl: required("BETTER_AUTH_URL").replace(/\/$/, ""),
    secret: required("BETTER_AUTH_SECRET"),
  };
}
