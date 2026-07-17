import path from 'path';

export interface InsightResult {
  centralityHotspots: Array<{ filePath: string; inDegree: number }>;
  missingTests: string[];
  circularDependencies: string[][];
  deadCode: string[];
  architecturalDrift: Array<{ filePath: string; targetPath: string; violation: string }>;
}

export class InsightService {
  /**
   * Proactively computes codebase insights using the file tree and dependency graph.
   */
  computeInsights(
    scannedFiles: Array<{ path: string }>,
    dependencyGraph: Record<string, string[]>,
    entryPoints: string[] = []
  ): InsightResult {
    const filePaths = scannedFiles.map(f => f.path.replace(/\\/g, '/'));
    const normalizedGraph: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(dependencyGraph)) {
      normalizedGraph[key.replace(/\\/g, '/')] = val.map(v => v.replace(/\\/g, '/'));
    }

    // 1. High Centrality Hotspots (In-Degree)
    const inDegreeMap: Record<string, number> = {};
    filePaths.forEach(fp => {
      inDegreeMap[fp] = 0;
    });

    for (const imports of Object.values(normalizedGraph)) {
      for (const imp of imports) {
        if (inDegreeMap[imp] !== undefined) {
          inDegreeMap[imp]++;
        }
      }
    }

    const centralityHotspots = Object.entries(inDegreeMap)
      .map(([filePath, inDegree]) => ({ filePath, inDegree }))
      .filter(item => item.inDegree > 0)
      .sort((a, b) => b.inDegree - a.inDegree);

    // 2. Missing test files for active controllers/services
    const missingTests: string[] = [];
    const isServiceOrController = (fp: string) => {
      const lower = fp.toLowerCase();
      return (
        (lower.includes('service') || lower.includes('controller')) &&
        !lower.includes('test') &&
        !lower.includes('spec') &&
        !lower.includes('mock')
      );
    };

    const isTestFile = (fp: string) => {
      const lower = fp.toLowerCase();
      return lower.includes('.test.') || lower.includes('.spec.');
    };

    const testFiles = filePaths.filter(isTestFile);

    const activeCodeFiles = filePaths.filter(isServiceOrController);
    for (const codeFile of activeCodeFiles) {
      const ext = path.extname(codeFile);
      const base = codeFile.slice(0, -ext.length);
      const testBasename = path.basename(base).toLowerCase();

      const hasTest = testFiles.some(tf => {
        const tfLower = tf.toLowerCase();
        return tfLower.includes(testBasename) && (tfLower.includes('.test.') || tfLower.includes('.spec.'));
      });

      if (!hasTest) {
        missingTests.push(codeFile);
      }
    }

    // 3. Circular Dependencies using Tarjan's strongly connected components algorithm
    const circularDependencies: string[][] = [];
    const indexMap: Record<string, number> = {};
    const lowlinkMap: Record<string, number> = {};
    const onStack: Record<string, boolean> = {};
    const stack: string[] = [];
    let index = 0;

    function strongConnect(node: string) {
      indexMap[node] = index;
      lowlinkMap[node] = index;
      index++;
      stack.push(node);
      onStack[node] = true;

      const neighbors = normalizedGraph[node] || [];
      for (const neighbor of neighbors) {
        if (indexMap[neighbor] === undefined) {
          strongConnect(neighbor);
          lowlinkMap[node] = Math.min(lowlinkMap[node], lowlinkMap[neighbor]);
        } else if (onStack[neighbor]) {
          lowlinkMap[node] = Math.min(lowlinkMap[node], indexMap[neighbor]);
        }
      }

      if (lowlinkMap[node] === indexMap[node]) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack[w] = false;
          component.push(w);
        } while (w !== node);

        if (component.length > 1) {
          circularDependencies.push(component);
        }
      }
    }

    for (const node of filePaths) {
      if (indexMap[node] === undefined) {
        strongConnect(node);
      }
    }

    // 4. Dead Code (0 in-degree and not an entry point or test/config file)
    const normalizedEntries = entryPoints.map(ep => ep.replace(/\\/g, '/'));
    const isConfigOrSetupFile = (fp: string) => {
      const lower = fp.toLowerCase();
      return (
        lower.includes('config') ||
        lower.includes('setup') ||
        lower.includes('.env') ||
        lower.includes('routes') ||
        lower.includes('app.ts') ||
        lower.includes('server.ts') ||
        lower.includes('main.tsx') ||
        lower.includes('index.html')
      );
    };

    const deadCode = filePaths.filter(fp => {
      if (inDegreeMap[fp] !== 0) return false;
      if (normalizedEntries.includes(fp)) return false;
      if (isTestFile(fp)) return false;
      if (isConfigOrSetupFile(fp)) return false;
      return true;
    });

    // 5. Architectural Drift Warning
    // Helper to determine layer of a file path
    const getLayer = (fp: string): number => {
      const lower = fp.toLowerCase();
      if (lower.includes('/routes/') || lower.includes('/route/') || lower.includes('.route.')) return 3; // Route layer
      if (lower.includes('/controllers/') || lower.includes('/controller/') || lower.includes('.controller.')) return 2; // Controller layer
      if (lower.includes('/services/') || lower.includes('/service/') || lower.includes('.service.')) return 1; // Service layer
      if (lower.includes('/models/') || lower.includes('/model/') || lower.includes('prisma/schema.prisma') || lower.includes('/db/')) return 0; // DB layer
      return -1;
    };

    const architecturalDrift: Array<{ filePath: string; targetPath: string; violation: string }> = [];
    for (const [filePath, imports] of Object.entries(normalizedGraph)) {
      const sourceLayer = getLayer(filePath);
      if (sourceLayer === -1) continue;

      for (const targetPath of imports) {
        const targetLayer = getLayer(targetPath);
        if (targetLayer === -1) continue;

        // Drift violation: sourceLayer imports targetLayer where targetLayer > sourceLayer
        if (targetLayer > sourceLayer) {
          let violation = `Layer Drift: Layer ${sourceLayer} file imports Layer ${targetLayer} file.`;
          if (sourceLayer === 1 && targetLayer === 2) {
            violation = 'Service layer imports Controller layer.';
          } else if (sourceLayer === 0 && targetLayer >= 1) {
            violation = 'Database/Model layer imports Service or Controller layer.';
          } else if (sourceLayer === 1 && targetLayer === 3) {
            violation = 'Service layer imports Route layer.';
          } else if (sourceLayer === 2 && targetLayer === 3) {
            violation = 'Controller layer imports Route layer.';
          }
          architecturalDrift.push({ filePath, targetPath, violation });
        }
      }
    }

    return {
      centralityHotspots,
      missingTests,
      circularDependencies,
      deadCode,
      architecturalDrift
    };
  }
}

export const insightService = new InsightService();
export default insightService;
