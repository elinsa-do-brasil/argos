import { getAuth } from "@/lib/sextans/auth";

// Rotas do Better Auth deste app: o início do login e a volta do Sextans.
export const GET = (request: Request) => getAuth().handler(request);
export const POST = (request: Request) => getAuth().handler(request);
