-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "visibleInSdrPortal" BOOLEAN NOT NULL DEFAULT false;

-- Visibilidade no Portal SDR passa da configuração do portal para o cadastro da etapa.
UPDATE "stages" st
SET "visibleInSdrPortal" = true
FROM "sdr_portal_settings" s
WHERE s."id" = 'default' AND st."id" = ANY(s."visibleStageIds");

-- AlterTable
ALTER TABLE "sdr_portal_settings" DROP COLUMN "visibleStageIds";
