import { GraphNode } from './GraphEngine';

export interface Point {
  x: number;
  y: number;
}

export interface ClusterBoundary {
  id: string; // folder path or layer name
  name: string;
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

export class LayoutEngine {
  /**
   * Layout nodes grouped by folders (Explore Architecture Mode).
   * Clusters nodes inside bounding folder boxes.
   */
  calculateFolderLayout(nodes: GraphNode[]): {
    nodes: PositionedNode[];
    clusters: ClusterBoundary[];
  } {
    const positioned: PositionedNode[] = [];
    const clusters: ClusterBoundary[] = [];

    // Group files by parent directory path
    const groups: Record<string, GraphNode[]> = {};
    nodes.forEach(n => {
      const parts = n.id.split('/');
      parts.pop(); // Remove filename
      const folderPath = parts.join('/') || 'root';
      if (!groups[folderPath]) groups[folderPath] = [];
      groups[folderPath].push(n);
    });

    const folderPaths = Object.keys(groups).sort();
    
    // Position folder clusters in a grid layout (e.g., 2 columns)
    const cols = 2;
    const folderWidth = 360;
    const folderHeight = 280;
    const gapX = 60;
    const gapY = 60;

    folderPaths.forEach((folder, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);

      const startX = col * (folderWidth + gapX) + 50;
      const startY = row * (folderHeight + gapY) + 50;

      const folderFiles = groups[folder];
      const itemsPerRow = 3;
      const fileGapX = 110;
      const fileGapY = 70;

      // Position individual nodes inside the folder box
      folderFiles.forEach((node, fileIdx) => {
        const fileCol = fileIdx % itemsPerRow;
        const fileRow = Math.floor(fileIdx / itemsPerRow);

        const x = startX + 40 + fileCol * fileGapX;
        const y = startY + 50 + fileRow * fileGapY;

        positioned.push({
          ...node,
          x,
          y
        });
      });

      clusters.push({
        id: folder,
        name: folder === 'root' ? 'root modules' : folder,
        minX: startX,
        minY: startY,
        width: folderWidth,
        height: folderHeight
      });
    });

    return { nodes: positioned, clusters };
  }

  /**
   * Layout nodes in vertical columns based on architectural layers (Trace Request Flow Mode).
   */
  calculateLayerLayout(nodes: GraphNode[]): {
    nodes: PositionedNode[];
    clusters: ClusterBoundary[];
  } {
    const positioned: PositionedNode[] = [];
    const clusters: ClusterBoundary[] = [];

    const layers: Array<{ id: string; name: string; types: string[] }> = [
      { id: 'route', name: '1. Ingress Routes', types: ['route'] },
      { id: 'controller', name: '2. Primary Controllers', types: ['controller'] },
      { id: 'service', name: '3. Core Services', types: ['service'] },
      { id: 'config', name: '4. Database & Models', types: ['config'] },
      { id: 'other', name: '5. Utilities & Components', types: ['hook', 'component', 'utility', 'other'] }
    ];

    const colWidth = 240;
    const gapX = 80;

    layers.forEach((layer, layerIdx) => {
      const layerNodes = nodes.filter(n => layer.types.includes(n.type));
      const startX = layerIdx * (colWidth + gapX) + 50;

      const rowHeight = 75;
      layerNodes.forEach((node, idx) => {
        const x = startX + 20;
        const y = 80 + idx * rowHeight;

        positioned.push({
          ...node,
          x,
          y
        });
      });

      clusters.push({
        id: layer.id,
        name: layer.name,
        minX: startX,
        minY: 40,
        width: colWidth,
        height: Math.max(350, layerNodes.length * rowHeight + 80)
      });
    });

    return { nodes: positioned, clusters };
  }

  /**
   * Layout nodes radiating outward from the center hubs (Understand Dependencies Mode).
   */
  calculateDependencyLayout(nodes: GraphNode[]): {
    nodes: PositionedNode[];
    clusters: ClusterBoundary[];
  } {
    const positioned: PositionedNode[] = [];
    
    // Sort nodes by in-degree to find central hubs
    const sorted = [...nodes].sort((a, b) => b.inDegree - a.inDegree);
    
    const centerX = 450;
    const centerY = 350;

    // Place the top hubs in the center ring
    const hubs = sorted.slice(0, Math.min(3, sorted.length));
    const midLevel = sorted.slice(hubs.length, Math.min(12, sorted.length));
    const outerLevel = sorted.slice(hubs.length + midLevel.length);

    // Hub ring
    hubs.forEach((node, idx) => {
      const angle = (idx * 2 * Math.PI) / Math.max(1, hubs.length);
      const radius = 60;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positioned.push({ ...node, x, y });
    });

    // Mid ring
    midLevel.forEach((node, idx) => {
      const angle = (idx * 2 * Math.PI) / Math.max(1, midLevel.length);
      const radius = 170;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positioned.push({ ...node, x, y });
    });

    // Outer ring
    outerLevel.forEach((node, idx) => {
      const angle = (idx * 2 * Math.PI) / Math.max(1, outerLevel.length);
      const radius = 320;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positioned.push({ ...node, x, y });
    });

    return { nodes: positioned, clusters: [] };
  }
}
