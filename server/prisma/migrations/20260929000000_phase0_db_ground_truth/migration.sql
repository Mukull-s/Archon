-- Phase 0: Database ground truth (idempotent, safe to re-run).
--
-- Brings any database (fresh from migrations, or a drifted live database) to
-- the same shape. Every statement is guarded, so applying it twice is a no-op
-- and a database already in the target shape is left untouched.

-- ── 1. Embedding dimension -> vector(512) ───────────────────────────────────
-- The original init migration created vector(384); the deployment target is
-- vector(512) for voyage-code-3 / voyage-code-4. Only alter when needed, and
-- fail loudly rather than silently corrupting existing vectors of a different
-- dimension.
DO $$
DECLARE
  current_type text;
  has_data boolean;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod), true
    INTO current_type, has_data
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'CodeChunk' AND a.attname = 'embedding';

  IF current_type IS NULL THEN
    RETURN; -- column absent; nothing to do
  END IF;

  IF current_type <> 'vector(512)' THEN
    SELECT EXISTS (SELECT 1 FROM "CodeChunk" WHERE embedding IS NOT NULL) INTO has_data;
    IF has_data THEN
      RAISE EXCEPTION
        'CodeChunk.embedding is % but existing vectors are present. Re-index the repository to rebuild at vector(512).',
        current_type;
    END IF;
    ALTER TABLE "CodeChunk" ALTER COLUMN "embedding" TYPE vector(512);
  END IF;
END $$;

-- ── 2. Repository.commitSha (up-to-date early exit) ─────────────────────────
ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "commitSha" TEXT;

-- ── 3. HNSW index for cosine similarity search ──────────────────────────────
-- Queries order by `embedding <=> query` (cosine distance) => vector_cosine_ops.
SET maintenance_work_mem = '128MB';
CREATE INDEX IF NOT EXISTS "CodeChunk_embedding_hnsw_idx"
  ON "CodeChunk" USING hnsw ("embedding" vector_cosine_ops);

-- ── 4. Composite indexes for hot paths ──────────────────────────────────────
-- (repositoryId, filePath)   -> incremental chunk invalidation / deletes by file
-- (repositoryId, createdAt)  -> ordered chat-history retrieval
-- (userId, updatedAt)        -> recent repositories for a user
CREATE INDEX IF NOT EXISTS "CodeChunk_repositoryId_filePath_idx"
  ON "CodeChunk" ("repositoryId", "filePath");
CREATE INDEX IF NOT EXISTS "ChatMessage_repositoryId_createdAt_idx"
  ON "ChatMessage" ("repositoryId", "createdAt");
CREATE INDEX IF NOT EXISTS "Repository_userId_updatedAt_idx"
  ON "Repository" ("userId", "updatedAt");

-- ── 5. Drop now-redundant single-column indexes ─────────────────────────────
-- Each is a leading prefix of a composite above, so the planner no longer needs
-- it; keeping both would only add write cost.
DROP INDEX IF EXISTS "CodeChunk_repositoryId_idx";
DROP INDEX IF EXISTS "ChatMessage_repositoryId_idx";
DROP INDEX IF EXISTS "Repository_userId_idx";
