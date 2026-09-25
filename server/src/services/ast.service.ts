import ts from 'typescript';
import path from 'path';

export interface ASTMetadata {
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
}

/**
 * Strips comments outside string literals in Python.
 */
function stripPythonComments(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }
  return line;
}

/**
 * Computes Python indentation (treating tabs as 4 spaces).
 */
function getPythonIndent(line: string): number {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') count += 1;
    else if (line[i] === '\t') count += 4;
    else break;
  }
  return count;
}

/**
 * Extracts explicit exports from __all__ definition if present.
 */
function extractPythonAllExports(fileContent: string): string[] | null {
  const match = fileContent.match(/__all__\s*=\s*(\[[^\]]*\]|\([^\)]*\))/s);
  if (!match) return null;
  const items: string[] = [];
  const regex = /['"]([a-zA-Z_]\w*)['"]/g;
  let m;
  while ((m = regex.exec(match[1])) !== null) {
    items.push(m[1]);
  }
  return items.length > 0 ? items : null;
}

/**
 * Robust Python AST metadata extractor.
 * Handles multi-line imports, parenthesized imports, conditional blocks,
 * class methods, decorators, and export semantics.
 */
export function parsePythonSourceFile(filePath: string, fileContent: string): ASTMetadata {
  const pyImports: string[] = [];
  const pyExports: string[] = [];
  const pyFunctions: string[] = [];
  const pyClasses: string[] = [];

  const rawLines = fileContent.split('\n');
  let inDocstring = false;
  let docstringDelimiter: '"""' | "'''" | null = null;

  let accumulatingImport = '';
  let inParentheses = false;
  let currentClass: { name: string; indent: number } | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // 1. Docstring detection (toggle state across lines)
    if (!inDocstring) {
      if (trimmed.startsWith('"""')) {
        docstringDelimiter = '"""';
        if (trimmed.length === 3 || !trimmed.slice(3).includes('"""')) {
          inDocstring = true;
          continue;
        }
      } else if (trimmed.startsWith("'''")) {
        docstringDelimiter = "'''";
        if (trimmed.length === 3 || !trimmed.slice(3).includes("'''")) {
          inDocstring = true;
          continue;
        }
      }
    } else {
      if (docstringDelimiter && trimmed.includes(docstringDelimiter)) {
        inDocstring = false;
        docstringDelimiter = null;
      }
      continue;
    }

    if (inDocstring) continue;

    // 2. Strip comments and empty lines
    const lineWithoutComments = stripPythonComments(rawLine);
    const cleanLine = lineWithoutComments.trim();
    if (!cleanLine) continue;

    const lineIndent = getPythonIndent(rawLine);

    // 3. Class context management: reset class when indentation drops
    if (currentClass && lineIndent <= currentClass.indent && !cleanLine.startsWith('@')) {
      currentClass = null;
    }

    // 4. Import parsing (handles multi-line parentheses, commas, and line continuations)
    if (accumulatingImport || cleanLine.startsWith('import ') || cleanLine.startsWith('from ') || /^from\s+[.\w]+\s+import/.test(cleanLine)) {
      accumulatingImport += (accumulatingImport ? ' ' : '') + cleanLine;

      if (cleanLine.includes('(')) inParentheses = true;
      if (cleanLine.includes(')')) inParentheses = false;

      if (cleanLine.endsWith('\\') || inParentheses) {
        if (cleanLine.endsWith('\\')) {
          accumulatingImport = accumulatingImport.slice(0, -1).trim();
        }
        continue;
      }

      // Process complete import statement
      const fullStmt = accumulatingImport.replace(/\(|\)/g, ' ').replace(/\s+/g, ' ');
      accumulatingImport = '';

      // Pattern A: from <module> import <items>
      const fromMatch = fullStmt.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
      if (fromMatch) {
        const mod = fromMatch[1];
        const items = fromMatch[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);

        if (mod === '.') {
          for (const item of items) {
            if (item && item !== '*') pyImports.push(`.${item}`);
            else pyImports.push('.');
          }
        } else {
          pyImports.push(mod);
        }
      } else {
        // Pattern B: import <item1> as a, <item2>
        const importMatch = fullStmt.match(/^import\s+(.+)$/);
        if (importMatch) {
          const items = importMatch[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
          for (const item of items) {
            if (item) pyImports.push(item);
          }
        }
      }
      continue;
    }

    // 5. Class declaration
    const classMatch = cleanLine.match(/^class\s+([a-zA-Z_]\w*)\s*(?:\([^\)]*\))?\s*:/);
    if (classMatch) {
      const className = classMatch[1];
      pyClasses.push(className);
      currentClass = { name: className, indent: lineIndent };
      if (!className.startsWith('_')) {
        pyExports.push(className);
      }
      continue;
    }

    // 6. Function declaration (regular or async)
    const funcMatch = cleanLine.match(/^(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      if (currentClass && lineIndent > currentClass.indent) {
        pyFunctions.push(`${currentClass.name}.${funcName}`);
      } else {
        pyFunctions.push(funcName);
        if (!funcName.startsWith('_')) {
          pyExports.push(funcName);
        }
      }
    }
  }

  // Check for explicit __all__ export declaration
  const explicitExports = extractPythonAllExports(fileContent);
  const finalExports = explicitExports ? explicitExports : pyExports;

  return {
    imports: Array.from(new Set(pyImports)),
    exports: Array.from(new Set(finalExports)),
    functions: Array.from(new Set(pyFunctions)),
    classes: Array.from(new Set(pyClasses))
  };
}

/**
 * Extracts Python code symbols (functions, classes, methods) with startLine and endLine
 * based on indentation structure and decorators.
 */
export function getPythonCodeSymbols(fileContent: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = fileContent.split('\n');

  let currentClass: { name: string; indent: number } | null = null;
  let pendingDecoratorStart: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const indent = getPythonIndent(rawLine);

    // Decorator line
    if (trimmed.startsWith('@')) {
      if (pendingDecoratorStart === null) {
        pendingDecoratorStart = i + 1; // 1-indexed
      }
      continue;
    }

    // Check if exiting class scope
    if (currentClass && indent <= currentClass.indent) {
      currentClass = null;
    }

    // Check class declaration
    const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)\s*(?:\([^\)]*\))?\s*:/);
    if (classMatch) {
      const className = classMatch[1];
      const startLine = pendingDecoratorStart ?? (i + 1);
      pendingDecoratorStart = null;
      currentClass = { name: className, indent };

      // Find end line by looking for next statement with indent <= class indent
      let endLine = i + 1;
      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed || nextTrimmed.startsWith('#')) continue;
        const nextIndent = getPythonIndent(lines[j]);
        if (nextIndent <= indent) {
          break;
        }
        endLine = j + 1;
      }

      symbols.push({
        name: className,
        kind: 'class',
        startLine,
        endLine: Math.max(startLine, endLine)
      });
      continue;
    }

    // Check function declaration
    const funcMatch = trimmed.match(/^(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const startLine = pendingDecoratorStart ?? (i + 1);
      pendingDecoratorStart = null;

      const symbolName = currentClass && indent > currentClass.indent
        ? `${currentClass.name}.${funcName}`
        : funcName;

      // Find end line by looking for next statement with indent <= function indent
      let endLine = i + 1;
      for (let j = i + 1; j < lines.length; j++) {
        const nextTrimmed = lines[j].trim();
        if (!nextTrimmed || nextTrimmed.startsWith('#')) continue;
        const nextIndent = getPythonIndent(lines[j]);
        if (nextIndent <= indent) {
          break;
        }
        endLine = j + 1;
      }

      symbols.push({
        name: symbolName,
        kind: 'function',
        startLine,
        endLine: Math.max(startLine, endLine)
      });
      continue;
    }

    // Any other statement clears pending decorator
    pendingDecoratorStart = null;
  }

  return symbols.sort((a, b) => a.startLine - b.startLine);
}

/**
 * Parses source file content (TypeScript, JavaScript, Python).
 * Extracts imports, exports, functions, and classes.
 */
export function parseSourceFile(filePath: string, fileContent: string): ASTMetadata {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Handle Python files via comprehensive Python AST metadata extractor
  if (normalizedPath.endsWith('.py')) {
    return parsePythonSourceFile(filePath, fileContent);
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
          const dotsMatch = rawImport.match(/^(\.+)(.*)$/);
          if (dotsMatch) {
            const dotsCount = dotsMatch[1].length;
            const modPart = dotsMatch[2].replace(/\./g, '/');
            const parentSteps = '../'.repeat(Math.max(0, dotsCount - 1));
            const relPath = parentSteps + modPart;
            candidates.push(path.posix.normalize(path.posix.join(importDir, relPath)));
          }
        } else {
          // Absolute / package python import (e.g. app.models -> app/models)
          const slashPath = rawImport.replace(/\./g, '/');
          candidates.push(slashPath);
          candidates.push(path.posix.join(importDir, slashPath));
          candidates.push(`src/${slashPath}`);
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
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.endsWith('.py')) {
    return getPythonCodeSymbols(fileContent);
  }

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

