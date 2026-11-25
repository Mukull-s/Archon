import {
  dependencyIntelligenceService,
  DependencyAnalysisResult
} from './dependency-intelligence.service';

export type QueryIntent =
  | 'ARCHITECTURE'
  | 'DEPENDENCY'
  | 'EXECUTION_FLOW'
  | 'DATABASE'
  | 'GENERAL';

export interface Plan {
  intent: QueryIntent;
  steps: string[];
  limit: number;
  useFts: boolean;
  useVector: boolean;
  dependencyAnalysis?: DependencyAnalysisResult;
}

export interface RepoPlanningContext {
  scannedFiles: Array<{ path: string }>;
  dependencyGraph: Record<string, string[]>;
  astMetadata?: Record<string, any>;
  codeChunks?: Array<{ filePath: string; content: string; startLine: number; endLine: number }>;
}

export class PlannerService {
  /**
   * Plans the retrieval steps based on the user's query text and executes
   * real structural graph operations when repository context is available.
   */
  planQuery(queryText: string, repoContext?: RepoPlanningContext): Plan {
    const lower = queryText.toLowerCase();
    
    // Heuristics for intent detection
    let intent: QueryIntent = 'GENERAL';
    const steps: string[] = [];
    let limit = 8;
    let useFts = true;
    let useVector = true;
    let dependencyAnalysis: DependencyAnalysisResult | undefined;

    if (
      lower.includes('dependency') ||
      lower.includes('depends') ||
      lower.includes('depend on') ||
      lower.includes('imports') ||
      lower.includes('imported') ||
      lower.includes('dependency graph') ||
      lower.includes('call graph') ||
      lower.includes('depend upon')
    ) {
      intent = 'DEPENDENCY';

      if (repoContext && repoContext.scannedFiles && repoContext.dependencyGraph) {
        // Execute REAL deterministic graph intelligence operation
        dependencyAnalysis = dependencyIntelligenceService.analyzeDependencies({
          queryText,
          scannedFiles: repoContext.scannedFiles,
          dependencyGraph: repoContext.dependencyGraph,
          astMetadata: repoContext.astMetadata,
          codeChunks: repoContext.codeChunks
        });

        // Use the actual executed steps from the graph engine
        steps.push(...dependencyAnalysis.executedSteps);

        // For specific entity queries, prioritize structural graph truth over vector search
        if (dependencyAnalysis.queryType !== 'GENERAL') {
          useVector = false;
        } else {
          useVector = true;
        }
      } else {
        steps.push('Extract entity mentions from query');
        steps.push('Resolve entities against scanned files');
        steps.push('Query AST dependency graph');
        useVector = false;
      }
      limit = 10;
    } else if (
      lower.includes('flow') ||
      lower.includes('execution') ||
      lower.includes('route') ||
      lower.includes('endpoint') ||
      lower.includes('controller') ||
      lower.includes('trace') ||
      lower.includes('request')
    ) {
      intent = 'EXECUTION_FLOW';
      steps.push('Extract route endpoints and controller mappings');
      steps.push('Trace controller to service methods');
      steps.push('Fetch execution chunks and execution tree');
      limit = 15;
    } else if (
      lower.includes('database') ||
      lower.includes('db') ||
      lower.includes('prisma') ||
      lower.includes('model') ||
      lower.includes('schema') ||
      lower.includes('table')
    ) {
      intent = 'DATABASE';
      steps.push('Analyze database schemas (prisma/schema.prisma)');
      steps.push('Identify schema ORM model entities');
      steps.push('Retrieve database client imports in services');
      limit = 10;
    } else if (
      lower.includes('architecture') ||
      lower.includes('directory') ||
      lower.includes('folder') ||
      lower.includes('structure') ||
      lower.includes('framework') ||
      lower.includes('project setup')
    ) {
      intent = 'ARCHITECTURE';
      steps.push('Classify workspace entry points');
      steps.push('Fetch configuration chunks (package.json, tsconfig.json)');
      steps.push('Retrieve architectural layout rules');
      limit = 12;
    } else if (isConversational(queryText)) {
      /*
       * Not a codebase question at all — a greeting, thanks, an aside, or
       * something rude. Retrieval must NOT run for these.
       *
       * Without this branch an off-topic message falls through to GENERAL and
       * gets vector-matched against the code, so "fuck you" returned the
       * nearest chunk — which happened to be auth code — and the model dutifully
       * explained authentication. The answer was grounded and irrelevant, which
       * is worse than not answering: it reads as if the assistant ignored you.
       *
       * Marked so the orchestrator sends no context and the model replies in its
       * own voice. This is a routing decision, not a content filter — abuse is
       * answered calmly and briefly, never with the repository's source code.
       */
      intent = 'GENERAL';
      steps.push('Classify as conversation — no repository retrieval');
      useVector = false;
      useFts = false;
      limit = 0;
    } else {
      intent = 'GENERAL';
      steps.push('Generate query vector embedding');
      steps.push('Perform pgvector similarity search');
      steps.push('Perform Postgres text FTS query');
      steps.push('Blend and sort context chunks via Reciprocal Rank Fusion');
    }

    return {
      intent,
      steps,
      limit,
      useFts,
      useVector,
      dependencyAnalysis
    };
  }
}

/**
 * Is this message addressed to the assistant rather than to the repository?
 *
 * Deliberately narrow. It must not swallow a real question that merely contains
 * a small talk word — "what is the auth flow?" contains no trigger and is left
 * to retrieval, while "hi", "thanks" and "are you stupid?" are caught.
 *
 * The list is short and literal on purpose. A loose matcher here would silently
 * disable retrieval for legitimate questions, which is a far worse failure than
 * answering an aside with an aside.
 */
const CONVERSATIONAL = [
  /^(hi|hey|hello|yo|sup|good (morning|afternoon|evening))\b/i,
  /^(thanks|thank you|ty|cheers|nice|great|cool|ok|okay|got it|perfect|awesome)\b[.!]*$/i,
  /^(bye|goodbye|see you|good night)\b/i,
  /^(who are you|what are you|what can you do|how do you work|help)[?!.]*$/i,
  // Profanity and abuse, aimed at the assistant. Answered plainly, not echoed.
  // `\b` on both sides — a leading lookahead cannot match at index 0 because the
  // first character is itself a word character, which made "fuck you" fail while
  // "you are useless" (matched by its own rule) passed.
  /\b(fuck|fucking|shit|bitch|asshole|idiot|stupid|dumb|useless|trash|garbage)\b/i,
  /^you (suck|are (dumb|stupid|useless|wrong))\b/i,
  /^(are you|why are you|what is wrong with you)\b/i,
];

/**
 * Is this message addressed to the assistant rather than to the repository?
 *
 * Deliberately narrow. It must not swallow a real question that merely contains
 * a small-talk word — "what is the auth flow?" is left to retrieval, while "hi",
 * "thanks" and "are you stupid?" are caught.
 *
 * The guard order matters: a codebase question always wins. "why is this
 * auth broken" contains "auth", so it is retrieved for even though it is blunt.
 * Only when no code signal and no length signal is present does the small-talk
 * match decide.
 */
function isConversational(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

  // A codebase question always wins. If the message names code, it is not an
  // aside, whatever else it contains.
  const CODE_SIGNAL = new RegExp(
    '(?=$|[^A-Za-z0-9_])(file|function|class|module|method|import|export|route|controller|service|model|schema|database|auth|api|endpoint|test|bug|error|type|interface|component|hook|repo|repository|codebase|dependency|architecture|flow|trace)(?=$|[^A-Za-z0-9_])',
    'i',
  );
  if (CODE_SIGNAL.test(t)) return false;

  // A long message is almost always a real question, not an aside.
  if (t.split(/\s+/).length > 12) return false;

  return CONVERSATIONAL.some((re) => re.test(t));
}

export const plannerService = new PlannerService();
export default plannerService;
