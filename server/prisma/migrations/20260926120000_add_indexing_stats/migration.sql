-- AlterTable
-- Idempotent: the column may already exist when this migration is first
-- recorded (the app also reconciles it at startup).
ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "indexingStats" JSONB;
