# Plano 003: Tornar o salvamento de ronda idempotente e responder 400 para JSON malformado

> **Instruções ao executor**: siga este plano passo a passo. Rode cada comando de
> verificação e confirme o resultado esperado antes de ir para o próximo passo.
> Se qualquer item da seção "Condições de PARADA" ocorrer, pare e reporte — não
> improvise. Ao terminar, atualize a linha deste plano em `plans/README.md`
> (a menos que um revisor tenha te despachado e dito que ele mantém o índice).
>
> **Antes de escrever código**: o `AGENTS.md` do repo avisa que este Next.js
> (16.4) tem mudanças incompatíveis com o que você conhece. Leia o guia de
> Route Handlers em `node_modules/next/dist/docs/` e mantenha o padrão já usado
> nos handlers existentes (`Response.json`, `params` como `Promise`).
>
> **Checagem de drift (rode primeiro)**:
> `git diff --stat 2cd8087..HEAD -- app/api/rondas lib/ronda-db.ts components/ronda-form.tsx`
> Se algum arquivo do escopo mudou, compare os trechos de "Estado atual" com o
> código vivo; se divergirem, trate como condição de PARADA.

## Status

- **Prioridade**: P1
- **Esforço**: S
- **Risco**: LOW
- **Depende de**: `plans/001-migracoes-turso-ordem.md` (a verificação precisa criar o esquema num banco de arquivo novo)
- **Categoria**: bug
- **Planejado em**: commit `2cd8087`, 2026-10-14

## Por que importa

O formulário gera o `id` da ronda no cliente (`crypto.randomUUID()` em
`novaRonda`) e grava uma única vez, ao finalizar, com `POST`.
Se o servidor gravar a ronda mas a resposta se perder (rede móvel instável é o
cenário real de uma ronda com GPS), o formulário continua em modo "criar": toda
nova tentativa de salvar repete `POST` com o mesmo `id`, bate na chave primária e
recebe 500 ("Não foi possível salvar") **para sempre**, mesmo a ronda já
existindo no banco. O usuário só escapa recarregando e abrindo a ronda pelo
histórico. Além disso, corpo JSON malformado vira 500 em vez de 400.

## Estado atual

Arquivos:

- `app/api/rondas/route.ts` — `GET` lista, `POST` cria.
- `app/api/rondas/[id]/route.ts` — `GET` busca, `PUT` atualiza.
- `lib/ronda-db.ts` — `criarRonda`, `atualizarRonda`, `buscarRonda`.
- `components/ronda-form.tsx` — consumidor (não será alterado).

`app/api/rondas/route.ts:19-35`:

```ts
export async function POST(request: Request) {
  try {
    const parsed = rondaSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Dados da ronda inválidos.", issues: parsed.error.flatten() },
        { status: 400 },
      );
    const created = await criarRonda(parsed.data);
    return Response.json(created, { status: 201 });
  } catch {
    return Response.json(
      { error: "Não foi possível salvar a ronda." },
      { status: 500 },
    );
  }
}
```

`app/api/rondas/[id]/route.ts:26-48` (`PUT`): usa `rondaSchema.safeParse(await
request.json())` dentro do mesmo padrão `try/catch → 500`, exige
`parsed.data.id === id` e `buscarRonda(id)` antes de `atualizarRonda`.

`lib/ronda-db.ts:83-95` e `97-124`: `criarRonda` usa `prisma.ronda.create` com
`id` vindo do cliente; `atualizarRonda(id, ronda)` roda numa transação
(update + `ambiente.deleteMany` + `createMany` de ambientes e tarefas).

`components/ronda-form.tsx:394-417` (`concluirFinalizacao`): o formulário só
grava ao **finalizar** (não há mais "Salvar" intermediário). Faz `POST` se
`persistido` é `null` (ronda nova) e `PUT` se a ronda foi aberta por `?id=` ou
pela agenda; em caso de sucesso inicia uma ronda nova; em caso de falha mantém
os dados no formulário para nova tentativa; trata qualquer não-ok como falha
genérica (só olha `ok`).

Convenções: erros em PT-BR com `Response.json({ error }, { status })`;
`export const runtime = "nodejs"`; sem comentários redundantes. O handler de
importação já faz `await request.json().catch(() => null)`
(`app/api/dashboard/import/route.ts:22`) — use o mesmo idioma.

## Comandos que você vai usar

| Objetivo | Comando | Esperado |
|----------|---------|----------|
| Instalar | `pnpm install` | exit 0 |
| Migrar banco de arquivo | `DATABASE_URL=file:./argos-verify.db node scripts/migrate-turso.mjs` | `Migrações Turso em dia.` |
| Build | `DATABASE_URL=file:./argos-verify.db pnpm build` | exit 0 |
| Lint (arquivos tocados) | `pnpm exec biome check app/api/rondas lib/ronda-db.ts` | exit 0 |

> **AVISO DE SEGURANÇA**: o `.env` local aponta para o Turso real. Toda
> verificação abaixo define `DATABASE_URL=file:...` **inline** (variáveis já
> definidas no ambiente têm precedência sobre o `.env`). Antes de subir o
> servidor, rode `echo "$DATABASE_URL"` na mesma shell e confirme que começa com
> `file:`. Nunca imprima o `.env`. `*.db` já está no `.gitignore`.

## Escopo

**Dentro do escopo**:

- `lib/ronda-db.ts` (adicionar `rondaExiste`)
- `app/api/rondas/route.ts`
- `app/api/rondas/[id]/route.ts`

**Fora do escopo** (NÃO toque):

- `components/ronda-form.tsx` — o cliente só olha `response.ok`; 200 e 201 servem.
- `app/api/dashboard/**` (importação/restauração têm lógica própria de duplicatas).
- `prisma/schema.prisma`, `lib/ronda.ts`.
- Semântica de `finalizadoEm`/status (finding CORR-03 do índice — decisão de produto pendente).

## Fluxo Git

- Branch: `advisor/003-salvar-ronda-idempotente`
- Commit sugerido: `fix(api): torna POST /api/rondas idempotente por id`
- NÃO faça push nem abra PR sem instrução do operador.

## Passos

### Passo 1: helper `rondaExiste`

Em `lib/ronda-db.ts`, antes de `criarRonda`, adicione:

```ts
export async function rondaExiste(id: string) {
  const ronda = await prisma.ronda.findUnique({
    where: { id },
    select: { id: true },
  });
  return ronda !== null;
}
```

**Verificar**: `pnpm exec biome check lib/ronda-db.ts` → exit 0.

### Passo 2: `POST` idempotente e 400 para JSON inválido

Em `app/api/rondas/route.ts`:

- importe `atualizarRonda` e `rondaExiste` de `@/lib/ronda-db`;
- troque `await request.json()` por `await request.json().catch(() => null)`
  (o `safeParse(null)` falha e cai no 400 já existente);
- depois do `safeParse` válido, antes de `criarRonda`:

```ts
if (await rondaExiste(parsed.data.id)) {
  await atualizarRonda(parsed.data.id, parsed.data);
  return Response.json({ id: parsed.data.id });
}
```

Mantenha `criarRonda` + status 201 para o caso novo.

**Verificar**: `pnpm exec biome check app/api/rondas/route.ts` → exit 0.

### Passo 3: `PUT` com 400 para JSON inválido

Em `app/api/rondas/[id]/route.ts`, no `PUT`, troque `await request.json()` por
`await request.json().catch(() => null)`. Não mude o resto.

**Verificar**: `pnpm exec biome check "app/api/rondas/[id]/route.ts"` → exit 0.

### Passo 4: verificação ponta a ponta com banco de arquivo

```bash
export DATABASE_URL=file:./argos-verify.db
echo "$DATABASE_URL"            # deve começar com file:
rm -f argos-verify.db
node scripts/migrate-turso.mjs  # esperado: ...Migrações Turso em dia.
pnpm build                      # esperado: exit 0
./node_modules/.bin/next start --port 3111 > /tmp/argos-003.log 2>&1 &
SERVER_PID=$!
sleep 6

cat > /tmp/argos-003-ronda.json <<'EOF'
{"id":"3f2b8a4e-1c5d-4e7a-9b6f-0a1b2c3d4e5f","data":"2026-10-14","turno":"Manhã","hora":"08:00","responsavel":"Teste","base":"Paragominas","status":"Em andamento","plantaoData":"","observacoesGerais":"","gpsLatitude":null,"gpsLongitude":null,"gpsPrecisao":null,"gpsCapturadoEm":null,"ambientes":[{"id":"amb-1","nome":"Copa","observacao":"","prioridade":"Informação","localizacao":"","tarefas":[{"id":"tar-1","texto":"Verificar","concluida":false}]}]}
EOF

curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' --data @/tmp/argos-003-ronda.json localhost:3111/api/rondas
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' --data @/tmp/argos-003-ronda.json localhost:3111/api/rondas
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' --data '{' localhost:3111/api/rondas
curl -s -o /dev/null -w '%{http_code}\n' -X PUT  -H 'Content-Type: application/json' --data '{' localhost:3111/api/rondas/3f2b8a4e-1c5d-4e7a-9b6f-0a1b2c3d4e5f
curl -s localhost:3111/api/rondas | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))'

kill $SERVER_PID
rm -f argos-verify.db /tmp/argos-003-ronda.json
unset DATABASE_URL
```

**Verificar** (cinco linhas, nesta ordem):
```
201
200
400
400
1
```
(Antes desta mudança a segunda linha era `500` e a terceira `500`.) Se alguma
linha divergir, olhe `/tmp/argos-003.log`, corrija dentro do escopo e repita; se
persistir após duas tentativas → PARADA.

## Plano de testes

Sem testes automatizados: os handlers importam `@/lib/prisma`
(`import "server-only"`) e exigiriam banco. O roteiro do Passo 4 é a
verificação; ele cobre o caso novo (201), a repetição (200), JSON malformado em
`POST` e `PUT` (400) e a ausência de duplicata (1 ronda listada).

## Critérios de pronto

Todos devem valer:

- [ ] Passo 4 imprime `201`, `200`, `400`, `400`, `1`
- [ ] `pnpm exec biome check app/api/rondas lib/ronda-db.ts` sai com 0
- [ ] `git status` mostra só os 3 arquivos do escopo modificados (e nenhum `*.db`)
- [ ] Nenhuma menção a `localhost:3111` ou arquivos temporários ficou no repo
- [ ] Linha do plano 003 atualizada em `plans/README.md`

## Condições de PARADA

Pare e reporte (sem improvisar) se:

- Os trechos de "Estado atual" não baterem com o código vivo.
- Para verificar, você precisar de `DATABASE_URL` apontando para `libsql:` (Turso real).
- O `pnpm build` falhar por motivo alheio às suas mudanças (reporte o erro).
- Você sentir necessidade de alterar `components/ronda-form.tsx`.

## Notas de manutenção

- Agora `POST` com `id` existente **sobrescreve** a ronda (como o `PUT` já
  fazia). Sem autenticação (finding SEC-01 / plano 004), qualquer um que alcance
  a API já podia sobrescrever via `PUT`; isto não amplia o alcance, mas ao
  introduzir autorização, ambos os verbos precisam das mesmas regras.
- Há uma janela de corrida entre `rondaExiste` e `criarRonda` (dois `POST`
  simultâneos com o mesmo `id`): o segundo falha na PK com 500 e a próxima
  tentativa cai no ramo de atualização. Aceitável aqui; se virar problema,
  trocar por `upsert` numa transação.
- Revisor: confirme que `201` continua sendo devolvido só na criação e que o
  corpo `{ id }` é compatível com o que `concluirFinalizacao` espera (só usa `ok`).
