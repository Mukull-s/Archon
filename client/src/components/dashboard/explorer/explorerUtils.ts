import { ArchitecturalRole, FileItem, TreeNode } from './explorerTypes';

/**
 * Detects the architectural role of a file based on file path, entryPoints, and AST signals.
 */
export function detectArchitecturalRole(
  filePath?: string | null,
  ast?: any,
  entryPoints: string[] = []
): ArchitecturalRole {
  if (!filePath || typeof filePath !== 'string') return 'MODULE';
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();

  // 1. Entry point check
  if (Array.isArray(entryPoints) && entryPoints.some(ep => typeof ep === 'string' && ep.replace(/\\/g, '/').toLowerCase() === normalized)) {
    return 'ENTRY POINT';
  }

  // 2. Test files
  if (
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('/__tests__/') ||
    normalized.includes('/tests/')
  ) {
    return 'TEST';
  }

  // 3. Controllers
  if (
    normalized.includes('controller') ||
    normalized.includes('/controllers/') ||
    (ast?.classes && ast.classes.some((c: any) => typeof c?.name === 'string' && c.name.toLowerCase().endsWith('controller')))
  ) {
    return 'CONTROLLER';
  }

  // 4. Services
  if (
    normalized.includes('service') ||
    normalized.includes('/services/') ||
    (ast?.classes && ast.classes.some((c: any) => typeof c?.name === 'string' && c.name.toLowerCase().endsWith('service')))
  ) {
    return 'SERVICE';
  }

  // 5. Routes
  if (
    normalized.includes('route') ||
    normalized.includes('/routes/') ||
    normalized.includes('/api/') ||
    (ast?.routes && ast.routes.length > 0)
  ) {
    return 'ROUTE';
  }

  // 6. Models / Schemas
  if (
    normalized.includes('model') ||
    normalized.includes('/models/') ||
    normalized.includes('schema') ||
    normalized.includes('/entities/') ||
    normalized.endsWith('.prisma')
  ) {
    return 'MODEL';
  }

  // 7. Config
  if (
    normalized.includes('config') ||
    normalized.includes('.env') ||
    normalized.includes('settings') ||
    normalized.includes('tsconfig') ||
    normalized.includes('vite.config') ||
    normalized.includes('tailwind.config')
  ) {
    return 'CONFIG';
  }

  // 8. Components
  if (
    normalized.includes('/components/') ||
    normalized.includes('/views/') ||
    normalized.includes('/pages/') ||
    normalized.endsWith('.tsx') ||
    normalized.endsWith('.jsx')
  ) {
    return 'COMPONENT';
  }

  // 9. Utilities & Helpers
  if (
    normalized.includes('util') ||
    normalized.includes('/utils/') ||
    normalized.includes('helper') ||
    normalized.includes('/helpers/') ||
    normalized.includes('/lib/')
  ) {
    return 'UTILITY';
  }

  return 'MODULE';
}

/**
 * Returns color & badge configuration for an architectural role.
 */
export function getRoleBadgeStyle(role: ArchitecturalRole): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (role) {
    case 'ENTRY POINT':
      return {
        label: 'ENTRY POINT',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30'
      };
    case 'CONTROLLER':
      return {
        label: 'CONTROLLER',
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-400',
        border: 'border-indigo-500/30'
      };
    case 'SERVICE':
      return {
        label: 'SERVICE',
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30'
      };
    case 'ROUTE':
      return {
        label: 'ROUTE',
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30'
      };
    case 'MODEL':
      return {
        label: 'MODEL',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30'
      };
    case 'CONFIG':
      return {
        label: 'CONFIG',
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30'
      };
    case 'UTILITY':
      return {
        label: 'UTILITY',
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30'
      };
    case 'COMPONENT':
      return {
        label: 'COMPONENT',
        bg: 'bg-sky-500/10',
        text: 'text-sky-400',
        border: 'border-sky-500/30'
      };
    case 'TEST':
      return {
        label: 'TEST',
        bg: 'bg-zinc-500/10',
        text: 'text-zinc-400',
        border: 'border-zinc-500/30'
      };
    case 'MODULE':
    default:
      return {
        label: 'MODULE',
        bg: 'bg-zinc-800/40',
        text: 'text-zinc-400',
        border: 'border-zinc-700/40'
      };
  }
}

/**
 * Returns all ancestor directory paths for a file, ensuring auto-expansion.
 * Example: 'client/src/lib/api.ts' -> ['', 'client', 'client/src', 'client/src/lib']
 */
export function getParentDirectoryPaths(filePath?: string | null): string[] {
  if (!filePath || typeof filePath !== 'string') return [''];
  const parts = filePath.replace(/\\/g, '/').split('/');
  const parents: string[] = ['']; // root is always expanded
  let curr = '';
  for (let i = 0; i < parts.length - 1; i++) {
    curr = curr ? `${curr}/${parts[i]}` : parts[i];
    parents.push(curr);
  }
  return parents;
}

/**
 * Builds a hierarchical tree from flat FileItem list.
 */
export function buildFileTree(
  files: FileItem[] = [],
  rolesMap: Record<string, ArchitecturalRole> = {},
  warningsMap: Record<string, boolean> = {},
  hotspotsMap: Record<string, number> = {}
): TreeNode {
  const root: TreeNode = {
    name: 'root',
    path: '',
    isDirectory: true,
    size: 0,
    lines: 0,
    children: {}
  };

  if (!Array.isArray(files)) return root;

  files.forEach(file => {
    if (!file || !file.path || typeof file.path !== 'string') return;
    const parts = file.path.replace(/\\/g, '/').split('/');
    let current = root;
    let accumulatedPath = '';

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path: accumulatedPath,
          isDirectory: !isLast,
          size: 0,
          lines: 0,
          children: {},
          role: isLast ? rolesMap[file.path] : undefined,
          hasWarning: isLast ? warningsMap[file.path] : false,
          hotspotCount: isLast ? hotspotsMap[file.path] : undefined
        };
      }

      current.children[part].size += file.size || 0;
      current.children[part].lines += file.lines || 0;

      if (!isLast) {
        current = current.children[part];
      }
    });
  });

  return root;
}

/**
 * Detect language extension for syntax styling and iconography.
 */
export function detectLanguage(filePath?: string | null): string {
  if (!filePath || typeof filePath !== 'string') return 'Plain Text';
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'TypeScript';
    case 'js':
    case 'jsx':
      return 'JavaScript';
    case 'json':
      return 'JSON';
    case 'css':
    case 'scss':
      return 'CSS';
    case 'md':
      return 'Markdown';
    case 'prisma':
      return 'Prisma';
    case 'py':
      return 'Python';
    case 'go':
      return 'Go';
    case 'rs':
      return 'Rust';
    case 'html':
      return 'HTML';
    case 'yaml':
    case 'yml':
      return 'YAML';
    case 'sql':
      return 'SQL';
    default:
      return 'Plain Text';
  }
}

/**
 * Format bytes into human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
