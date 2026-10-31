import { signOut } from "@/lib/sextans/actions";
import type { SextansUser } from "@/lib/sextans/session";
import { Button } from "@/components/ui/button";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (
      (parts[0]?.[0] ?? "") +
      (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
    ).toUpperCase() || "?"
  );
}

/**
 * Quem entrou e o botão de sair. Use num componente de servidor com a sessão
 * de `getSession()`:
 *
 *   const session = await getSession();
 *   {session && <MenuUsuario user={session.user} />}
 */
export function MenuUsuario({ user }: { user: SextansUser }) {
  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs"
      >
        {initials(user.name)}
      </div>
      <div className="hidden min-w-0 flex-col sm:flex">
        <span className="truncate font-medium text-sm">{user.name}</span>
        <span className="truncate text-muted-foreground text-xs">
          {user.email}
        </span>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          Sair
        </Button>
      </form>
    </div>
  );
}
