"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/sextans/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MESSAGES: Record<string, string> = {
  "sem-acesso":
    "A sua conta não está liberada para esta área. Peça o acesso à TI.",
  "sessao-encerrada": "A sua sessão terminou. Entre de novo.",
  "sem-conexao": "Não foi possível falar com a conta Elinsa. Tente de novo.",
  falha: "Não foi possível entrar. Tente de novo.",
};

/** Para onde voltar depois de entrar: só caminhos deste app. */
function returnPath(value: string | null) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }
  return value;
}

export default function EntrarPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      {/* A URL (?erro=, ?voltar=) só existe no navegador: o cartão espera por ela. */}
      <Suspense fallback={<EntrarCard busy />}>
        <Entrar />
      </Suspense>
    </main>
  );
}

function Entrar() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  // ?erro= vem do kit (proxy e session.ts); ?error= vem do Better Auth.
  const betterAuthError = params.get("error");
  const error = connectionFailed
    ? "sem-conexao"
    : (params.get("erro") ?? (betterAuthError ? "falha" : null));

  async function signIn() {
    setBusy(true);
    setConnectionFailed(false);
    const { error } = await authClient.signIn.social({
      provider: "sextans",
      callbackURL: returnPath(params.get("voltar")),
      errorCallbackURL: "/entrar",
    });
    // Sem erro, o navegador já está indo para a conta Elinsa.
    if (error) {
      setBusy(false);
      setConnectionFailed(true);
    }
  }

  return (
    <EntrarCard
      busy={busy}
      onSignIn={signIn}
      message={error ? (MESSAGES[error] ?? MESSAGES.falha) : null}
      // Fora de produção, o código do Better Auth ajuda a achar o problema
      // (ex.: invalid_client, state_mismatch).
      code={process.env.NODE_ENV !== "production" ? betterAuthError : null}
      showBack={error === "sem-acesso"}
    />
  );
}

function EntrarCard({
  busy,
  onSignIn,
  message,
  code,
  showBack,
}: {
  busy: boolean;
  onSignIn?: () => void;
  message?: string | null;
  code?: string | null;
  showBack?: boolean;
}) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>
          Use a sua conta Elinsa: o e-mail da empresa, a passkey ou a conta
          Microsoft.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {message && (
          <p role="alert" className="text-destructive text-sm">
            {message}
            {code && (
              <span className="mt-1 block text-muted-foreground text-xs">
                Código do erro: {code}
              </span>
            )}
          </p>
        )}
        <Button onClick={onSignIn} disabled={busy || !onSignIn}>
          {busy && onSignIn
            ? "Abrindo a conta Elinsa…"
            : "Entrar com a conta Elinsa"}
        </Button>
        {showBack && (
          <Link
            href="/"
            className="text-center text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            Voltar para o início
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
