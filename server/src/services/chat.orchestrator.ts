import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config';
import { AppError, logger } from '../utils';
import { entitlementService } from './entitlement.service';
import { plannerService } from './planner.service';
import { evidenceService } from './evidence.service';
import { vectorService } from './vector.service';
import { llmService, ChatHistoryMessage } from './llm.service';
import {
  buildKnownPathSet,
  validateCitations,
  fabricationNotice,
} from './answerVerification';

export interface PreparedChatContext {
  contextChunks: Array<{
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    symbolName: string | null;
    inDegree: number;
  }>;
  repoMetadata: {
    name: string;
    fileCount: number;
    totalSize: number;
    framework: string | null;
    languages: string[];
    entryPoints: string[];
    fileTree: string;
  };
  evidenceTraces: string[];
  plan: ReturnType<typeof plannerService.planQuery>;
  conversationHistory: ChatHistoryMessage[];
  /**
   * Every file the parser read, as structured data.
   *
   * Carried through so the finished answer can be checked against the real file
   * list without re-parsing `repoMetadata.fileTree`, which is a rendered string
   * for the prompt and not a reliable source of truth for path validation.
   */
  scannedFiles: Array<{ path: string }>;
  /**
   * How close the nearest retrieved chunk was, or null when retrieval did not
   * run through the vector index. Lower is closer. Reported to the UI as a
   * soft signal — see the note where it is computed for why it is not enforced.
   */
  retrievalQuality: { bestDistance: number | null; chunkCount: number };
}

/**
 * Helper to convert file path list into tree structure string for system prompt context.
 */
export function buildFileTreeString(scannedFiles: Array<{ path: string }>): string {
  const paths = scannedFiles.map(f => f.path);
  paths.sort();
  return paths.map(p => `- ${p}`).join('\n');
}

/**
 * Shared context-building pipeline for conversational AI (P1-2 & P1-3).
 * Resolves repository ownership, reserves entitlement, loads prior conversation turns,
 * builds query plan, and retrieves relevant code chunks with token allocation.
 */
export async function prepareChatContext(
  id: string,
  userId: string,
  message: string
): Promise<PreparedChatContext> {
  const repo = await prisma.repository.findFirst({
    where: { id, userId },
    select: {
      id: true, name: true, fileCount: true, totalSize: true, framework: true,
      languages: true, entryPoints: true, scannedFiles: true, dependencyGraph: true,
      astMetadata: true
    }
  });
  if (!repo) {
    throw new AppError('Repository not found or access denied.', 404);
  }

  // Atomically reserve monthly AI question entitlement upfront
  await entitlementService.recordAiQuestion(userId);

  // Fetch recent conversation history (last 8 messages) before saving current prompt (P1-3)
  const recentMessages = await prisma.chatMessage.findMany({
    where: { repositoryId: id },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { sender: true, message: true }
  });

  const conversationHistory: ChatHistoryMessage[] = recentMessages
    .reverse()
    .map(m => ({
      role: (m.sender === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.message
    }));

  const dependencyGraph = (typeof repo.dependencyGraph === 'string'
    ? JSON.parse(repo.dependencyGraph)
    : repo.dependencyGraph) as Record<string, string[]> || {};

  const scannedFiles = (typeof repo.scannedFiles === 'string'
    ? JSON.parse(repo.scannedFiles)
    : repo.scannedFiles) as Array<{ path: string }> || [];

  const astMetadata = (typeof repo.astMetadata === 'string'
    ? JSON.parse(repo.astMetadata)
    : repo.astMetadata) as Record<string, any> || {};

  const plan = plannerService.planQuery(message, {
    scannedFiles,
    dependencyGraph,
    astMetadata
  });

  let similarChunks: any[] = [];
  if (plan.intent === 'DEPENDENCY' && plan.dependencyAnalysis) {
    const targetFilePaths: string[] = [];
    if (plan.dependencyAnalysis.sourceFile) targetFilePaths.push(plan.dependencyAnalysis.sourceFile);
    if (plan.dependencyAnalysis.targetFile) targetFilePaths.push(plan.dependencyAnalysis.targetFile);
    if (plan.dependencyAnalysis.path && plan.dependencyAnalysis.path.length > 0) {
      targetFilePaths.push(...plan.dependencyAnalysis.path);
    }
    const uniqueFilePaths = Array.from(new Set(targetFilePaths.filter(Boolean)));

    if (uniqueFilePaths.length > 0) {
      similarChunks = await prisma.codeChunk.findMany({
        where: {
          repositoryId: id,
          filePath: { in: uniqueFilePaths }
        },
        take: 20
      });
    }
    if (similarChunks.length === 0) {
      similarChunks = await prisma.codeChunk.findMany({
        where: { repositoryId: id },
        take: plan.limit
      });
    }
  } else if (plan.useVector) {
    const queryVector = await vectorService.getEmbedding(message);
    similarChunks = await vectorService.searchSimilarChunks(id, queryVector, plan.limit);
  } else {
    similarChunks = await prisma.codeChunk.findMany({
      where: { repositoryId: id },
      take: plan.limit
    });
  }

  /* ── retrieval quality ────────────────────────────────────────────────
     The best cosine distance of the top chunk says how well the repository
     actually matches the question. It is reported, not enforced: measured on
     a real repository, matching questions land at 0.77–0.92 and unrelated ones
     at 0.84–0.94, so the two ranges overlap and no threshold separates them.
     A hard floor would reject good answers and admit bad ones. What is honest
     is to carry the number forward and let the UI say "weak match, treat with
     care" when it is high — the reader decides, not a guessed constant. */
  const bestDistance = similarChunks.reduce<number | null>((best, c) => {
    const d = typeof (c as { distance?: number }).distance === 'number'
      ? (c as { distance: number }).distance
      : null;
    if (d === null) return best;
    return best === null || d < best ? d : best;
  }, null);

  // Token-budget dynamic allocation
  let currentTokenCount = 0;
  const MAX_TOKEN_BUDGET = 6000;
  const contextChunks: PreparedChatContext['contextChunks'] = [];

  for (const chunk of similarChunks) {
    const inDegree = dependencyGraph[chunk.filePath]?.length || 0;
    const estTokens = Math.round(chunk.content.length / 4);

    if (currentTokenCount + estTokens > MAX_TOKEN_BUDGET) {
      const allowedTokens = MAX_TOKEN_BUDGET - currentTokenCount;
      if (allowedTokens > 100) {
        contextChunks.push({
          filePath: chunk.filePath,
          content: chunk.content.slice(0, allowedTokens * 4) + '\n... [TRUNCATED DUE TO CONTEXT LIMIT]',
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          symbolName: chunk.symbolName,
          inDegree
        });
      }
      break;
    }

    contextChunks.push({
      filePath: chunk.filePath,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      symbolName: chunk.symbolName,
      inDegree
    });
    currentTokenCount += estTokens;
  }

  const evidenceTraces = evidenceService.generateEvidenceTraces(
    scannedFiles,
    dependencyGraph
  ).map(t => t.pathString);

  const fileTree = buildFileTreeString(scannedFiles);

  return {
    contextChunks,
    repoMetadata: {
      name: repo.name,
      fileCount: repo.fileCount,
      totalSize: repo.totalSize,
      framework: repo.framework,
      languages: repo.languages,
      entryPoints: repo.entryPoints,
      fileTree
    },
    evidenceTraces,
    plan,
    conversationHistory,
    scannedFiles,
    retrievalQuality: { bestDistance, chunkCount: contextChunks.length }
  };
}

/**
 * Executes non-streaming conversational AI response.
 */
export async function executeChatWithRepo(req: Request, res: Response, next: NextFunction): Promise<void> {
  let contextPrepared = false;
  try {
    const { id } = req.params;
    const { message, model } = req.body;
    if (!message || typeof message !== 'string') {
      throw new AppError('Message prompt is required.', 400);
    }
    const requestedModel = model || 'qwen/qwen3-coder:free';
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    const {
      contextChunks,
      repoMetadata,
      evidenceTraces,
      plan,
      conversationHistory,
      scannedFiles,
      retrievalQuality
    } = await prepareChatContext(id as string, userId, message);
    contextPrepared = true;

    // Save user message to database
    await prisma.chatMessage.create({
      data: { repositoryId: id as string, sender: 'USER', message }
    });

    const aiResponse = await llmService.chat({
      prompt: message,
      contextChunks,
      model: requestedModel,
      conversationHistory,
      repoMetadata,
      evidenceTraces,
      dependencyAnalysis: plan.dependencyAnalysis
    });

    /* ── verify the answer before it reaches the user ─────────────────────
       The prompt tells the model to cite files from the context and not to
       name anything it was not shown. That is a request, not a guarantee. This
       checks the finished text against the repository's real file list and
       reports anything it cited that does not exist.

       The answer text is preserved verbatim — rewriting prose risks changing
       the claim. Instead a short notice is appended that names the citations
       that could not be matched, so the reader knows which parts to trust. */
    const knownPaths = buildKnownPathSet(scannedFiles);
    const citations = validateCitations(aiResponse.text, knownPaths);
    const verifiedText =
      citations.fabricated.length > 0
        ? aiResponse.text + fabricationNotice(citations.fabricated)
        : aiResponse.text;

    if (citations.fabricated.length > 0) {
      logger.warn('Answer contained unverifiable citations', {
        repositoryId: id,
        fabricated: citations.fabricated.slice(0, 5),
        count: citations.fabricated.length,
      });
    }

    // Save AI response to database
    await prisma.chatMessage.create({
      data: {
        repositoryId: id as string,
        sender: 'ASSISTANT',
        message: verifiedText,
        modelUsed: aiResponse.modelUsed
      }
    });

    res.status(200).json({
      success: true,
      data: {
        text: verifiedText,
        reasoning: aiResponse.reasoning,
        modelUsed: aiResponse.modelUsed,
        contextChunksUsed: contextChunks.length,
        evidenceTracesUsed: evidenceTraces.length,
        // Surfaced so the UI can show a trust indicator without re-parsing text.
        citations: {
          verified: citations.verified.length,
          fabricated: citations.fabricated.length,
          uncited: citations.uncited,
        },
        retrievalQuality,
        plan: {
          intent: plan.intent,
          steps: plan.steps
        }
      }
    });
  } catch (error) {
    if (contextPrepared && req.user?.userId) {
      await entitlementService.refundAiQuestion(req.user.userId).catch(() => {});
    }
    next(error);
  }
}

/**
 * Executes streaming conversational AI response via Server-Sent Events (SSE).
 */
export async function executeChatWithRepoStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  let contextPrepared = false;
  try {
    const { id } = req.params;
    const { message, model } = req.body;
    if (!message || typeof message !== 'string') {
      throw new AppError('Message prompt is required.', 400);
    }
    const requestedModel = model || 'qwen/qwen3-coder:free';
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    const {
      contextChunks,
      repoMetadata,
      evidenceTraces,
      plan,
      conversationHistory,
      scannedFiles,
      retrievalQuality
    } = await prepareChatContext(id as string, userId, message);
    contextPrepared = true;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Write query planner steps
    res.write(`data: ${JSON.stringify({ plan: { intent: plan.intent, steps: plan.steps } })}\n\n`);

    // Save user query to history
    await prisma.chatMessage.create({
      data: { repositoryId: id as string, sender: 'USER', message }
    });

    let completeText = '';
    let finalModel = requestedModel;
    const abortController = new AbortController();
    let clientDisconnected = false;

    const onClose = () => {
      clientDisconnected = true;
      abortController.abort();
    };
    req.on('close', onClose);

    // Maximum stream duration timeout (120 seconds) (P1-8)
    const STREAM_TIMEOUT_MS = 120_000;
    let streamTimedOut = false;
    const streamTimer = setTimeout(() => {
      streamTimedOut = true;
      abortController.abort();
    }, STREAM_TIMEOUT_MS);

    try {
      const stream = llmService.chatStream({
        prompt: message,
        contextChunks,
        model: requestedModel,
        conversationHistory,
        repoMetadata,
        evidenceTraces,
        dependencyAnalysis: plan.dependencyAnalysis,
        signal: abortController.signal
      });

      for await (const chunk of stream) {
        if (clientDisconnected || streamTimedOut) break;

        completeText += chunk.content;
        finalModel = chunk.modelUsed;

        try {
          res.write(`data: ${JSON.stringify({ token: chunk.content, modelUsed: chunk.modelUsed })}\n\n`);
        } catch {
          clientDisconnected = true;
          break;
        }
      }

      /* ── verify the answer once the stream has finished ───────────────────
         Tokens have already reached the client, so the prose cannot be
         retracted or rewritten. What can be done is to tell the client, in a
         final event, which citations did not match a real file, and to persist
         only the verified text. The reader still sees the model's own words,
         followed by an honest note about the parts that could not be checked —
         the same contract as the non-streaming path, delivered differently. */
      const knownPaths = buildKnownPathSet(scannedFiles);
      const citations =
        completeText.length > 0
          ? validateCitations(completeText, knownPaths)
          : { verified: [], fabricated: [], clean: true, uncited: false };
      const verifiedText =
        citations.fabricated.length > 0
          ? completeText + fabricationNotice(citations.fabricated)
          : completeText;

      if (citations.fabricated.length > 0) {
        logger.warn('Streamed answer contained unverifiable citations', {
          repositoryId: id,
          fabricated: citations.fabricated.slice(0, 5),
          count: citations.fabricated.length,
        });
      }

      if (completeText.length > 0) {
        await prisma.chatMessage.create({
          data: {
            repositoryId: id as string,
            sender: 'ASSISTANT',
            message: verifiedText,
            modelUsed: finalModel
          }
        });
      }

      if (!clientDisconnected) {
        // Sent before `done` so a client that renders the notice has it in hand
        // when it decides the answer is finished.
        res.write(
          `data: ${JSON.stringify({
            verification: {
              verified: citations.verified.length,
              fabricated: citations.fabricated.length,
              // The paths themselves, so the client can name them. A
              // pre-rendered notice would tie the streamed and non-streamed
              // paths to two different shapes of the same fact.
              fabricatedPaths: citations.fabricated.slice(0, 10),
              uncited: citations.uncited,
              notice:
                citations.fabricated.length > 0
                  ? fabricationNotice(citations.fabricated)
                  : null,
              // Weak retrieval is reported, not hidden — a high best-distance
              // means the answer rests on loosely-related code.
              retrievalQuality,
            },
          })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ done: true, modelUsed: finalModel })}\n\n`);
        res.end();
      }
    } finally {
      clearTimeout(streamTimer);
      req.removeListener('close', onClose);
    }
  } catch (error) {
    if (contextPrepared && req.user?.userId) {
      await entitlementService.refundAiQuestion(req.user.userId).catch(() => {});
    }
    next(error);
  }
}

/**
 * Retrieves chat history for a repository.
 */
export async function getChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized.', 401);
    }

    const repo = await prisma.repository.findFirst({
      where: { id: id as string, userId: userId as string },
      select: { id: true }
    });
    if (!repo) {
      throw new AppError('Repository not found or access denied.', 404);
    }

    const messages = await prisma.chatMessage.findMany({
      where: { repositoryId: id as string },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        sender: true,
        message: true,
        modelUsed: true,
        createdAt: true
      }
    });

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
}

export const chatOrchestrator = {
  prepareChatContext,
  executeChatWithRepo,
  executeChatWithRepoStream,
  getChatHistory
};
