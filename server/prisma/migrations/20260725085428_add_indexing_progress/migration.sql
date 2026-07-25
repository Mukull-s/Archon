-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "indexingProgress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "indexingStatus" TEXT NOT NULL DEFAULT 'idle';
