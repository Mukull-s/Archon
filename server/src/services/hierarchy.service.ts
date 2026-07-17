import path from 'path';

export enum HierarchyLevel {
  REPOSITORY_IDENTITY = 1,
  ARCHITECTURE = 2,
  EXECUTION_FLOW = 3,
  DEPENDENCIES = 4,
  IMPACT_ANALYSIS = 5,
  BUSINESS_LOGIC = 6,
  DOCUMENTATION = 7,
  COMMENTS = 8
}

export interface ClassifiableChunk {
  filePath: string;
  symbolName: string | null;
  content: string;
  startLine: number;
  endLine: number;
  inDegree?: number;
}

export interface CategorizedChunk extends ClassifiableChunk {
  inDegree: number;
  level: HierarchyLevel;
  levelName: string;
  priorityScore: number; // calculated for sorting/ranking
}

class HierarchyService {
  /**
   * Classifies a file path and AST symbol name into a specific Intelligence Hierarchy level.
   */
  classifyPath(filePath: string, symbolName?: string | null): HierarchyLevel {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const ext = path.extname(normalized);

    // 1. Documentation
    if (ext === '.md' || normalized.includes('docs/') || normalized.includes('doc/')) {
      return HierarchyLevel.DOCUMENTATION;
    }

    // 2. Comments chunk (if explicitly marked as comment or if it starts with comment blocks in AST)
    if (symbolName && (symbolName.includes('comment') || symbolName.includes('jsdoc'))) {
      return HierarchyLevel.COMMENTS;
    }

    // 3. Repository Identity
    const identityFiles = [
      'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'cargo.toml', 'cargo.lock', 'tsconfig.json', 'jsconfig.json',
      'next.config.js', 'next.config.mjs', 'next.config.ts',
      'vite.config.js', 'vite.config.ts', 'vite.config.mjs',
      'nuxt.config.js', 'nuxt.config.ts', 'svelte.config.js',
      'angular.json', 'webpack.config.js', 'gemfile', 'requirements.txt',
      '.env', '.env.example', '.env.local', '.env.production', '.env.development'
    ];
    
    const fileBasename = path.basename(normalized);
    if (identityFiles.includes(fileBasename)) {
      return HierarchyLevel.REPOSITORY_IDENTITY;
    }

    // 4. Architecture
    if (
      normalized.includes('/config/') || 
      normalized.includes('/configs/') ||
      normalized.includes('config.ts') ||
      normalized.includes('config.js')
    ) {
      return HierarchyLevel.ARCHITECTURE;
    }

    // 5. Execution Flow
    if (
      normalized.includes('/routes/') || 
      normalized.includes('/route/') || 
      normalized.includes('.routes.ts') || 
      normalized.includes('.routes.js') ||
      normalized.includes('.route.ts') || 
      normalized.includes('.route.js') ||
      normalized.includes('/controllers/') || 
      normalized.includes('/controller/') || 
      normalized.includes('.controller.ts') || 
      normalized.includes('.controller.js') ||
      normalized.includes('/middlewares/') || 
      normalized.includes('/middleware/') ||
      normalized.includes('middleware.ts') ||
      normalized.includes('middleware.js')
    ) {
      return HierarchyLevel.EXECUTION_FLOW;
    }

    // 6. Dependencies
    if (
      normalized.includes('prisma/schema.prisma') || 
      normalized.includes('/models/') || 
      normalized.includes('/model/') ||
      normalized.includes('.model.ts') || 
      normalized.includes('.model.js') ||
      normalized.includes('/db/') ||
      normalized.includes('database.ts') ||
      normalized.includes('database.js')
    ) {
      return HierarchyLevel.DEPENDENCIES;
    }

    // 7. Impact Analysis
    if (normalized.includes('/graphs/') || normalized.includes('impact') || normalized.includes('dependency-graph')) {
      return HierarchyLevel.IMPACT_ANALYSIS;
    }

    // 8. Business Logic (Services, Helper methods, repositories)
    if (
      normalized.includes('/services/') || 
      normalized.includes('/service/') ||
      normalized.includes('.service.ts') || 
      normalized.includes('.service.js') ||
      normalized.includes('/repositories/') ||
      normalized.includes('/repository/') ||
      normalized.includes('.repository.ts') ||
      normalized.includes('/utils/') || 
      normalized.includes('/helper/') || 
      normalized.includes('/helpers/')
    ) {
      return HierarchyLevel.BUSINESS_LOGIC;
    }

    // Fallback: If it's code, default to Business Logic.
    return HierarchyLevel.BUSINESS_LOGIC;
  }

  /**
   * Returns a priority multiplier for ranking and boosting RAG results.
   * Higher priority levels get larger boosting factors.
   */
  getPriorityMultiplier(level: HierarchyLevel): number {
    switch (level) {
      case HierarchyLevel.REPOSITORY_IDENTITY: return 2.0;
      case HierarchyLevel.ARCHITECTURE: return 1.8;
      case HierarchyLevel.EXECUTION_FLOW: return 1.6;
      case HierarchyLevel.DEPENDENCIES: return 1.4;
      case HierarchyLevel.IMPACT_ANALYSIS: return 1.2;
      case HierarchyLevel.BUSINESS_LOGIC: return 1.0;
      case HierarchyLevel.DOCUMENTATION: return 0.8;
      case HierarchyLevel.COMMENTS: return 0.5;
      default: return 1.0;
    }
  }

  /**
   * Categorizes a list of chunks, calculates priority scores (integrating in-degree centrality),
   * and sorts them according to the Intelligence Hierarchy.
   */
  categorizeAndSortChunks(chunks: ClassifiableChunk[], inDegreeMap: Record<string, number> = {}): CategorizedChunk[] {
    return chunks.map(chunk => {
      const level = this.classifyPath(chunk.filePath, chunk.symbolName);
      const levelName = HierarchyLevel[level];
      const multiplier = this.getPriorityMultiplier(level);
      
      const inDegree = chunk.inDegree ?? (inDegreeMap[chunk.filePath] || 0);
      
      // priorityScore combines hierarchy priority (via multiplier) and topological dependency weight (inDegree)
      const priorityScore = multiplier * (1 + Math.log1p(inDegree));

      return {
        ...chunk,
        inDegree,
        level,
        levelName,
        priorityScore
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Dynamically allocates context window tokens, preserving high-priority tiers,
   * and discarding lower-priority tiers (like Comments, Docs) if the token limit is exceeded.
   * Assumes ~4 characters per token as a safe heuristic.
   */
  allocateTokens(chunks: CategorizedChunk[], maxTokenLimit = 8000): CategorizedChunk[] {
    const characterLimit = maxTokenLimit * 4;
    let currentCharacters = 0;
    const acceptedChunks: CategorizedChunk[] = [];

    // Sort by hierarchy priority order first
    const sorted = [...chunks].sort((a, b) => a.level - b.level);

    for (const chunk of sorted) {
      const chunkChars = chunk.content.length;
      if (currentCharacters + chunkChars <= characterLimit) {
        acceptedChunks.push(chunk);
        currentCharacters += chunkChars;
      } else {
        // If we are at identity or architecture level, try to fit a smaller part or keep it.
        // For lower tiers, discard entirely to protect context boundaries.
        if (chunk.level <= HierarchyLevel.ARCHITECTURE) {
          const remainingSpace = characterLimit - currentCharacters;
          if (remainingSpace > 200) { // Keep at least a stub/definition
            acceptedChunks.push({
              ...chunk,
              content: chunk.content.slice(0, remainingSpace) + '\n\n[Content truncated due to context window token limit]'
            });
            currentCharacters = characterLimit;
            break;
          }
        }
      }
    }

    return acceptedChunks;
  }
}

export const hierarchyService = new HierarchyService();
export default hierarchyService;
