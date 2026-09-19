import path from 'path';

export type DependencyRelationship =
  | 'DIRECT_DEPENDENCY'
  | 'TRANSITIVE_DEPENDENCY'
  | 'REVERSE_DEPENDENCY'
  | 'REVERSE_TRANSITIVE_DEPENDENCY'
  | 'NO_DEPENDENCY'
  | 'AMBIGUOUS'
  | 'AMBIGUOUS_ENTITY'
  | 'NOT_FOUND'
  | 'OUTBOUND_LIST'
  | 'INBOUND_LIST'
  | 'SELF';

export interface ResolvedEntity {
  mention: string;
  resolvedPath: string;
  status: 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND';
  candidates?: string[];
}

export interface SourceEvidenceItem {
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
  line?: number;
  content: string;
  statement?: string;
  description: string;
}

export interface DependencyAnalysisResult {
  intent: 'DEPENDENCY';
  queryType:
    | 'DIRECT_CHECK'        // "Does X depend on Y?"
    | 'OUTBOUND_LIST'       // "What does X depend on?"
    | 'INBOUND_LIST'        // "What depends on X?"
    | 'PATH_FIND'           // "How does X reach Y?"
    | 'COUNT'               // "How many files depend on X?"
    | 'AMBIGUOUS'           // Multiple matches for a file
    | 'NOT_FOUND'           // Entity not found in repository
    | 'GENERAL';

  source?: ResolvedEntity;
  target?: ResolvedEntity;
  sourceFile?: string;
  targetFile?: string;

  relationship: DependencyRelationship;
  exists: boolean;
  direction?: 'OUTBOUND' | 'INBOUND' | 'BIDIRECTIONAL' | 'NONE';
  hops?: number;
  path?: string[];
  directImports?: string[];
  importedBy?: string[];

  evidence: SourceEvidenceItem[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  factualSummary: string;
  executedSteps: string[];
}

export class DependencyIntelligenceService {
  /**
   * Normalizes any file path string to forward slashes with leading './' removed.
   */
  normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '').trim();
  }

  /**
   * Normalizes the dependency graph to standard forward-slash paths and de-duplicates imports.
   */
  normalizeGraph(graph: Record<string, string[]>): Record<string, string[]> {
    const normalized: Record<string, string[]> = {};
    for (const [source, imports] of Object.entries(graph || {})) {
      const normSource = this.normalizePath(source);
      const normImports = Array.isArray(imports)
        ? Array.from(new Set(imports.map(imp => this.normalizePath(imp))))
        : [];
      normalized[normSource] = normImports;
    }
    return normalized;
  }

  /**
   * Constructs an inverted reverse graph where key is target and value is array of files importing key.
   */
  buildReverseGraph(normalizedGraph: Record<string, string[]>): Record<string, string[]> {
    const reverseGraph: Record<string, string[]> = {};
    for (const [source, imports] of Object.entries(normalizedGraph)) {
      for (const imp of imports) {
        if (!reverseGraph[imp]) {
          reverseGraph[imp] = [];
        }
        reverseGraph[imp].push(source);
      }
    }
    // De-duplicate lists
    for (const [key, val] of Object.entries(reverseGraph)) {
      reverseGraph[key] = Array.from(new Set(val));
    }
    return reverseGraph;
  }

  /**
   * Resolves a file mention (e.g. "auth.service", "token.ts", "src/utils/token")
   * against the repository's list of scanned files.
   *
   * Handles:
   * - Common file extensions (.ts, .tsx, .js, .jsx, .py, .prisma, .json, etc.)
   * - Omitted parent directories (basename match)
   * - Forward vs backslash differences
   * - Ambiguity detection (if 2+ files match, returns AMBIGUOUS without guessing)
   */
  resolveEntity(mention: string, fileList: string[]): ResolvedEntity {
    const rawMention = mention.trim();
    const cleanMention = this.normalizePath(rawMention).toLowerCase();

    const normalizedFiles = fileList.map(f => this.normalizePath(f));
    const lowerToFileMap = new Map<string, string>();
    normalizedFiles.forEach(f => lowerToFileMap.set(f.toLowerCase(), f));

    // 1. Exact full path match (case-insensitive)
    if (lowerToFileMap.has(cleanMention)) {
      return {
        mention: rawMention,
        resolvedPath: lowerToFileMap.get(cleanMention)!,
        status: 'RESOLVED'
      };
    }

    // 2. Exact match with common extensions if omitted
    const commonExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.prisma', '.json', '.vue', '.svelte'];
    for (const ext of commonExtensions) {
      const withExt = `${cleanMention}${ext}`;
      if (lowerToFileMap.has(withExt)) {
        return {
          mention: rawMention,
          resolvedPath: lowerToFileMap.get(withExt)!,
          status: 'RESOLVED'
        };
      }
    }

    // 3. Path suffix match (e.g. "services/auth.service.ts" or "utils/token.ts")
    const suffixMatches: string[] = [];
    for (const f of normalizedFiles) {
      const fLower = f.toLowerCase();
      if (fLower.endsWith(`/${cleanMention}`) || fLower === cleanMention) {
        suffixMatches.push(f);
      } else {
        // Try with extensions
        for (const ext of commonExtensions) {
          if (fLower.endsWith(`/${cleanMention}${ext}`) || fLower === `${cleanMention}${ext}`) {
            suffixMatches.push(f);
            break;
          }
        }
      }
    }

    if (suffixMatches.length === 1) {
      return {
        mention: rawMention,
        resolvedPath: suffixMatches[0],
        status: 'RESOLVED'
      };
    } else if (suffixMatches.length > 1) {
      return {
        mention: rawMention,
        resolvedPath: '',
        status: 'AMBIGUOUS',
        candidates: Array.from(new Set(suffixMatches))
      };
    }

    // 4. Basename match (e.g. "auth.service.ts" or "token.ts" or "auth.service")
    const baseMention = path.posix.basename(cleanMention);
    const basenameMatches: string[] = [];

    for (const f of normalizedFiles) {
      const fBase = path.posix.basename(f).toLowerCase();
      if (fBase === baseMention) {
        basenameMatches.push(f);
      } else {
        for (const ext of commonExtensions) {
          if (fBase === `${baseMention}${ext}` || `${fBase}` === `${baseMention}`) {
            basenameMatches.push(f);
            break;
          }
          // Handle case where baseMention already has extension stripped
          const fBaseNoExt = fBase.replace(/\.[^/.]+$/, '');
          if (fBaseNoExt === baseMention) {
            basenameMatches.push(f);
            break;
          }
        }
      }
    }

    const uniqueBasenameMatches = Array.from(new Set(basenameMatches));

    if (uniqueBasenameMatches.length === 1) {
      return {
        mention: rawMention,
        resolvedPath: uniqueBasenameMatches[0],
        status: 'RESOLVED'
      };
    } else if (uniqueBasenameMatches.length > 1) {
      return {
        mention: rawMention,
        resolvedPath: '',
        status: 'AMBIGUOUS',
        candidates: uniqueBasenameMatches
      };
    }

    return {
      mention: rawMention,
      resolvedPath: '',
      status: 'NOT_FOUND'
    };
  }

  /**
   * Extracts potential entity mentions from the user's query text.
   */
  extractEntityMentions(queryText: string): string[] {
    const mentions = new Set<string>();

    // Pattern 1: Backtick, single quote, or double quote wrapped strings: `foo.ts`, 'auth.service'
    const quotedRegex = /[`'"]([a-zA-Z0-9_\-./\\]+)['`"]/g;
    let match: RegExpExecArray | null;
    while ((match = quotedRegex.exec(queryText)) !== null) {
      const val = match[1].trim();
      if (val && !['x', 'y', 'a', 'b'].includes(val.toLowerCase())) {
        mentions.add(val);
      }
    }

    // Pattern 2: Explicit file patterns with extensions: auth.service.ts, index.js, schema.prisma
    const extRegex = /\b([a-zA-Z0-9_\-./\\]+\.(ts|tsx|js|jsx|py|prisma|json|css|html|sql|md|vue|svelte))\b/gi;
    while ((match = extRegex.exec(queryText)) !== null) {
      mentions.add(match[1]);
    }

    // Pattern 3: Common structural file suffixes even without final extension:
    // e.g. auth.service, repo.controller, token.util, auth.routes, user.model
    const suffixRegex = /\b([a-zA-Z0-9_\-./\\]+\.(service|controller|routes?|model|middleware|helper|util|utils|config|test|spec|schema))\b/gi;
    while ((match = suffixRegex.exec(queryText)) !== null) {
      mentions.add(match[1]);
    }

    return Array.from(mentions);
  }

  /**
   * Performs bounded Breadth-First Search (BFS) to find the shortest dependency path from source to target.
   * Protected against cycles (circular dependencies).
   */
  findDependencyPath(
    source: string,
    target: string,
    normalizedGraph: Record<string, string[]>,
    maxHops = 6
  ): { found: boolean; path: string[]; hops: number } {
    if (source === target) {
      return { found: true, path: [source], hops: 0 };
    }

    const queue: Array<{ current: string; path: string[] }> = [{ current: source, path: [source] }];
    const visited = new Set<string>([source]);

    while (queue.length > 0) {
      const { current, path: currentPath } = queue.shift()!;

      if (currentPath.length - 1 >= maxHops) {
        continue;
      }

      const neighbors = normalizedGraph[current] || [];
      for (const neighbor of neighbors) {
        if (neighbor === target) {
          const finalPath = [...currentPath, neighbor];
          return { found: true, path: finalPath, hops: finalPath.length - 1 };
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ current: neighbor, path: [...currentPath, neighbor] });
        }
      }
    }

    return { found: false, path: [], hops: 0 };
  }

  /**
   * Extracts targeted source code import evidence for a verified dependency relationship.
   */
  extractSourceEvidence(
    sourcePath: string,
    targetPath: string,
    rawChunks: Array<{ filePath: string; content: string; startLine: number; endLine: number }>,
    astMetadata?: Record<string, { imports: string[] }>
  ): SourceEvidenceItem[] {
    const evidence: SourceEvidenceItem[] = [];
    const sourceChunks = rawChunks.filter(c => this.normalizePath(c.filePath) === sourcePath);
    const targetBase = path.posix.basename(targetPath).replace(/\.[^/.]+$/, ''); // target basename without ext

    // Scan chunks for actual import line
    for (const chunk of sourceChunks) {
      const lines = chunk.content.split('\n');
      lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (
          (trimmed.startsWith('import ') || trimmed.startsWith('export ') || trimmed.startsWith('const ') || trimmed.startsWith('from ')) &&
          (trimmed.includes(targetBase) || trimmed.includes(path.posix.basename(targetPath)))
        ) {
          const actualLine = chunk.startLine + idx;
          evidence.push({
            filePath: sourcePath,
            lineStart: actualLine,
            lineEnd: actualLine,
            line: actualLine,
            content: trimmed,
            statement: trimmed,
            description: `[${sourcePath}:${actualLine}] directly imports [${targetPath}]`
          });
        }
      });
    }

    // Fallback to AST metadata if chunk scan was empty (e.g. unindexed or wide chunk)
    if (evidence.length === 0 && astMetadata && astMetadata[sourcePath]?.imports) {
      const rawImports = astMetadata[sourcePath].imports;
      const matchingRawImport = rawImports.find((imp: any) => {
        const importStr = typeof imp === 'string' ? imp : (imp?.source || imp?.moduleSpecifier || '');
        return importStr.includes(targetBase) || importStr.includes(path.posix.basename(targetPath));
      });
      if (matchingRawImport) {
        const importStr = typeof matchingRawImport === 'string' ? matchingRawImport : ((matchingRawImport as any)?.source || (matchingRawImport as any)?.moduleSpecifier || '');
        evidence.push({
          filePath: sourcePath,
          lineStart: 1,
          lineEnd: 1,
          line: 1,
          content: `import ... from '${importStr}';`,
          statement: `import ... from '${importStr}';`,
          description: `AST import specifier '${importStr}' resolves to [${targetPath}]`
        });
      }
    }

    return evidence;
  }

  /**
   * The core deterministic dependency analysis pipeline.
   * Resolves entities, executes graph algorithms, and outputs an authoritative factual result.
   */
  analyzeDependencies(params: {
    queryText: string;
    scannedFiles: Array<{ path: string }>;
    dependencyGraph: Record<string, string[]>;
    astMetadata?: Record<string, any>;
    codeChunks?: Array<{ filePath: string; content: string; startLine: number; endLine: number }>;
  }): DependencyAnalysisResult {
    const { queryText, scannedFiles, dependencyGraph, astMetadata, codeChunks = [] } = params;
    const executedSteps: string[] = [];

    const fileList = scannedFiles.map(f => this.normalizePath(f.path));
    const normalizedGraph = this.normalizeGraph(dependencyGraph);
    const reverseGraph = this.buildReverseGraph(normalizedGraph);

    executedSteps.push(`Normalized AST dependency graph (${Object.keys(normalizedGraph).length} source nodes)`);

    // 1. Extract entity mentions from query
    const mentions = this.extractEntityMentions(queryText);
    executedSteps.push(`Extracted ${mentions.length} entity candidate mention(s) from query`);

    // 2. Resolve entities against repository
    const resolvedEntities: ResolvedEntity[] = mentions.map(m => this.resolveEntity(m, fileList));

    // Handle ambiguous matches immediately
    const ambiguousEntity = resolvedEntities.find(e => e.status === 'AMBIGUOUS');
    if (ambiguousEntity) {
      executedSteps.push(`Ambiguous entity match detected for "${ambiguousEntity.mention}": ${(ambiguousEntity.candidates || []).join(', ')}`);
      const candidatesList = (ambiguousEntity.candidates || []).map(c => `\`${c}\``).join(', ');
      return {
        intent: 'DEPENDENCY',
        queryType: 'AMBIGUOUS',
        source: ambiguousEntity,
        sourceFile: ambiguousEntity.resolvedPath,
        relationship: 'AMBIGUOUS_ENTITY',
        exists: false,
        evidence: [],
        confidence: 'HIGH',
        factualSummary: `Ambiguous entity reference: The query mentions "${ambiguousEntity.mention}", which matches multiple files in the repository: ${candidatesList}. An explicit file path is required to disambiguate.`,
        executedSteps
      };
    }

    const validResolved = resolvedEntities.filter(e => e.status === 'RESOLVED');

    // Case 1: Two resolved entities -> Relationship Check (e.g. "Does A depend on B?")
    if (validResolved.length >= 2) {
      const source = validResolved[0];
      const target = validResolved[1];
      executedSteps.push(`Resolved source entity: [${source.resolvedPath}]`);
      executedSteps.push(`Resolved target entity: [${target.resolvedPath}]`);

      // A: Direct outbound dependency (source imports target)
      const directImports = normalizedGraph[source.resolvedPath] || [];
      if (directImports.includes(target.resolvedPath)) {
        executedSteps.push(`direct dependency confirmed: [${source.resolvedPath}] -> [${target.resolvedPath}] (1 hop)`);
        const evidence = this.extractSourceEvidence(source.resolvedPath, target.resolvedPath, codeChunks, astMetadata);
        if (evidence.length > 0) {
          executedSteps.push(`Extracted targeted source code evidence from line ${evidence[0].lineStart || 'import'}`);
        }

        return {
          intent: 'DEPENDENCY',
          queryType: 'DIRECT_CHECK',
          source,
          target,
          sourceFile: source.resolvedPath,
          targetFile: target.resolvedPath,
          relationship: 'DIRECT_DEPENDENCY',
          exists: true,
          direction: 'OUTBOUND',
          hops: 1,
          path: [source.resolvedPath, target.resolvedPath],
          evidence,
          confidence: 'HIGH',
          factualSummary: `[${source.resolvedPath}] directly depends on [${target.resolvedPath}]. It imports it directly (1 hop).`,
          executedSteps
        };
      }

      // B: Reverse dependency (target imports source)
      const reverseDirect = normalizedGraph[target.resolvedPath] || [];
      if (reverseDirect.includes(source.resolvedPath)) {
        executedSteps.push(`Reverse dependency detected: [${target.resolvedPath}] imports [${source.resolvedPath}] (1 hop)`);
        const evidence = this.extractSourceEvidence(target.resolvedPath, source.resolvedPath, codeChunks, astMetadata);
        return {
          intent: 'DEPENDENCY',
          queryType: 'DIRECT_CHECK',
          source,
          target,
          sourceFile: source.resolvedPath,
          targetFile: target.resolvedPath,
          relationship: 'REVERSE_DEPENDENCY',
          exists: true,
          direction: 'INBOUND',
          hops: 1,
          path: [target.resolvedPath, source.resolvedPath],
          evidence,
          confidence: 'HIGH',
          factualSummary: `[${source.resolvedPath}] does NOT depend on [${target.resolvedPath}]. Instead, the reverse is true: [${target.resolvedPath}] directly imports [${source.resolvedPath}].`,
          executedSteps
        };
      }

      // C: Transitive forward dependency path (source -> ... -> target)
      executedSteps.push(`Executing bounded BFS graph traversal for transitive path...`);
      const forwardPath = this.findDependencyPath(source.resolvedPath, target.resolvedPath, normalizedGraph, 6);
      if (forwardPath.found) {
        executedSteps.push(`Transitive dependency confirmed (${forwardPath.hops} hops): ${forwardPath.path.join(' -> ')}`);
        // Extract evidence for first hop
        const evidence = this.extractSourceEvidence(source.resolvedPath, forwardPath.path[1], codeChunks, astMetadata);
        return {
          intent: 'DEPENDENCY',
          queryType: 'PATH_FIND',
          source,
          target,
          sourceFile: source.resolvedPath,
          targetFile: target.resolvedPath,
          relationship: 'TRANSITIVE_DEPENDENCY',
          exists: true,
          direction: 'OUTBOUND',
          hops: forwardPath.hops,
          path: forwardPath.path,
          evidence,
          confidence: 'HIGH',
          factualSummary: `[${source.resolvedPath}] transitively depends on [${target.resolvedPath}] across ${forwardPath.hops} hops: ${forwardPath.path.map(p => `[${p}]`).join(' -> ')}.`,
          executedSteps
        };
      }

      // D: Transitive reverse dependency path (target -> ... -> source)
      const reversePath = this.findDependencyPath(target.resolvedPath, source.resolvedPath, normalizedGraph, 6);
      if (reversePath.found) {
        executedSteps.push(`Reverse dependency detected: Found reverse transitive dependency path (${reversePath.hops} hops): ${reversePath.path.join(' -> ')}`);
        return {
          intent: 'DEPENDENCY',
          queryType: 'PATH_FIND',
          source,
          target,
          sourceFile: source.resolvedPath,
          targetFile: target.resolvedPath,
          relationship: 'REVERSE_TRANSITIVE_DEPENDENCY',
          exists: true,
          direction: 'INBOUND',
          hops: reversePath.hops,
          path: reversePath.path,
          evidence: [],
          confidence: 'HIGH',
          factualSummary: `[${source.resolvedPath}] does NOT depend on [${target.resolvedPath}]. Conversely, [${target.resolvedPath}] transitively depends on [${source.resolvedPath}] across ${reversePath.hops} hops: ${reversePath.path.map(p => `[${p}]`).join(' -> ')}.`,
          executedSteps
        };
      }

      // E: No dependency exists in either direction
      executedSteps.push(`No dependency path found between [${source.resolvedPath}] and [${target.resolvedPath}] in either direction.`);
      return {
        intent: 'DEPENDENCY',
        queryType: 'DIRECT_CHECK',
        source,
        target,
        sourceFile: source.resolvedPath,
        targetFile: target.resolvedPath,
        relationship: 'NO_DEPENDENCY',
        exists: false,
        direction: 'NONE',
        hops: undefined,
        path: [],
        evidence: [],
        confidence: 'HIGH',
        factualSummary: `[${source.resolvedPath}] does NOT depend on [${target.resolvedPath}]. There is no direct or transitive dependency between these files in the repository AST graph.`,
        executedSteps
      };
    }

    // Case 2: Exactly one resolved entity
    if (validResolved.length === 1) {
      const entity = validResolved[0];
      executedSteps.push(`Resolved single entity: [${entity.resolvedPath}]`);
      const lowerQuery = queryText.toLowerCase();

      // Check if user is asking "What depends on X?" or "Who imports X?" or "How many files depend on X?"
      const isInboundQuery =
        lowerQuery.includes('what depends on') ||
        lowerQuery.includes('who depends on') ||
        lowerQuery.includes('which files depend on') ||
        lowerQuery.includes('files that depend on') ||
        lowerQuery.includes('imported by') ||
        lowerQuery.includes('who imports') ||
        lowerQuery.includes('how many files depend');

      if (isInboundQuery) {
        const importedBy = reverseGraph[entity.resolvedPath] || [];
        executedSteps.push(`Queried inbound dependents for [${entity.resolvedPath}]: ${importedBy.length} dependent files found`);

        return {
          intent: 'DEPENDENCY',
          queryType: 'INBOUND_LIST',
          source: entity,
          sourceFile: entity.resolvedPath,
          relationship: 'INBOUND_LIST',
          exists: importedBy.length > 0,
          direction: 'INBOUND',
          importedBy,
          evidence: [],
          confidence: 'HIGH',
          factualSummary: `[${entity.resolvedPath}] is directly imported by ${importedBy.length} file(s): ${importedBy.map(f => `[${f}]`).join(', ') || 'None (root or isolated node)'}.`,
          executedSteps
        };
      } else {
        // Outbound query: "What does X depend on?" or "List dependencies of X"
        const directImports = normalizedGraph[entity.resolvedPath] || [];
        executedSteps.push(`Queried outbound dependencies for [${entity.resolvedPath}]: ${directImports.length} imported files found`);

        return {
          intent: 'DEPENDENCY',
          queryType: 'OUTBOUND_LIST',
          source: entity,
          sourceFile: entity.resolvedPath,
          relationship: 'OUTBOUND_LIST',
          exists: directImports.length > 0,
          direction: 'OUTBOUND',
          directImports,
          evidence: [],
          confidence: 'HIGH',
          factualSummary: `[${entity.resolvedPath}] directly depends on ${directImports.length} file(s): ${directImports.map(f => `[${f}]`).join(', ') || 'None (leaf dependency node)'}.`,
          executedSteps
        };
      }
    }

    // Case 3: Entity mention present in query but not found in repository
    if (mentions.length > 0 && validResolved.length === 0) {
      const missing = mentions[0];
      executedSteps.push(`Entity not found in repository: "${missing}"`);
      return {
        intent: 'DEPENDENCY',
        queryType: 'NOT_FOUND',
        relationship: 'NOT_FOUND',
        exists: false,
        evidence: [],
        confidence: 'HIGH',
        factualSummary: `The requested file or entity "${missing}" was not found in the scanned repository files.`,
        executedSteps
      };
    }

    // Case 4: General dependency question without specific file mention (e.g. "Show top dependencies")
    executedSteps.push(`General dependency overview query detected`);
    return {
      intent: 'DEPENDENCY',
      queryType: 'GENERAL',
      relationship: 'NO_DEPENDENCY',
      exists: false,
      evidence: [],
      confidence: 'MEDIUM',
      factualSummary: `General dependency query across the repository AST graph.`,
      executedSteps
    };
  }
}

export const dependencyIntelligenceService = new DependencyIntelligenceService();
export default dependencyIntelligenceService;
