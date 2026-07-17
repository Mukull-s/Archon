import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import AdmZip from 'adm-zip';
import os from 'os';
import { prisma } from '../config';
import * as astService from './ast.service';
import { AppError } from '../utils';
import { identityService } from './identity.service';
import { confidenceService } from './confidence.service';

// Filter constants
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'out', 'generated']);
const EXCLUDED_FILES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  // Audio/Video
  '.mp3', '.wav', '.mp4', '.mov', '.avi', '.webm',
  // Other binaries
  '.exe', '.dll', '.bin', '.pdf', '.zip', '.gz', '.tar', '.woff', '.woff2', '.ttf', '.eot'
]);

const MAX_FILES = 250;
const MAX_TOTAL_SIZE = 3 * 1024 * 1024; // 3 MB
const MAX_SINGLE_FILE_SIZE = 100 * 1024; // 100 KB

interface ScannedFileInfo {
  path: string;
  size: number;
  lines: number;
  content?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function deleteFolderWithRetry(dirPath: string, retries = 10, ms = 300) {
  if (!fs.existsSync(dirPath)) return;
  for (let i = 0; i < retries; i++) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    } catch (error: any) {
      if (i === retries - 1) {
        console.error(`Failed to delete directory ${dirPath} after retries:`, error);
        break;
      }
      const backoff = ms * Math.pow(1.5, i);
      console.warn(`Directory ${dirPath} busy (${error.code}), retrying cleanup in ${Math.round(backoff)}ms...`);
      await delay(backoff);
    }
  }
}

/**
 * Ingestion Service
 * Handles code downloading, zip extracting, limits validation, and parsing into PostgreSQL cache.
 */
class IngestionService {
  /**
   * Downloads the zip archive for any public GitHub repository.
   */
  async downloadGithubRepo(owner: string, repo: string, token?: string): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}/zipball`;
    const tempDir = path.join(os.tmpdir(), 'archon-downloads');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, `${owner}_${repo}_${crypto.randomUUID()}.zip`);
    
    // Fall back to server's global token if the user is not authenticated
    const activeToken = token || process.env.GITHUB_FALLBACK_TOKEN;
    
    console.log(`Downloading repository zipball from ${url} (authenticated: ${!!activeToken})...`);
    
    try {
      const response = await axios({
        method: 'get',
        url,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Archon-Intelligence-Platform',
          ...(activeToken && { 'Authorization': `Bearer ${activeToken}` })
        }
      });
      
      fs.writeFileSync(filePath, response.data);
      return filePath;
    } catch (error: any) {
      const status = error.response?.status;
      const responseData = error.response?.data ? error.response.data.toString() : '';
      console.error(`GitHub Download Failed with status ${status}:`, responseData);
      
      if (status === 404) {
        throw new AppError('GitHub repository not found. Please verify that the URL is correct and the repository is public.', 404);
      }
      if (status === 403 || status === 401) {
        if (responseData.includes('rate limit')) {
          throw new AppError('GitHub API rate limit exceeded. Please sign in with GitHub to increase limits.', 403);
        }
        throw new AppError('GitHub API access denied. The repository might be private. Try connecting your GitHub account first.', 403);
      }
      throw new AppError(`Failed to download repository zipball from GitHub: ${error.message}`, status || 500);
    }
  }

  /**
   * Processes a repository ZIP (either downloaded or uploaded), runs the AST parser,
   * evaluates metrics/confidence, and caches the result.
   */
  async processAndScanZip(
    zipFilePath: string,
    userId: string,
    repoName: string,
    owner?: string
  ): Promise<any> {
    const extractId = crypto.randomUUID();
    const extractPath = path.join(os.tmpdir(), 'archon-extracted', extractId);
    
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }
    
    try {
      console.log(`Extracting ZIP archive: ${zipFilePath} to ${extractPath}...`);
      const zip = new AdmZip(zipFilePath);
      zip.extractAllTo(extractPath, true);
      
      // Determine the real repo root directory.
      // GitHub zipball puts all contents in a folder named <owner>-<repo>-<commitHash>
      const extractedEntries = fs.readdirSync(extractPath);
      let repoRoot = extractPath;
      if (
        extractedEntries.length === 1 &&
        fs.statSync(path.join(extractPath, extractedEntries[0])).isDirectory()
      ) {
        repoRoot = path.join(extractPath, extractedEntries[0]);
      }
      
      const scannedFiles: ScannedFileInfo[] = [];
      const astMetadata: Record<string, astService.ASTMetadata> = {};
      const languages = new Set<string>();
      
      let totalSize = 0;
      let limitHit = false;
      let filesExcludedCount = 0;
      const scanWarnings: string[] = [];
      
      const walkDirectory = (dirPath: string) => {
        if (limitHit) return;
        
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (limitHit) return;
          
          const fullPath = path.join(dirPath, file);
          const relativePath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            // Exclude directories
            if (EXCLUDED_DIRS.has(file)) {
              continue;
            }
            walkDirectory(fullPath);
          } else if (stat.isFile()) {
            // Check file name exclusions
            if (EXCLUDED_FILES.has(file)) {
              continue;
            }
            
            // Check extension exclusions (binaries)
            const ext = path.extname(file).toLowerCase();
            if (BINARY_EXTENSIONS.has(ext)) {
              continue;
            }
            
            // Check individual file size limit
            if (stat.size > MAX_SINGLE_FILE_SIZE) {
              filesExcludedCount++;
              scanWarnings.push(`File ${relativePath} skipped (exceeds 100KB limit)`);
              continue;
            }
            
            // Enforce global file count limits
            if (scannedFiles.length >= MAX_FILES) {
              limitHit = true;
              scanWarnings.push(`Max file limit of ${MAX_FILES} files reached.`);
              break;
            }
            
            // Enforce global total size limits
            if (totalSize + stat.size > MAX_TOTAL_SIZE) {
              limitHit = true;
              scanWarnings.push(`Max size limit of 3MB reached.`);
              break;
            }
            
            // Process file
            try {
              let content = fs.readFileSync(fullPath, 'utf-8');
              
              // Strip null bytes that PostgreSQL JSON rejects
              content = content.replace(/\u0000/g, '');
              
              totalSize += stat.size;
              
              // Register language
              const lang = identityService.detectLanguageByExtension(ext);
              if (lang) languages.add(lang);
              
              scannedFiles.push({
                path: relativePath,
                size: stat.size,
                lines: content.split('\n').length,
                content: content
              });
              
              // Run AST Parsing for JavaScript/TypeScript files
              if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
                const ast = astService.parseSourceFile(relativePath, content);
                astMetadata[relativePath] = ast;
              }
            } catch (err) {
              console.error(`Failed to read file ${relativePath}:`, err);
            }
          }
        }
      };
      
      // Start recursive scan
      walkDirectory(repoRoot);
      
      // 1. Resolve file dependencies to build the graph
      const fileList = scannedFiles.map(f => f.path);
      const dependencyGraph = astService.resolveDependencies(fileList, astMetadata);
      
      // 2. Run Identity Engine
      const identityResult = identityService.runIdentityEngine(repoRoot, scannedFiles, dependencyGraph);
      const framework = identityResult.framework;
      const entryPoints = identityResult.entryPoints;
      
      // 3. Calculate Analysis Confidence Score
      const { score, checklist } = this.calculateConfidenceScore(
        scannedFiles,
        astMetadata,
        dependencyGraph,
        languages,
        framework
      );
      
      // 5. Cleanup local extracted folder to protect server storage
      await deleteFolderWithRetry(extractPath);
      
      // Delete downloaded ZIP if it was a temporary downloaded file
      if (zipFilePath.includes('temp/downloads') && fs.existsSync(zipFilePath)) {
        try {
          fs.unlinkSync(zipFilePath);
          console.log(`Cleaned up temp downloaded zip: ${zipFilePath}`);
        } catch (unlinkError) {
          console.error(`Failed to delete downloaded zip ${zipFilePath}:`, unlinkError);
        }
      }
      
      // 6. Persist to PostgreSQL database cache via Prisma
      const repository = await prisma.repository.create({
        data: {
          userId,
          owner: owner || null,
          name: repoName,
          isLocal: !owner,
          localPath: null, // extracted folders are cleaned up instantly
          framework,
          languages: Array.from(languages),
          entryPoints,
          importantFiles: entryPoints,
          fileCount: scannedFiles.length,
          totalSize,
          confidence: score,
          scannedFiles: scannedFiles as any,
          astMetadata: astMetadata as any,
          dependencyGraph: dependencyGraph as any
        }
      });
      
      return {
        repository,
        warnings: scanWarnings,
        checklist
      };
      
    } catch (error) {
      // Ensure cleanup runs in case of exception
      await deleteFolderWithRetry(extractPath);
      throw error;
    }
  }



  /**
   * Evaluates the repository and computes a confidence score checklist.
   */
  private calculateConfidenceScore(
    scannedFiles: ScannedFileInfo[],
    astMetadata: Record<string, any>,
    dependencyGraph: Record<string, string[]>,
    languages: Set<string> | string[],
    framework: string | null
  ) {
    return confidenceService.calculateConfidence(
      scannedFiles,
      astMetadata,
      dependencyGraph,
      languages,
      framework
    );
  }

  /**
   * Chunks a code file using AST symbols (functions/classes) to keep declarations intact.
   */
  chunkCodeFile(filePath: string, content: string, symbols: astService.CodeSymbol[]): Array<{
    content: string;
    startLine: number;
    endLine: number;
    symbolName: string;
  }> {
    const lines = content.split('\n');
    const chunks: Array<{
      content: string;
      startLine: number;
      endLine: number;
      symbolName: string;
    }> = [];

    // Fallback: If no AST symbols are found, chunk by line boundaries
    if (!symbols || symbols.length === 0) {
      const chunkSize = 60; // 60 lines per chunk
      for (let i = 0; i < lines.length; i += chunkSize) {
        const slice = lines.slice(i, i + chunkSize).join('\n');
        chunks.push({
          content: slice,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + chunkSize),
          symbolName: 'file-level'
        });
      }
      return chunks;
    }

    let lastLine = 0; // 0-indexed line index
    for (const sym of symbols) {
      const symStartIdx = sym.startLine - 1;
      const symEndIdx = sym.endLine; // exclusive

      // 1. Group any text before this symbol (e.g. imports, headers)
      if (symStartIdx > lastLine) {
        const headerLines = lines.slice(lastLine, symStartIdx);
        const headerText = headerLines.join('\n');
        if (headerText.trim()) {
          chunks.push({
            content: headerText,
            startLine: lastLine + 1,
            endLine: symStartIdx,
            symbolName: 'imports/globals'
          });
        }
      }

      // 2. Group the symbol itself
      const symLines = lines.slice(symStartIdx, symEndIdx);
      chunks.push({
        content: symLines.join('\n'),
        startLine: sym.startLine,
        endLine: sym.endLine,
        symbolName: `${sym.kind}:${sym.name}`
      });

      lastLine = symEndIdx;
    }

    // 3. Group any trailing text
    if (lastLine < lines.length) {
      const trailingLines = lines.slice(lastLine);
      const trailingText = trailingLines.join('\n');
      if (trailingText.trim()) {
        chunks.push({
          content: trailingText,
          startLine: lastLine + 1,
          endLine: lines.length,
          symbolName: 'trailing'
        });
      }
    }

    return chunks;
  }
}

export const ingestionService = new IngestionService();
