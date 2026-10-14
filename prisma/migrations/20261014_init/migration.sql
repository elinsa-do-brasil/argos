-- CreateTable
CREATE TABLE "Ronda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Em andamento',
    "plantaoData" TEXT,
    "observacoesGerais" TEXT NOT NULL DEFAULT '',
    "gpsLatitude" REAL,
    "gpsLongitude" REAL,
    "gpsPrecisao" INTEGER,
    "gpsCapturadoEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "finalizadoEm" DATETIME
);

-- CreateTable
CREATE TABLE "Ambiente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rondaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "prioridade" TEXT NOT NULL DEFAULT 'Informação',
    "localizacao" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Ambiente_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tarefa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ambienteId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Tarefa_ambienteId_fkey" FOREIGN KEY ("ambienteId") REFERENCES "Ambiente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Ronda_data_hora_idx" ON "Ronda"("data", "hora");

-- CreateIndex
CREATE INDEX "Ronda_base_turno_data_idx" ON "Ronda"("base", "turno", "data");

-- CreateIndex
CREATE INDEX "Ambiente_rondaId_ordem_idx" ON "Ambiente"("rondaId", "ordem");

-- CreateIndex
CREATE INDEX "Tarefa_ambienteId_ordem_idx" ON "Tarefa"("ambienteId", "ordem");
