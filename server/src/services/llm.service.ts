import axios from 'axios';

export interface ChatCompletionRequest {
  prompt: string;
  contextChunks: Array<{
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    symbolName: string | null;
    inDegree: number;
  }>;
  model: string;
  repoMetadata?: {
    name: string;
    fileCount: number;
    totalSize: number;
    framework: string | null;
    languages: string[];
    entryPoints: string[];
    fileTree: string;
  };
  evidenceTraces?: string[];
}

export interface StreamChunk {
  content: string;
  reasoning: string;
  modelUsed: string;
}

class LLMService {
  /**
   * Helper to build the system prompt injecting codebase stats and relevant chunks.
   */
  private buildSystemPrompt(
    contextChunks: ChatCompletionRequest['contextChunks'],
    repoMetadata?: ChatCompletionRequest['repoMetadata'],
    evidenceTraces?: string[]
  ) {
    let contextBlock = '';
    if (contextChunks.length > 0) {
      contextBlock = contextChunks.map((chunk, idx) => {
        const symbolLabel = chunk.symbolName ? `Symbol: ${chunk.symbolName}` : 'File-level block';
        return `---
[Context #${idx + 1}] File: [${chunk.filePath}] (Lines ${chunk.startLine}-${chunk.endLine})
[Importance: ${chunk.inDegree} incoming dependencies] | [Scope: ${symbolLabel}]
\`\`\`
${chunk.content}
\`\`\``;
      }).join('\n\n');
    } else {
      contextBlock = 'No relevant codebase chunks found.';
    }

    let repoOverviewBlock = '';
    if (repoMetadata) {
      repoOverviewBlock = `## Repository Overview
- Name: ${repoMetadata.name}
- Total Scanned Files: ${repoMetadata.fileCount}
- Combined Code Size: ${repoMetadata.totalSize} bytes
- Detected Framework: ${repoMetadata.framework || 'Vanilla/Custom'}
- Languages: ${repoMetadata.languages.join(', ')}
- Main Entry Points: ${repoMetadata.entryPoints.join(', ') || 'None detected'}

## Complete File Tree Structure:
${repoMetadata.fileTree}
`;
    }

    let evidenceBlock = '';
    if (evidenceTraces && evidenceTraces.length > 0) {
      evidenceBlock = `## Deterministic Evidence Trace Chains
The following execution flows are verified in the codebase imports:
${evidenceTraces.map(t => `- ${t}`).join('\n')}
`;
    }

    return `You are Archon, a highly sophisticated Codebase Intelligence Platform designed for engineers and recruiters.
Your goal is to answer queries using the provided repository context chunks and repository overview, showing deep engineering logic.

${repoOverviewBlock}

${evidenceBlock}

Here is the parsed repository source code context (relevant snippets):
=========================================
${contextBlock}
=========================================

Instructions:
1. Be extremely concise, structured, and direct. Do NOT write long paragraphs or essay-like explanations. Keep responses brief and highly readable.
2. Ground your answers strictly in the provided code context and repository overview.
3. If asked about execution chains, routes, or how requests flow, trace them using the Deterministic Evidence Trace Chains. Cite the exact chain (e.g. \`[routes/auth.ts] ➔ [controllers/auth.ts] ➔ [services/auth.ts] ➔ [prisma/schema.prisma]\`).
4. If asked about file counts, overall languages, framework, or file structure, use the Repository Overview. Do NOT guess or hallucinate file counts or file tree paths.
5. Keep explanations focused: highlight patterns, database models, and class relations using clear, bite-sized bullet points.
6. When referring to files, output them as clickable file paths (e.g. \`[src/routes/auth.routes.ts]\` or \`[server.ts]\`).
7. Maintain a clean, professional, and architect-level tone.`;
  }

  private getModelsQueue(requestedModel: string): string[] {
    let initialModel = requestedModel;
    if (requestedModel === 'qwen/qwen-2.5-coder-7b-instruct:free') {
      initialModel = 'qwen/qwen3-coder:free';
    }
    const queue = [initialModel];
    const fallbacks = [
      'qwen/qwen3-coder:free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'cohere/north-mini-code:free',
      'poolside/laguna-xs-2.1:free'
    ];
    for (const f of fallbacks) {
      if (!queue.includes(f)) {
        queue.push(f);
      }
    }
    return queue;
  }

  /**
   * Standard non-streaming chat method (with new metadata-aware prompt).
   */
  async chat({ prompt, contextChunks, model, repoMetadata, evidenceTraces }: ChatCompletionRequest) {
    const modelsQueue = this.getModelsQueue(model);
    const systemPrompt = this.buildSystemPrompt(contextChunks, repoMetadata, evidenceTraces);
    let lastError: any = null;

    for (const activeModel of modelsQueue) {
      try {
        const isDirectDeepSeek = activeModel === 'deepseek-v4-flash' || activeModel === 'deepseek-v4-pro';
        const baseUrl = isDirectDeepSeek ? 'https://api.deepseek.com/v1' : 'https://openrouter.ai/api/v1';
        const apiKey = isDirectDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
          throw new Error(`API key is missing for model: ${activeModel}`);
        }

        console.log(`Sending completion request to ${activeModel}...`);

        const response = await axios.post(`${baseUrl}/chat/completions`, {
          model: activeModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(!isDirectDeepSeek && {
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'Archon Intelligence Platform'
            })
          },
          timeout: 12000 // 12 seconds timeout
        });

        const choice = response.data.choices[0];
        return {
          text: choice.message.content,
          reasoning: choice.message.reasoning_content || null,
          modelUsed: activeModel
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${activeModel} failed: ${err.message}`);
        // Continue to fallback
      }
    }
    throw lastError || new Error('Failed to generate response from any models.');
  }

  /**
   * Streaming chat method using native fetch & Server-Sent Events.
   */
  async *chatStream({ prompt, contextChunks, model, repoMetadata, evidenceTraces }: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const modelsQueue = this.getModelsQueue(model);
    const systemPrompt = this.buildSystemPrompt(contextChunks, repoMetadata, evidenceTraces);
    let lastError: any = null;

    for (const activeModel of modelsQueue) {
      const isDirectDeepSeek = activeModel === 'deepseek-v4-flash' || activeModel === 'deepseek-v4-pro';
      const baseUrl = isDirectDeepSeek ? 'https://api.deepseek.com/v1' : 'https://openrouter.ai/api/v1';
      const apiKey = isDirectDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        console.warn(`Skipping ${activeModel} due to missing API Key.`);
        continue;
      }

      console.log(`Streaming from model: ${activeModel}...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s connection timeout

      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(!isDirectDeepSeek && {
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'Archon Intelligence Platform'
            })
          },
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            stream: true
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        if (!response.body) {
          throw new Error('Response body is empty.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const cleaned = line.trim();
              if (!cleaned) continue;
              if (cleaned === 'data: [DONE]') continue;
              if (cleaned.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(cleaned.slice(6));
                  const choice = parsed.choices?.[0];
                  const content = choice?.delta?.content || '';
                  const reasoning = choice?.delta?.reasoning_content || choice?.delta?.reasoning || '';
                  if (content || reasoning) {
                    yield { content, reasoning, modelUsed: activeModel };
                  }
                } catch (e) {
                  // Partial JSON parsing error, wait for more chunks
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Successfully streamed from this model, so we can exit the fallback loop
        return;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        console.warn(`Model ${activeModel} stream failed: ${err.message}`);
        // Continue fallback loop
      }
    }

    throw lastError || new Error('Failed to initialize stream from any configured models.');
  }
}

export const llmService = new LLMService();
export default llmService;
