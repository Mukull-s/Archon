import ts from 'typescript';
import path from 'path';

export interface ASTMetadata {
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
}

/**
 * Parses source file content (TypeScript, JavaScript, Python).
 * Extracts imports, exports, functions, and classes.
 */
export function parseSourceFile(filePath: string, fileContent: string): ASTMetadata {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Handle Python files via robust regex pattern matching
  if (normalizedPath.endsWith('.py')) {
    const pyImports: string[] = [];
    const pyExports: string[] = [];
    const pyFunctions: string[] = [];
    const pyClasses: string[] = [];

    const lines = fileContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed) continue;

      // Match: from .foo import bar, from foo.bar import baz, from ..utils import helper
      const fromMatch = trimmed.match(/^from\s+([.\w]+)\s+import\s+/);
      if (fromMatch) {
        pyImports.push(fromMatch[1]);
      } else {
        // Match: import foo, import foo.bar
        const importMatch = trimmed.match(/^import\s+([.\w]+)/);
        if (importMatch) {
          pyImports.push(importMatch[1]);
        }
      }

      // Match function declarations: def my_func(
      const funcMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\(/);
      if (funcMatch) {
        pyFunctions.push(funcMatch[1]);
        pyExports.push(funcMatch[1]);
      }

      // Match class declarations: class MyClass: or class MyClass(Base):
      const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)\s*[:\(]/);
      if (classMatch) {
        pyClasses.push(classMatch[1]);
        pyExports.push(classMatch[1]);
      }
    }

    return {
      imports: Array.from(new Set(pyImports)),
      exports: Array.from(new Set(pyExports)),
      functions: Array.from(new Set(pyFunctions)),
      classes: Array.from(new Set(pyClasses)),
    };
  }

  // Handle TypeScript & JavaScript files
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
    // 1. Extract Imports (Static imports)
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
    }
    // 2. Extract Re-Exports & Barrel Module Specifiers:
    // export * from './foo' or export { bar } from './foo' or export * as x from './foo'
    else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(el => {
          exports.push(el.name.text);
        });
      } else if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
        exports.push(node.exportClause.name.text);
      }
    }
    // 3. Dynamic import() and CommonJS require()
    else if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        imports.push((node.arguments[0] as ts.StringLiteral).text);
      } else if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length >= 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        imports.push((node.arguments[0] as ts.StringLiteral).text);
      }
    }
    // 4. import x = require('...')
    else if (ts.isImportEqualsDeclaration(node)) {
      if (
        ts.isExternalModuleReference(node.moduleReference) &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        imports.push(node.moduleReference.expression.text);
      }
    }
    // 5. Default Export assignments
    else if (ts.isExportAssignment(node)) {
      if (ts.isIdentifier(node.expression)) {
        exports.push(node.expression.text);
      } else {
        exports.push('default');
      }
    }
    // 6. Named export statements
    else if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
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

    // 7. Extract Functions
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push(node.name.text);
    } else if (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      if (ts.isIdentifier(node.name)) {
        functions.push(node.name.text);
      }
    }

    // 8. Extract Classes & Methods
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
 * Handles relative imports, tsconfig alias path imports (@/*), monorepo sub-apps, and Python imports.
 */
export function resolveDependencies(workspaceFiles: string[], astMap: Record<string, ASTMetadata>): Record<string, string[]> {
  const dependencyGraph: Record<string, string[]> = {};
  const fileSet = new Set(workspaceFiles.map(f => f.replace(/\\/g, '/')));

  for (const [filePath, metadata] of Object.entries(astMap)) {
    const resolvedDeps: string[] = [];
    const normalizedFilePath = filePath.replace(/\\/g, '/');

    for (const rawImport of metadata.imports) {
      const candidates: string[] = [];

      // Python import resolution
      if (normalizedFilePath.endsWith('.py')) {
        const importDir = path.posix.dirname(normalizedFilePath);
        if (rawImport.startsWith('.')) {
          // Relative python import (e.g. .models or ..utils)
          const relPath = rawImport.replace(/^\.+/, m => '../'.repeat(m.length - 1)).replace(/\./g, '/');
          candidates.push(path.posix.normalize(path.posix.join(importDir, relPath)));
        } else {
          // Absolute / package python import (e.g. app.models -> app/models)
          const slashPath = rawImport.replace(/\./g, '/');
          candidates.push(slashPath);
          candidates.push(path.posix.join(importDir, slashPath));
        }
      }
      // JS / TS relative imports
      else if (rawImport.startsWith('.') || rawImport.startsWith('..')) {
        const importDir = path.posix.dirname(normalizedFilePath);
        const absoluteImportPath = path.posix.normalize(path.posix.join(importDir, rawImport));
        candidates.push(absoluteImportPath);
      }
      // TS alias imports (@/...)
      else if (rawImport.startsWith('@/')) {
        const subPath = rawImport.replace(/^@\//, 'src/');
        candidates.push(subPath);
        // If file is inside a monorepo sub-package (e.g. client/src/... or frontend/src/...)
        const parts = normalizedFilePath.split('/');
        if (parts.length > 1) {
          candidates.push(path.posix.join(parts[0], subPath));
          candidates.push(path.posix.join(parts[0], rawImport.replace(/^@\//, '')));
        }
      }
      // Direct matching / bare path imports (e.g. "src/controllers/auth" or "server/src/...")
      else {
        candidates.push(rawImport);
        candidates.push(`src/${rawImport}`);
        const parts = normalizedFilePath.split('/');
        if (parts.length > 1) {
          candidates.push(path.posix.join(parts[0], rawImport));
          candidates.push(path.posix.join(parts[0], `src/${rawImport}`));
        }
      }

      // Add common file extensions and index resolution
      const extendedCandidates: string[] = [];
      for (const cand of candidates) {
        extendedCandidates.push(
          cand,
          `${cand}.ts`,
          `${cand}.tsx`,
          `${cand}.js`,
          `${cand}.jsx`,
          `${cand}.mjs`,
          `${cand}.cjs`,
          `${cand}.py`,
          path.posix.join(cand, 'index.ts'),
          path.posix.join(cand, 'index.tsx'),
          path.posix.join(cand, 'index.js'),
          path.posix.join(cand, 'index.jsx'),
          path.posix.join(cand, '__init__.py')
        );
      }

      const normalizedExtended = extendedCandidates.map(c => c.replace(/\\/g, '/'));

      for (const candidate of normalizedExtended) {
        if (fileSet.has(candidate)) {
          resolvedDeps.push(candidate);
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
    const normFile = file.replace(/\\/g, '/');
    if (normFile === normalizedTarget) continue;
    if (Array.isArray(imports) && imports.some(imp => imp.replace(/\\/g, '/') === normalizedTarget)) {
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
      const normFile = file.replace(/\\/g, '/');
      if (normFile === current) continue;
      if (Array.isArray(imports) && imports.some(imp => imp.replace(/\\/g, '/') === current)) {
        dfs(normFile, depth + 1);
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

