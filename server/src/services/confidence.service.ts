import path from 'path';

interface ScannedFileInfo {
  path: string;
  size: number;
  lines?: number;
}

interface ASTMetadata {
  imports: string[];
  exports: string[];
  functions: string[];
  classes: string[];
}

export class ConfidenceService {
  /**
   * Calculates a deterministic repository confidence score and checklist of line items.
   * Weight breakdown:
   * 1. AST Coverage (25%)
   * 2. Dependency Coverage (25%)
   * 3. Route-to-Controller-to-Service Resolution (30%)
   * 4. Database Model Matching (20%)
   */
  calculateConfidence(
    scannedFiles: ScannedFileInfo[],
    astMetadata: Record<string, ASTMetadata>,
    dependencyGraph: Record<string, string[]>,
    languages: string[] | Set<string>,
    framework: string | null
  ) {
    const checklist: string[] = [];

    // Helper to check if file paths are JS/TS
    const isJsOrTs = (filePath: string) => {
      const ext = path.extname(filePath).toLowerCase();
      return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
    };

    // Helper to classify file types by folder/name conventions
    const isRouteFile = (filePath: string) => {
      const normalized = filePath.toLowerCase().replace(/\\/g, '/');
      return (
        normalized.includes('/routes/') ||
        normalized.includes('/route/') ||
        normalized.includes('.routes.') ||
        normalized.includes('.route.') ||
        normalized.includes('routing')
      );
    };

    const isControllerFile = (filePath: string) => {
      const normalized = filePath.toLowerCase().replace(/\\/g, '/');
      return (
        normalized.includes('/controllers/') ||
        normalized.includes('/controller/') ||
        normalized.includes('.controller.') ||
        normalized.includes('.controllers.')
      );
    };

    const isServiceFile = (filePath: string) => {
      const normalized = filePath.toLowerCase().replace(/\\/g, '/');
      return (
        normalized.includes('/services/') ||
        normalized.includes('/service/') ||
        normalized.includes('.service.') ||
        normalized.includes('.services.')
      );
    };

    // 1. AST Coverage (25%)
    const jsTsFiles = scannedFiles.filter(f => isJsOrTs(f.path));
    const jsTsCount = jsTsFiles.length;
    let parsedCount = 0;

    for (const file of jsTsFiles) {
      if (astMetadata[file.path]) {
        parsedCount++;
      }
    }

    const astScore = jsTsCount === 0 ? 100 : (parsedCount / jsTsCount) * 100;
    if (astScore === 100) {
      checklist.push(`✓ AST structure fully resolved (100% of ${jsTsCount} JS/TS files parsed)`);
    } else if (astScore > 0) {
      checklist.push(`⚠ AST structure partially resolved (${Math.round(astScore)}% of JS/TS files parsed)`);
    } else {
      checklist.push(`⚠ AST structure empty (no JS/TS files parsed successfully)`);
    }

    // 2. Dependency Coverage (25%)
    let totalImports = 0;
    let resolvedImports = 0;

    for (const [filePath, metadata] of Object.entries(astMetadata)) {
      if (metadata && Array.isArray(metadata.imports)) {
        totalImports += metadata.imports.length;
        const resolved = dependencyGraph[filePath] || [];
        resolvedImports += resolved.length;
      }
    }

    const depScore = totalImports === 0 ? 100 : (resolvedImports / totalImports) * 100;
    if (depScore >= 80) {
      checklist.push(`✓ Code dependency graph mapped (${Math.round(depScore)}% of imports resolved)`);
    } else if (depScore > 0) {
      checklist.push(`⚠ Code dependency graph sparse (${Math.round(depScore)}% of imports resolved)`);
    } else {
      checklist.push(`⚠ No codebase dependencies resolved`);
    }

    // 3. Route-to-Controller-to-Service Resolution (30%)
    const routeFiles = scannedFiles.filter(f => isRouteFile(f.path));
    const controllerFiles = scannedFiles.filter(f => isControllerFile(f.path));
    const serviceFiles = scannedFiles.filter(f => isServiceFile(f.path));

    let execScore = 100;
    if (routeFiles.length > 0) {
      let routeChainScoreSum = 0;
      for (const route of routeFiles) {
        const routeDeps = dependencyGraph[route.path] || [];
        const importsController = routeDeps.some(dep => isControllerFile(dep));

        if (importsController) {
          // Find which controller it imports
          const controllersImported = routeDeps.filter(dep => isControllerFile(dep));
          let controllerImportsService = false;
          for (const ctrl of controllersImported) {
            const ctrlDeps = dependencyGraph[ctrl] || [];
            if (ctrlDeps.some(dep => isServiceFile(dep))) {
              controllerImportsService = true;
              break;
            }
          }

          if (controllerImportsService) {
            routeChainScoreSum += 100; // Route -> Controller -> Service is fully resolved
          } else {
            routeChainScoreSum += 50; // Only Route -> Controller is resolved
          }
        }
      }
      execScore = routeChainScoreSum / routeFiles.length;

      if (execScore >= 80) {
        checklist.push(`✓ Web execution chains resolved (Route ➔ Controller ➔ Service: ${Math.round(execScore)}%)`);
      } else {
        checklist.push(`⚠ Web execution chains partially resolved (Route ➔ Controller ➔ Service: ${Math.round(execScore)}%)`);
      }
    } else {
      // If no routes are present, check if controllers exist and link to services
      if (controllerFiles.length > 0) {
        let controllerChainSum = 0;
        for (const ctrl of controllerFiles) {
          const ctrlDeps = dependencyGraph[ctrl.path] || [];
          if (ctrlDeps.some(dep => isServiceFile(dep))) {
            controllerChainSum += 100;
          }
        }
        execScore = controllerChainSum / controllerFiles.length;
        if (execScore >= 80) {
          checklist.push(`✓ Execution flow mapped (Controller ➔ Service: ${Math.round(execScore)}%)`);
        } else {
          checklist.push(`⚠ Execution flow sparse (Controller ➔ Service: ${Math.round(execScore)}%)`);
        }
      } else {
        execScore = 100;
        checklist.push(`✓ Execution flow resolved (Modular codebase architecture mapped)`);
      }
    }

    // 4. Database Model Matching (20%)
    let hasDBSchema = false;
    let hasDBClientImport = false;

    // Check filenames for database/ORM schema markers
    for (const file of scannedFiles) {
      const name = path.basename(file.path).toLowerCase();
      if (
        name.includes('schema.prisma') ||
        name.includes('prisma') ||
        name.includes('.sql') ||
        file.path.toLowerCase().includes('/models/') ||
        file.path.toLowerCase().includes('/model/')
      ) {
        hasDBSchema = true;
        break;
      }
    }

    // Check declared imports for database packages
    const dbPackages = ['@prisma/client', 'mongoose', 'sequelize', 'pg', 'mysql2', 'sqlite3', 'typeorm', 'knex'];
    for (const metadata of Object.values(astMetadata)) {
      if (metadata && Array.isArray(metadata.imports)) {
        if (metadata.imports.some(imp => dbPackages.some(pkg => imp.includes(pkg)))) {
          hasDBClientImport = true;
          break;
        }
      }
    }

    let dbScore = 100;
    if (hasDBSchema) {
      if (hasDBClientImport) {
        dbScore = 100;
        checklist.push(`✓ Database models resolved (Prisma/DB schema client integrated)`);
      } else {
        dbScore = 50;
        checklist.push(`⚠ Database schema present but DB client not imported in code`);
      }
    } else {
      if (hasDBClientImport) {
        dbScore = 80;
        checklist.push(`⚠ DB client imported but no database schema file detected`);
      } else {
        dbScore = 100;
        checklist.push(`✓ Database integrations skipped (No database usage detected)`);
      }
    }

    // Compute overall weighted confidence score
    const finalScore = Math.max(0, Math.min(100, Math.round(
      (astScore * 0.25) +
      (depScore * 0.25) +
      (execScore * 0.30) +
      (dbScore * 0.20)
    )));

    return {
      score: finalScore,
      checklist
    };
  }
}

export const confidenceService = new ConfidenceService();
export default confidenceService;
