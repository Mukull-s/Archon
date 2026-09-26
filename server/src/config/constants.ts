// Batch of chunks handed to the embedding layer at once. The embedding service
// further splits this into token-budgeted requests, so this is an upper bound,
// not a hard request size.
export const EMBEDDING_BATCH_SIZE = Number(process.env.EMBEDDING_BATCH_SIZE) || 64;
export const DB_BATCH_SIZE = Number(process.env.DB_BATCH_SIZE) || 256;
// Number of embedding batches processed concurrently. `EMBEDDING_CONCURRENCY`
// is the preferred knob; `MAX_CONCURRENT_EMBEDDINGS` is kept for compatibility.
export const MAX_CONCURRENT_EMBEDDINGS =
  Number(process.env.EMBEDDING_CONCURRENCY) || Number(process.env.MAX_CONCURRENT_EMBEDDINGS) || 3;
export const MAX_FILES_LIMIT = Number(process.env.MAX_FILES_LIMIT) || 400;
export const MAX_TOTAL_SIZE_LIMIT = Number(process.env.MAX_TOTAL_SIZE_LIMIT) || 15 * 1024 * 1024;
export const MAX_SINGLE_FILE_SIZE_LIMIT = Number(process.env.MAX_SINGLE_FILE_SIZE_LIMIT) || 1024 * 1024;
export const MAX_CHUNKS_LIMIT = Number(process.env.MAX_CHUNKS_LIMIT) || 2000;
