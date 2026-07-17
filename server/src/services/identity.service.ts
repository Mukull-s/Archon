import fs from 'fs';
import path from 'path';

export interface ScannedFileInfo {
  path: string;
  size: number;
  lines: number;
  content?: string;
}

export interface IdentityResult {
  framework: string;
  languages: string[];
  mainLanguage: string;
  languageRatios: Record<string, number>;
  entryPoints: string[];
  complexityScore: number;
}

class IdentityService {
  /**
   * Maps file extensions to human-readable programming languages.
   */
  detectLanguageByExtension(ext: string): string | null {
    switch (ext) {
      case '.ts': return 'TypeScript';
      case '.tsx': return 'TypeScript React';
      case '.js': return 'JavaScript';
      case '.jsx': return 'JavaScript React';
      case '.py': return 'Python';
      case '.go': return 'Go';
      case '.rs': return 'Rust';
      case '.java': return 'Java';
      case '.cpp':
      case '.cc': return 'C++';
      case '.c': return 'C';
      case '.cs': return 'C#';
      case '.rb': return 'Ruby';
      case '.php': return 'PHP';
      case '.json': return 'JSON';
      case '.md': return 'Markdown';
      case '.css': return 'CSS';
      case '.html': return 'HTML';
      default: return null;
    }
  }

  /**
   * Analyzes package manifests and configurations to identify the primary codebase framework.
   */
  detectFramework(repoRoot: string, filePaths: string[]): string {
    const pathsSet = new Set(filePaths.map(p => p.toLowerCase()));

    if (pathsSet.has('next.config.js') || pathsSet.has('next.config.mjs') || pathsSet.has('next.config.ts')) {
      return 'Next.js';
    }
    if (pathsSet.has('vite.config.js') || pathsSet.has('vite.config.ts') || pathsSet.has('vite.config.mjs')) {
      return 'Vite (React/Vue)';
    }
    if (pathsSet.has('nuxt.config.js') || pathsSet.has('nuxt.config.ts')) {
      return 'Nuxt.js';
    }
    if (pathsSet.has('angular.json')) {
      return 'Angular';
    }
    if (pathsSet.has('svelte.config.js')) {
      return 'Svelte';
    }
    if (pathsSet.has('tailwind.config.js') || pathsSet.has('tailwind.config.ts')) {
      return 'Tailwind CSS Project';
    }

    const pkgPath = path.join(repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['next']) return 'Next.js';
        if (deps['vite']) return 'Vite (React/Vue)';
        if (deps['express']) return 'Express.js';
        if (deps['react']) return 'React Project';
      } catch (e) {}
    }

    return 'Vanilla / Custom';
  }

  /**
   * Matches codebase files against known standard starting points to locate entry paths.
   */
  detectEntryPoints(filePaths: string[]): string[] {
    const entryFiles = [
      'src/server.ts', 'src/server.js',
      'server.ts', 'server.js',
      'src/app.ts', 'src/app.js',
      'app.ts', 'app.js',
      'src/index.ts', 'src/index.js',
      'src/main.ts', 'src/main.js',
      'index.ts', 'index.js',
      'main.py', 'app.py',
      'src/app/layout.tsx', 'src/app/page.tsx',
      'index.html'
    ];

    const pathsSet = new Set(filePaths);
    const detected: string[] = [];

    for (const entry of entryFiles) {
      if (pathsSet.has(entry)) {
        detected.push(entry);
      }
    }

    return detected.slice(0, 3);
  }

  /**
   * Counts lines of code (LOC) per language and calculates ratios.
   */
  calculateLanguageStats(scannedFiles: ScannedFileInfo[]): {
    languages: string[];
    mainLanguage: string;
    languageRatios: Record<string, number>;
  } {
    const locByLanguage: Record<string, number> = {};
    let totalLines = 0;

    for (const file of scannedFiles) {
      const ext = path.extname(file.path).toLowerCase();
      const lang = this.detectLanguageByExtension(ext);
      if (lang) {
        locByLanguage[lang] = (locByLanguage[lang] || 0) + file.lines;
        totalLines += file.lines;
      }
    }

    const languageRatios: Record<string, number> = {};
    let mainLanguage = 'Unknown';
    let maxLines = -1;

    for (const [lang, lines] of Object.entries(locByLanguage)) {
      if (totalLines > 0) {
        languageRatios[lang] = parseFloat(((lines / totalLines) * 100).toFixed(1));
      } else {
        languageRatios[lang] = 0;
      }

      if (lines > maxLines) {
        maxLines = lines;
        mainLanguage = lang;
      }
    }

    return {
      languages: Object.keys(locByLanguage),
      mainLanguage,
      languageRatios
    };
  }

  /**
   * Estimates a codebase complexity score out of 100 based on file count, LOC, and dependency edges density.
   */
  calculateComplexityScore(scannedFiles: ScannedFileInfo[], dependencyGraph: Record<string, string[]>): number {
    const fileCount = scannedFiles.length;
    if (fileCount === 0) return 0;

    const totalLines = scannedFiles.reduce((acc, f) => acc + f.lines, 0);
    
    // Count dependencies
    let edgeCount = 0;
    for (const edges of Object.values(dependencyGraph)) {
      edgeCount += edges.length;
    }

    // Weight factors
    const locWeight = Math.min(40, (totalLines / 5000) * 40); // Max 40 points for LOC
    const fileWeight = Math.min(30, (fileCount / 150) * 30);  // Max 30 points for file count
    const graphWeight = Math.min(30, (edgeCount / 100) * 30); // Max 30 points for dependency links density

    const complexity = Math.round(locWeight + fileWeight + graphWeight);
    return Math.max(1, Math.min(100, complexity));
  }

  /**
   * High level API to execute the full Repository Identity Engine flow.
   */
  runIdentityEngine(repoRoot: string, scannedFiles: ScannedFileInfo[], dependencyGraph: Record<string, string[]>): IdentityResult {
    const filePaths = scannedFiles.map(f => f.path);
    const framework = this.detectFramework(repoRoot, filePaths);
    const entryPoints = this.detectEntryPoints(filePaths);
    const { languages, mainLanguage, languageRatios } = this.calculateLanguageStats(scannedFiles);
    const complexityScore = this.calculateComplexityScore(scannedFiles, dependencyGraph);

    return {
      framework,
      languages,
      mainLanguage,
      languageRatios,
      entryPoints,
      complexityScore
    };
  }
}

export const identityService = new IdentityService();
export default identityService;
