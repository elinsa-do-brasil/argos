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
  const root = join(process.cwd(), "prisma", "migrations");
  for (const entry of (await readdir(root, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
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
