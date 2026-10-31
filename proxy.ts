import { type NextRequest, NextResponse } from "next/server";
import { sextansProxy } from "@/lib/sextans/proxy";

export async function proxy(request: NextRequest) {
  const response = await sextansProxy(request, {
    publicPaths: ["/", "/historico", "/api/rondas", "/api/fotos"],
  });

  // As APIs recebem JSON, inclusive quando a renovação encerra a sessão.
  const { pathname } = request.nextUrl;
  if (
    (pathname === "/api/dashboard" || pathname.startsWith("/api/dashboard/")) &&
    response.headers.has("location")
  ) {
    const unauthorized = NextResponse.json(
      { error: "Entre com a Conta da Elinsa para acessar o Dashboard." },
      { status: 401 },
    );
    for (const cookie of response.headers.getSetCookie()) {
      unauthorized.headers.append("set-cookie", cookie);
    }
    return unauthorized;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon(?:/|\\.)|e\\.(?:svg|png|ico)$|mapas/).*)",
  ],
};
