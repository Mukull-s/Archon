export const EMBEDDING_BATCH_SIZE = Number(process.env.EMBEDDING_BATCH_SIZE) || 128;
export const DB_BATCH_SIZE = Number(process.env.DB_BATCH_SIZE) || 256;
export const MAX_CONCURRENT_EMBEDDINGS = Number(process.env.MAX_CONCURRENT_EMBEDDINGS) || 4;
export const MAX_FILES_LIMIT = Number(process.env.MAX_FILES_LIMIT) || 1000;
export const MAX_TOTAL_SIZE_LIMIT = Number(process.env.MAX_TOTAL_SIZE_LIMIT) || 25 * 1024 * 1024; // 25 MB
export const MAX_SINGLE_FILE_SIZE_LIMIT = Number(process.env.MAX_SINGLE_FILE_SIZE_LIMIT) || 1024 * 1024; // 1 MB
export const MAX_CHUNKS_LIMIT = Number(process.env.MAX_CHUNKS_LIMIT) || 5000;
