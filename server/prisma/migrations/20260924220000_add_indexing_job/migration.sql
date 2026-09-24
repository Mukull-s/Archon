-- CreateTable
CREATE TABLE IF NOT EXISTS "IndexingJob" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL DEFAULT 'VECTOR_INDEX',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IndexingJob_status_nextRunAt_idx" ON "IndexingJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IndexingJob_repositoryId_idx" ON "IndexingJob"("repositoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IndexingJob_leaseExpiresAt_idx" ON "IndexingJob"("leaseExpiresAt");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IndexingJob_repositoryId_fkey'
  ) THEN
    ALTER TABLE "IndexingJob" ADD CONSTRAINT "IndexingJob_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IndexingJob_userId_fkey'
  ) THEN
    ALTER TABLE "IndexingJob" ADD CONSTRAINT "IndexingJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
