// Chunks are sealed by a token budget and an input-count ceiling (see
// EMBEDDING_MAX_TOKENS_PER_REQUEST / EMBEDDING_MAX_INPUTS), so a fixed
// count-based batch size is no longer used. DB_BATCH_SIZE remains for other
// bulk operations.
export const DB_BATCH_SIZE = Number(process.env.DB_BATCH_SIZE) || 256;
// Number of embedding batches processed concurrently. `EMBEDDING_CONCURRENCY`
// is the preferred knob; `MAX_CONCURRENT_EMBEDDINGS` is kept for compatibility.
// Persistence is decoupled from the embedding slot, so this bounds only
// outbound Voyage requests. Lower it if the account hits rate limits.
export const MAX_CONCURRENT_EMBEDDINGS =
  Number(process.env.EMBEDDING_CONCURRENCY) || Number(process.env.MAX_CONCURRENT_EMBEDDINGS) || 3;
export const MAX_FILES_LIMIT = Number(process.env.MAX_FILES_LIMIT) || 400;
export const MAX_TOTAL_SIZE_LIMIT = Number(process.env.MAX_TOTAL_SIZE_LIMIT) || 15 * 1024 * 1024;
export const MAX_SINGLE_FILE_SIZE_LIMIT = Number(process.env.MAX_SINGLE_FILE_SIZE_LIMIT) || 1024 * 1024;
// Upper bound on chunks embedded per repository. Preserves the original
// orchestrator ceiling of 5000 (the constant was previously unused).
export const MAX_CHUNKS_LIMIT = Number(process.env.MAX_CHUNKS_LIMIT) || 5000;
