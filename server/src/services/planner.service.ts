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

export const plannerService = new PlannerService();
export default plannerService;
