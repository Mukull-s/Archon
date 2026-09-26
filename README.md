<img width="1600" height="397" alt="Archon_Banner" src="https://github.com/user-attachments/assets/b084b40a-982a-4438-8f03-bb51a3975ad4" />


<p align="center">
  <b>AI-powered codebase intelligence.</b><br/>
  <sub>Paste a repo. Understand everything.</sub>
</p>

---

## Indexing performance tunables

All optional; defaults are production-safe.

| Env var | Default | Purpose |
|---|---:|---|
| `EMBEDDING_MAX_TOKENS_PER_REQUEST` | `90000` | Token budget per Voyage request (provider cap is 120k). |
| `EMBEDDING_MAX_INPUTS` | `96` | Max inputs per Voyage request. |
| `EMBEDDING_MAX_CHARS_PER_INPUT` | `6000` | Inputs are clamped to this many characters before embedding. |
| `EMBEDDING_CONCURRENCY` | `3` | Embedding batches processed in parallel. |
| `EMBEDDING_BATCH_SIZE` | `64` | Chunks accumulated before a batch is dispatched. |
| `CHUNK_MAX_CHARS` | `4800` | Hard ceiling for a single code chunk. |
| `CHUNK_OVERLAP_CHARS` | `500` | Overlap between sub-chunks when a symbol is split. |
| `CHUNK_MIN_CHARS` | `200` | Fragments smaller than this merge into a neighbour. |
| `EMBEDDING_REQUEST_TIMEOUT_MS` | `30000` | Hard abort for a single embedding request. |
| `GITHUB_DOWNLOAD_TIMEOUT_MS` | `30000` | Hard timeout for the repository zipball download. |
| `MAX_CHUNKS_LIMIT` | `2000` | Upper bound on chunks embedded per repository. |

Verify the indexing pipeline invariants with:

```bash
cd server && npx ts-node --transpile-only scripts/verify-indexing.ts
```

