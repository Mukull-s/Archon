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
}

export class PlannerService {
  /**
   * Plans the retrieval steps based on the user's query text.
   */
  planQuery(queryText: string): Plan {
    const lower = queryText.toLowerCase();
    
    // Heuristics for intent detection
    let intent: QueryIntent = 'GENERAL';
    const steps: string[] = [];
    let limit = 8;
    let useFts = true;
    let useVector = true;

    if (
      lower.includes('dependency') ||
      lower.includes('depends') ||
      lower.includes('imports') ||
      lower.includes('imported') ||
      lower.includes('dependency graph')
    ) {
      intent = 'DEPENDENCY';
      steps.push('Walk dependency import graph edges');
      steps.push('Identify topological hotspots and centrality');
      useVector = false; // Dependency queries rely mostly on structural graph, skip vector
      limit = 6;
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
      useVector
    };
  }
}

export const plannerService = new PlannerService();
export default plannerService;
