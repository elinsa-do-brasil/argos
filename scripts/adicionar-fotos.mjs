import "dotenv/config";
import { createClient } from "@libsql/client";

// Usa as mesmas variáveis configuradas no seu .env.
const url = process.env.DATABASE_URL;
const authToken = process.env.TURSO_TOKEN?.trim();

if (!url) {
  throw new Error("Configure DATABASE_URL no .env.");
}

if (!authToken) {
  throw new Error("Configure TURSO_TOKEN no .env.");
}

const db = createClient({ url, authToken });

try {
  const colunas = await db.execute('PRAGMA table_info("Ambiente")');

  if (!colunas.rows.length) {
    throw new Error(
      "Tabela Ambiente não encontrada. Verifique o banco selecionado.",
    );
  }

  if (colunas.rows.some((coluna) => coluna.name === "fotosJson")) {
    console.log("A coluna de fotos já existe; nenhuma alteração necessária.");
  } else {
    await db.execute(
      `ALTER TABLE "Ambiente"
       ADD COLUMN "fotosJson" TEXT NOT NULL DEFAULT '[]'`,
    );

    console.log(
      "Coluna de fotos adicionada. Registros existentes preservados.",
    );
  }
} finally {
  db.close();
}
