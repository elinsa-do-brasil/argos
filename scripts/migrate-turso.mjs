import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não configurada.");

const db = createClient({ url, authToken: process.env.TURSO_TOKEN });
try {
  await db.execute(`CREATE TABLE IF NOT EXISTS "_argos_migrations" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  // Bancos já migrados registraram os nomes antigos das pastas. Renomeia as
  // linhas antes de aplicar, senão o SQL seria reaplicado.
  const nomesLegados = {
    "20261014_init": "20261014000000_init",
    "20261014_dashboard_imports": "20261014000100_dashboard_imports",
  };
  for (const [antigo, novo] of Object.entries(nomesLegados)) {
    await db.execute({
      sql: 'UPDATE "_argos_migrations" SET "name" = ? WHERE "name" = ?',
      args: [novo, antigo],
    });
  }
  const root = join(process.cwd(), "prisma", "migrations");
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const applied = await db.execute({
      sql: 'SELECT 1 FROM "_argos_migrations" WHERE "name" = ?',
      args: [entry.name],
    });
    if (applied.rows.length) continue;
    const sql = await readFile(join(root, entry.name, "migration.sql"), "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s && !/^--[^\n]*$/.test(s));
    await db.batch(
      [
        ...statements,
        {
          sql: 'INSERT INTO "_argos_migrations" ("name") VALUES (?)',
          args: [entry.name],
        },
      ],
      "write",
    );
    console.log(`Migração aplicada: ${entry.name}`);
  }
  console.log("Migrações Turso em dia.");
} finally {
  db.close();
}
