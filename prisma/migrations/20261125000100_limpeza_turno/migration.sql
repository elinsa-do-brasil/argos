-- AddTurno
ALTER TABLE "Limpeza" ADD COLUMN "turno" TEXT NOT NULL DEFAULT 'Manhã';

-- UpdateIndex
DROP INDEX IF EXISTS "Limpeza_base_data_registradoEm_idx";
CREATE INDEX "Limpeza_base_data_turno_registradoEm_idx" ON "Limpeza"("base", "data", "turno", "registradoEm");
