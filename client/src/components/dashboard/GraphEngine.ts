export interface FileItem {
  path: string;
  size: number;
  lines: number;
}

export interface GraphNode {
  id: string; // absolute file path
  label: string; // filename
  type: 'route' | 'controller' | 'service' | 'config' | 'component' | 'hook' | 'utility' | 'other';
  inDegree: number;
  outDegree: number;
  size: number;
  lines: number;
  fileSize: number;
  imports: string[];
  exports: string[];
  classes: string[];
  functions: string[];
}

export interface GraphLink {
  source: string;
  target: string;
}

export class GraphEngine {
  private files: FileItem[];
  private dependencyGraph: Record<string, string[]>;
  private astMetadata: Record<string, any>;

  constructor(
    files: FileItem[],
    dependencyGraph: Record<string, string[]>,
    astMetadata: Record<string, any>
  ) {
    this.files = files;
    this.dependencyGraph = dependencyGraph || {};
    this.astMetadata = astMetadata || {};
  }

  /**
   * Identifies the node category based on directory matching rules.
   */
  getNodeType(filePath: string): GraphNode['type'] {
    const lower = filePath.toLowerCase();
    if (lower.includes('route') || lower.includes('/routes/') || lower.includes('.route.')) return 'route';
    if (lower.includes('controller') || lower.includes('/controllers/') || lower.includes('.controller.')) return 'controller';
    if (lower.includes('service') || lower.includes('/services/') || lower.includes('.service.')) return 'service';
    if (lower.includes('config') || lower.includes('db') || lower.includes('schema') || lower.includes('prisma')) return 'config';
    if (lower.includes('/components/') || lower.includes('.component.')) return 'component';
    if (lower.includes('/hooks/') || lower.includes('.hook.')) return 'hook';
    if (lower.includes('/utils/') || lower.includes('/helpers/') || lower.includes('.util.')) return 'utility';
    return 'other';
  }

  /**
   * Generates parsed node data.
   */
  getNodes(): GraphNode[] {
    const list: GraphNode[] = [];
    const inDegreeMap: Record<string, number> = {};
    const outDegreeMap: Record<string, number> = {};

    this.files.forEach(f => {
      inDegreeMap[f.path] = 0;
      outDegreeMap[f.path] = (this.dependencyGraph[f.path] || []).length;
    });

    Object.entries(this.dependencyGraph).forEach(([src, deps]) => {
      (deps || []).forEach(dep => {
        if (inDegreeMap[dep] !== undefined) {
          inDegreeMap[dep]++;
        }
      });
    });

    this.files.forEach(f => {
      const ast = this.astMetadata[f.path] || {};
      const imports = ast.imports || [];
      const exports = ast.exports || [];
      const classes = ast.classes || [];
      const functions = ast.functions || [];

      const inDeg = inDegreeMap[f.path] || 0;
      const size = 12 + Math.min(24, inDeg * 3);

      list.push({
        id: f.path,
        label: f.path.split('/').pop() || f.path,
        type: this.getNodeType(f.path),
        inDegree: inDeg,
        outDegree: outDegreeMap[f.path] || 0,
        size,
        lines: f.lines || 0,
        fileSize: f.size || 0,
        imports,
        exports,
        classes,
        functions
      });
    });

    return list;
  }

  /**
   * Generates graph links.
   */
  getLinks(): GraphLink[] {
    const links: GraphLink[] = [];
    const filePaths = this.files.map(f => f.path);

    Object.entries(this.dependencyGraph).forEach(([src, deps]) => {
      if (filePaths.includes(src)) {
        (deps || []).forEach(dep => {
          if (filePaths.includes(dep)) {
            links.push({ source: src, target: dep });
          }
        });
      }
    });

    return links;
  }

  getDependents(filePath: string): string[] {
    const links = this.getLinks();
    return links.filter(l => l.target === filePath).map(l => l.source);
  }

  getDependencies(filePath: string): string[] {
    return this.dependencyGraph[filePath] || [];
  }

  /**
   * Recursively computes the blast radius of a file.
   */
  getBlastRadius(filePath: string): string[] {
    const affected = new Set<string>();
    const links = this.getLinks();

    const dfs = (current: string) => {
      links.forEach(l => {
        if (l.target === current && !affected.has(l.source)) {
          affected.add(l.source);
          dfs(l.source);
        }
      });
    };

    dfs(filePath);
    return Array.from(affected);
  }

  /**
   * Computes a dynamic journey roadmap for a selected module.
   * Path: Entrypoint ➔ Parents ➔ Node ➔ Dependencies ➔ Database/Schema
   */
  getJourneyPath(filePath: string, entryPoints: string[] = []): string[] {
    const path: string[] = [];
    const links = this.getLinks();
    
    // 1. Find entrypoint path (closest path from any entrypoint to node)
    let entryPath: string[] = [];
    if (entryPoints.length > 0) {
      const queue: Array<{ node: string; path: string[] }> = entryPoints.map(ep => ({ node: ep, path: [ep] }));
      const visited = new Set<string>();
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr.node === filePath) {
          entryPath = curr.path;
          break;
        }
        if (visited.has(curr.node)) continue;
        visited.add(curr.node);

        const neighbors = links.filter(l => l.source === curr.node).map(l => l.target);
        neighbors.forEach(n => {
          if (!visited.has(n)) {
            queue.push({ node: n, path: [...curr.path, n] });
          }
        });
      }
    }

    if (entryPath.length > 0) {
      path.push(...entryPath);
    } else {
      path.push(filePath);
    }

    // 2. Add a database connection downstream if exists
    const downstreamQueue: Array<{ node: string; path: string[] }> = [{ node: filePath, path: [] }];
    const visitedDown = new Set<string>();
    let dbPath: string[] = [];

    while (downstreamQueue.length > 0) {
      const curr = downstreamQueue.shift()!;
      if (this.getNodeType(curr.node) === 'config') {
        dbPath = curr.path;
        break;
      }
      if (visitedDown.has(curr.node)) continue;
      visitedDown.add(curr.node);

      const neighbors = links.filter(l => l.source === curr.node).map(l => l.target);
      neighbors.forEach(n => {
        if (!visitedDown.has(n)) {
          downstreamQueue.push({ node: n, path: [...curr.path, n] });
        }
      });
    }

    if (dbPath.length > 0) {
      path.push(...dbPath);
    }

    // Return unique elements
    return Array.from(new Set(path));
  }

  /**
   * Performs semantic query ranking.
   */
  semanticSearch(query: string, nodes: GraphNode[]): Array<{ id: string; score: number }> {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    return nodes.map(n => {
      let score = 0;
      const lowerPath = n.id.toLowerCase();
      const lowerLabel = n.label.toLowerCase();

      // 1. Filename matches
      if (lowerLabel === q) score += 100;
      else if (lowerLabel.startsWith(q)) score += 50;
      else if (lowerLabel.includes(q)) score += 30;

      // 2. Folder matching context
      if (lowerPath.includes('/' + q + '/')) score += 20;

      // 3. Class/Function symbol matches
      const classMatch = n.classes.some(c => c.toLowerCase().includes(q));
      const funcMatch = n.functions.some(f => f.toLowerCase().includes(q));
      if (classMatch) score += 40;
      if (funcMatch) score += 25;

      // 4. Ingress / DB keyword concepts mapping
      if (q === 'authentication' || q === 'auth' || q === 'login' || q === 'jwt') {
        if (lowerPath.includes('auth') || lowerPath.includes('jwt') || lowerPath.includes('session')) score += 35;
      } else if (q === 'database' || q === 'db' || q === 'schema' || q === 'prisma' || q === 'models') {
        if (n.type === 'config' || lowerPath.includes('model') || lowerPath.includes('schema') || lowerPath.includes('db')) score += 35;
      } else if (q === 'payment' || q === 'checkout' || q === 'billing' || q === 'stripe') {
        if (lowerPath.includes('pay') || lowerPath.includes('bill') || lowerPath.includes('stripe') || lowerPath.includes('order')) score += 35;
      }

      return { id: n.id, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  }
}
