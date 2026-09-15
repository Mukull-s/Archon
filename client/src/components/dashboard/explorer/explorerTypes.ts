export type ArchitecturalRole =
  | 'ENTRY POINT'
  | 'CONTROLLER'
  | 'SERVICE'
  | 'ROUTE'
  | 'MODEL'
  | 'CONFIG'
  | 'UTILITY'
  | 'COMPONENT'
  | 'TEST'
  | 'MODULE';

export interface FileItem {
  path: string;
  size: number;
  lines: number;
  content?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lines: number;
  children: Record<string, TreeNode>;
  role?: ArchitecturalRole;
  isEntryPoint?: boolean;
  hasWarning?: boolean;
  hotspotCount?: number;
}

export interface DriftViolation {
  filePath: string;
  targetPath: string;
  violation: string;
}

export interface InsightsData {
  centralityHotspots?: Array<{ filePath: string; inDegree: number }>;
  missingTests?: string[];
  circularDependencies?: string[][];
  deadCode?: string[];
  architecturalDrift?: DriftViolation[];
}

export interface FileIntelligence {
  path: string;
  name: string;
  size: number;
  lines: number;
  content?: string;
  language: string;
  role: ArchitecturalRole;
  isEntryPoint: boolean;
  inDegree: number;
  outboundDependencies: string[];
  inboundDependents: string[];
  driftViolations: DriftViolation[];
  cycleInvolvement: string[][];
  isMissingTest: boolean;
  isDeadCode: boolean;
  astInfo?: {
    classes: Array<{ name: string; methods?: string[] }>;
    functions: Array<{ name: string; params?: string[] }>;
    imports: any[];
    exports: any[];
  };
}

export interface ExplorerTabProps {
  files: FileItem[];
  selectedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onToggleFolder: (folderPath: string, checked: boolean) => void;
  repositoryId: string;
  astMetadata: Record<string, any>;
  dependencyGraph: Record<string, string[]>;
  selectedExplorerFile: string | null;
  setSelectedExplorerFile: (filePath: string | null) => void;
  investigationTarget?: string;
  onSelectInvestigationTarget?: (target: string) => void;
  entryPoints?: string[];
  framework?: string | null;
  onNavigateToGraph?: (filePath?: string) => void;
  onNavigateToImpact?: (filePath?: string) => void;
  onNavigateToTrace?: (filePath?: string) => void;
  onTriggerChat?: (prompt: string) => void;
}
