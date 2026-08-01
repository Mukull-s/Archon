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
1. Ground your answers strictly in the provided code context and repository overview.
2. For codebase, structural, or architectural explanations, structure your response using clear sections, lists, and tables. Highlight:
   - **Executive Summary** (brief overview)
   - **Architecture** & **Data Flow**
   - **Key Components** & **Important Files** (list important files using square brackets like \`[src/services/auth.service.ts]\` or \`[server.ts]\`)
   - **Tradeoffs** & **Suggestions**
3. For small questions or specific code queries, keep explanations brief, direct, and focused. Avoid forcing every single response into a rigid layout if the query doesn't warrant it.
4. Always avoid giant walls of text or long-winded paragraphs. Keep responses highly structured and skimmable.
5. Trace execution flow chains using the Deterministic Evidence Trace Chains where applicable, referencing the files involved.
6. When referring to files, ALWAYS output them in square brackets like \`[src/routes/auth.routes.ts]\` or \`[server.ts]\` so they render as clickable chips.
7. Maintain a clean, professional, and architect-level tone.`;
  }

  private getModelsQueue(requestedModel: string): string[] {
    let initialModel = requestedModel;
    
    // Map offline or highly congested models to stable active free models
    if (
      requestedModel === 'qwen/qwen-2.5-coder-7b-instruct:free' || 
      requestedModel === 'qwen/qwen3-coder:free' ||
      requestedModel.includes('qwen')
    ) {
      initialModel = 'cohere/north-mini-code:free';
    } else if (requestedModel.includes('gemma-4-31b')) {
      initialModel = 'google/gemma-4-26b-a4b-it:free';
    }

    const queue = [initialModel];
    const fallbacks = [
      'cohere/north-mini-code:free',              // Fast and online
      'poolside/laguna-s-2.1:free',               // Fast coding model
      'openai/gpt-oss-20b:free',                  // Fast general text model
      'google/gemma-4-26b-a4b-it:free',           // Less congested than 31B
      'nvidia/nemotron-3-super-120b-a12b:free',   // Nemotron fallback
      'google/gemma-4-31b-it:free'                // High congestion fallback
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

  /**
   * Generates a structured business and technical summary for the repository.
   */
  async generateRepositorySummary(repoInfo: {
    name: string;
    framework: string | null;
    languages: string[];
    fileCount: number;
    totalSize: number;
    readme?: string;
    packageJson?: string;
    fileTree: string;
  }): Promise<string> {
    const prompt = `You are Archon, an expert Software Architect AI.
Analyze the following repository technical metadata, README file, package.json file, and file tree structure to generate a high-quality business and technical summary of the codebase.

Repository Metadata:
- Name: ${repoInfo.name}
- Framework: ${repoInfo.framework || 'Vanilla/Custom'}
- Languages: ${repoInfo.languages.join(', ')}
- File Count: ${repoInfo.fileCount}
- Size: ${(repoInfo.totalSize / 1024).toFixed(2)} KB

${repoInfo.readme ? `README.md content:\n---\n${repoInfo.readme}\n---\n` : ''}
${repoInfo.packageJson ? `package.json content:\n---\n${repoInfo.packageJson}\n---\n` : ''}

Complete File Structure:
${repoInfo.fileTree}

Instructions:
1. Respond ONLY with a valid, clean JSON object. Do not include markdown code block syntax (like \`\`\`json) or any conversational greeting or trailing text.
2. The JSON object MUST follow this exact schema:
{
  "summary": "A short paragraph (3-5 sentences) explaining what the application does in plain English. Describe the primary capabilities, what problem it solves, and how it is used.",
  "purpose": "One concise sentence describing the primary goal of the repository.",
  "businessDomain": "e.g. Fintech, Developer Tools, E-commerce, Gaming, Social, Healthcare, Analytics, etc.",
  "targetUsers": ["User group 1", "User group 2"],
  "keyFeatures": ["Feature 1", "Feature 2", "Feature 3"],
  "coreModules": ["Module/Package name - brief description"],
  "techStack": ["Technology 1", "Technology 2"],
  "complexity": "Low" | "Medium" | "High"
}
3. Maintain high technical precision and avoid generic AI phrases like "This repository contains...".
4. Do not hallucinate capabilities. If a detail cannot be determined, specify that it could not be determined.
5. Double check that the JSON is fully valid and parseable. Ensure all string values are escaped properly.`;

    const modelsQueue = this.getModelsQueue('qwen/qwen3-coder:free');
    let lastError: any = null;

    for (const activeModel of modelsQueue) {
      try {
        const isDirectDeepSeek = activeModel === 'deepseek-v4-flash' || activeModel === 'deepseek-v4-pro';
        const baseUrl = isDirectDeepSeek ? 'https://api.deepseek.com/v1' : 'https://openrouter.ai/api/v1';
        const apiKey = isDirectDeepSeek ? process.env.DEEPSEEK_API_KEY : process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
          throw new Error(`API key is missing for model: ${activeModel}`);
        }

        console.log(`[Summary Generation] Sending request to ${activeModel}...`);

        const response = await axios.post(`${baseUrl}/chat/completions`, {
          model: activeModel,
          messages: [
            { role: 'system', content: 'You are a Software Architect AI that outputs strictly valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...(!isDirectDeepSeek && {
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'Archon'
            })
          },
          timeout: 10000 // 10s timeout
        });

        return response.data.choices[0].message.content;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Summary Generation] Model ${activeModel} failed: ${err.message}`);
      }
    }
    throw lastError || new Error('Failed to generate summary from any model.');
  }
}

export const llmService = new LLMService();
export default llmService;
