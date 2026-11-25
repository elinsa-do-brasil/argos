-- CreateTable
CREATE TABLE "Limpeza" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "base" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "funcionaria" TEXT NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "registradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Limpeza_base_data_registradoEm_idx" ON "Limpeza"("base", "data", "registradoEm");
