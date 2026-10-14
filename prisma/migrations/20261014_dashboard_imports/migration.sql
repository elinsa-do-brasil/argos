-- AlterTable
ALTER TABLE "Ronda" ADD COLUMN "arquivoOrigem" TEXT;
ALTER TABLE "Ronda" ADD COLUMN "conteudoTXT" TEXT;
ALTER TABLE "Ronda" ADD COLUMN "hashTXT" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ronda_hashTXT_key" ON "Ronda"("hashTXT");
