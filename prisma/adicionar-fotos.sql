-- Executar somente se a coluna fotosJson ainda não existir.
ALTER TABLE "Ambiente" ADD COLUMN "fotosJson" TEXT NOT NULL DEFAULT '[]';
