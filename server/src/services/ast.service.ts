import ts from 'typescript';
import path from 'path';

export interface ASTMetadata {
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
}

/**
 * Parses a TS/JS file content using the TypeScript compiler API.
 * Extracts imports, exports, functions, and classes.
 */
export function parseSourceFile(filePath: string, fileContent: string): ASTMetadata {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
  } catch (error) {
    console.error(`Error creating AST SourceFile for ${filePath}:`, error);
    return { imports: [], exports: [], functions: [], classes: [] };
  }

  const imports: string[] = [];
  const exports: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];

  function visit(node: ts.Node) {
    // 1. Extract Imports
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
    } else if (ts.isCallExpression(node)) {
      // Capture CommonJS require statements
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        imports.push((node.arguments[0] as ts.StringLiteral).text);
      }
    }

    // 2. Extract Exports
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(el => {
          exports.push(el.name.text);
        });
      }
    } else if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        exports.push(node.name.text);
      } else if (ts.isClassDeclaration(node) && node.name) {
        exports.push(node.name.text);
      } else if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(dec => {
          if (ts.isIdentifier(dec.name)) {
            exports.push(dec.name.text);
          }
        });
      }
    }

    // 3. Extract Functions
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push(node.name.text);
    } else if (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      if (ts.isIdentifier(node.name)) {
        functions.push(node.name.text);
      }
    }

    // 4. Extract Classes & Methods
    if (ts.isClassDeclaration(node) && node.name) {
      classes.push(node.name.text);
      node.members.forEach(member => {
        if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
          functions.push(`${node.name!.text}.${member.name.text}`);
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    imports: Array.from(new Set(imports)),
    exports: Array.from(new Set(exports)),
    functions: Array.from(new Set(functions)),
    classes: Array.from(new Set(classes)),
  };
}

/**
 * Resolves imports in scanned files to build a normalized file-to-file dependency graph.
 * Handles relative imports, tsconfig alias path imports (@/*), and direct/src root imports.
 */
export function resolveDependencies(workspaceFiles: string[], astMap: Record<string, ASTMetadata>): Record<string, string[]> {
  const dependencyGraph: Record<string, string[]> = {};
  const fileSet = new Set(workspaceFiles.map(f => f.replace(/\\/g, '/')));

  for (const [filePath, metadata] of Object.entries(astMap)) {
    const resolvedDeps: string[] = [];
    const normalizedFilePath = filePath.replace(/\\/g, '/');

    for (const rawImport of metadata.imports) {
      const candidates: string[] = [];

      if (rawImport.startsWith('.') || rawImport.startsWith('..')) {
        const importDir = path.dirname(normalizedFilePath);
        const absoluteImportPath = path.posix.normalize(path.posix.join(importDir, rawImport));
        candidates.push(absoluteImportPath);
      } else if (rawImport.startsWith('@/')) {
        const absoluteImportPath = rawImport.replace(/^@\//, 'src/');
        candidates.push(absoluteImportPath);
      } else {
        // Try direct matching (e.g. "src/controllers/auth")
        candidates.push(rawImport);
        // Try prefixing with src/
        candidates.push(`src/${rawImport}`);
      }

      // Add common extension extensions to try
      const extendedCandidates: string[] = [];
      for (const cand of candidates) {
        extendedCandidates.push(
          cand,
          `${cand}.ts`,
          `${cand}.tsx`,
          `${cand}.js`,
          `${cand}.jsx`,
          path.posix.join(cand, 'index.ts'),
          path.posix.join(cand, 'index.tsx'),
          path.posix.join(cand, 'index.js'),
          path.posix.join(cand, 'index.jsx')
        );
      }

      const normalizedExtended = extendedCandidates.map(c => c.replace(/\\/g, '/'));

      let matched = false;
      for (const candidate of normalizedExtended) {
        if (fileSet.has(candidate)) {
          resolvedDeps.push(candidate);
          matched = true;
          break;
        }
      }
    }

    dependencyGraph[normalizedFilePath] = Array.from(new Set(resolvedDeps));
  }

  return dependencyGraph;
}

export interface CodeSymbol {
  name: string;
  kind: 'function' | 'class';
  startLine: number;
  endLine: number;
}

export function getCodeSymbols(filePath: string, fileContent: string): CodeSymbol[] {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
  } catch (error) {
    return [];
  }

  const symbols: CodeSymbol[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      symbols.push({ name: node.name.text, kind: 'function', startLine: start, endLine: end });
    } else if (ts.isClassDeclaration(node) && node.name) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      symbols.push({ name: node.name.text, kind: 'class', startLine: start, endLine: end });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return symbols.sort((a, b) => a.startLine - b.startLine);
}

/**
 * Calculates dependencies, maximum depth, affected database models, environment variables, and the final Risk Score.
 */
export function computeImpactRisk(
  targetFile: string,
  dependencyGraph: Record<string, string[]>,
  fileContent: string
) {
  const normalizedTarget = targetFile.replace(/\\/g, '/');

  // 1. Calculate in-degree centrality (how many files import this file DIRECTLY)
  let inDegree = 0;
  for (const [file, imports] of Object.entries(dependencyGraph)) {
    if (imports.includes(normalizedTarget)) {
      inDegree++;
    }
  }

  // 2. Traversal to find all affected files and maximum depth (d_blast)
  const visited = new Set<string>();
  let maxDepth = 0;

  function dfs(current: string, depth: number) {
    if (visited.has(current)) return;
    visited.add(current);
    maxDepth = Math.max(maxDepth, depth);

    // Find all files that import the current file
    for (const [file, imports] of Object.entries(dependencyGraph)) {
      if (imports.includes(current)) {
        dfs(file, depth + 1);
      }
    }
  }

  dfs(normalizedTarget, 0);

  // Exclude target itself from affected list
  visited.delete(normalizedTarget);
  const affectedFiles = Array.from(visited);

  // 3. Risk Score calculation:
  // Rs = 0.6 * Ci + 0.4 * d_blast
  const riskScore = 0.6 * inDegree + 0.4 * maxDepth;

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (riskScore >= 5.0) {
    riskLevel = 'HIGH';
  } else if (riskScore >= 2.0) {
    riskLevel = 'MEDIUM';
  }

  // 4. Trace Database Model changes (check imports or client query usage)
  const dbModels: string[] = [];

  // Look for schema definitions or prisma.modelName queries
  // Matches: prisma.user.findUnique -> "user"
  const prismaModelRegex = /prisma\.([a-zA-Z0-9_]+)\./gi;
  let match;
  while ((match = prismaModelRegex.exec(fileContent)) !== null) {
    dbModels.push(match[1]);
  }

  // Also check if it's a prisma.schema file
  if (normalizedTarget.endsWith('.prisma')) {
    const modelDefRegex = /model\s+([a-zA-Z0-9_]+)\s+{/gi;
    let modelMatch;
    while ((modelMatch = modelDefRegex.exec(fileContent)) !== null) {
      dbModels.push(modelMatch[1]);
    }
  }

  const uniqueDbModels = Array.from(new Set(dbModels));

  // 5. Trace Environment Variables
  const envVars: string[] = [];
  const envVarRegex = /process\.env\.([a-zA-Z0-9_]+)/gi;
  let envMatch;
  while ((envMatch = envVarRegex.exec(fileContent)) !== null) {
    envVars.push(envMatch[1]);
  }
  const uniqueEnvVars = Array.from(new Set(envVars));

  return {
    filePath: normalizedTarget,
    inDegree,
    maxDepth,
    riskScore,
    riskLevel,
    affectedFiles,
    dbModels: uniqueDbModels,
    envVars: uniqueEnvVars
  };
}

