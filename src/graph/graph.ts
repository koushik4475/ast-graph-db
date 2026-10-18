import { ParseResult, ExtractedSymbol } from '../parser/types.js';
import { CodeGraphStats, EdgeKind, GraphEdge, GraphNode, NodeKind } from './types.js';

/**
 * In-Memory High-Performance Codebase Knowledge Graph.
 * Maintains directed acyclic / cyclic graphs of symbols, callgraphs, module imports, and inheritance.
 */
export class CodebaseGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();

  // Fast index lookups
  private outEdgesIndex: Map<string, Set<string>> = new Map();
  private inEdgesIndex: Map<string, Set<string>> = new Map();
  private symbolNameToIds: Map<string, Set<string>> = new Map();
  private filePathToNodeIds: Map<string, Set<string>> = new Map();
  private kindToNodeIds: Map<NodeKind, Set<string>> = new Map();

  constructor() {}

  public addNode(node: Omit<GraphNode, 'metadata'> & { metadata?: Partial<GraphNode['metadata']> }): GraphNode {
    const fullNode: GraphNode = {
      ...node,
      metadata: {
        createdAt: Date.now(),
        inDegree: 0,
        outDegree: 0,
        ...node.metadata,
      },
    };

    this.nodes.set(node.id, fullNode);

    // Update indices
    if (!this.symbolNameToIds.has(node.name)) {
      this.symbolNameToIds.set(node.name, new Set());
    }
    this.symbolNameToIds.get(node.name)!.add(node.id);

    if (!this.filePathToNodeIds.has(node.filePath)) {
      this.filePathToNodeIds.set(node.filePath, new Set());
    }
    this.filePathToNodeIds.get(node.filePath)!.add(node.id);

    if (!this.kindToNodeIds.has(node.kind)) {
      this.kindToNodeIds.set(node.kind, new Set());
    }
    this.kindToNodeIds.get(node.kind)!.add(node.id);

    if (!this.outEdgesIndex.has(node.id)) {
      this.outEdgesIndex.set(node.id, new Set());
    }
    if (!this.inEdgesIndex.has(node.id)) {
      this.inEdgesIndex.set(node.id, new Set());
    }

    return fullNode;
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public removeNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    this.nodes.delete(id);
    this.symbolNameToIds.get(node.name)?.delete(id);
    this.filePathToNodeIds.get(node.filePath)?.delete(id);
    this.kindToNodeIds.get(node.kind)?.delete(id);

    // Clean outgoing edges
    const outEdges = this.outEdgesIndex.get(id);
    if (outEdges) {
      for (const edgeId of outEdges) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          this.inEdgesIndex.get(edge.targetId)?.delete(edgeId);
          this.edges.delete(edgeId);
        }
      }
      this.outEdgesIndex.delete(id);
    }

    // Clean incoming edges
    const inEdges = this.inEdgesIndex.get(id);
    if (inEdges) {
      for (const edgeId of inEdges) {
        const edge = this.edges.get(edgeId);
        if (edge) {
          this.outEdgesIndex.get(edge.sourceId)?.delete(edgeId);
          this.edges.delete(edgeId);
        }
      }
      this.inEdgesIndex.delete(id);
    }

    return true;
  }

  public getNodesByName(name: string): GraphNode[] {
    const ids = this.symbolNameToIds.get(name);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  public getNodesByKind(kind: NodeKind): GraphNode[] {
    const ids = this.kindToNodeIds.get(kind);
    if (!ids) return [];
    return Array.from(ids).map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  public getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  public addEdge(edge: Omit<GraphEdge, 'id' | 'weight'> & { id?: string; weight?: number }): GraphEdge | null {
    if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
      return null;
    }

    const id = edge.id || `edge_${edge.sourceId}_${edge.kind}_${edge.targetId}`;
    const fullEdge: GraphEdge = {
      id,
      kind: edge.kind,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      properties: edge.properties || {},
      weight: edge.weight ?? 1.0,
    };

    this.edges.set(id, fullEdge);

    const sourceNode = this.nodes.get(edge.sourceId)!;
    sourceNode.metadata.outDegree += 1;

    const targetNode = this.nodes.get(edge.targetId)!;
    targetNode.metadata.inDegree += 1;

    this.outEdgesIndex.get(edge.sourceId)!.add(id);
    this.inEdgesIndex.get(edge.targetId)!.add(id);

    return fullEdge;
  }

  public getOutEdges(nodeId: string, kind?: EdgeKind): GraphEdge[] {
    const edgeIds = this.outEdgesIndex.get(nodeId);
    if (!edgeIds) return [];
    const edges = Array.from(edgeIds).map((id) => this.edges.get(id)!).filter(Boolean);
    return kind ? edges.filter((e) => e.kind === kind) : edges;
  }

  public getInEdges(nodeId: string, kind?: EdgeKind): GraphEdge[] {
    const edgeIds = this.inEdgesIndex.get(nodeId);
    if (!edgeIds) return [];
    const edges = Array.from(edgeIds).map((id) => this.edges.get(id)!).filter(Boolean);
    return kind ? edges.filter((e) => e.kind === kind) : edges;
  }

  public getNeighbors(nodeId: string, direction: 'out' | 'in' | 'both' = 'both', kind?: EdgeKind): GraphNode[] {
    const neighborIds = new Set<string>();

    if (direction === 'out' || direction === 'both') {
      this.getOutEdges(nodeId, kind).forEach((e) => neighborIds.add(e.targetId));
    }
    if (direction === 'in' || direction === 'both') {
      this.getInEdges(nodeId, kind).forEach((e) => neighborIds.add(e.sourceId));
    }

    return Array.from(neighborIds).map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Breadth-first search / shortest path between two symbols
   */
  public findShortestPath(startId: string, targetId: string): string[] | null {
    if (startId === targetId) return [startId];
    if (!this.nodes.has(startId) || !this.nodes.has(targetId)) return null;

    const queue: string[] = [startId];
    const visited = new Set<string>([startId]);
    const parentMap = new Map<string, string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) {
        // Reconstruct path
        const path: string[] = [];
        let curr: string | undefined = targetId;
        while (curr) {
          path.unshift(curr);
          curr = parentMap.get(curr);
        }
        return path;
      }

      for (const edge of this.getOutEdges(current)) {
        if (!visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          parentMap.set(edge.targetId, current);
          queue.push(edge.targetId);
        }
      }
    }

    return null;
  }

  /**
   * Computes PageRank for centrality analysis of critical symbols
   */
  public computePageRank(iterations = 20, dampingFactor = 0.85): void {
    const nodeIds = Array.from(this.nodes.keys());
    const N = nodeIds.length;
    if (N === 0) return;

    let ranks: Map<string, number> = new Map();
    nodeIds.forEach((id) => ranks.set(id, 1 / N));

    for (let it = 0; it < iterations; it++) {
      const newRanks: Map<string, number> = new Map();
      const baseRank = (1 - dampingFactor) / N;

      for (const nodeId of nodeIds) {
        let sum = 0;
        const inEdges = this.getInEdges(nodeId);
        for (const edge of inEdges) {
          const sourceOutDegree = this.outEdgesIndex.get(edge.sourceId)?.size || 1;
          const sourceRank = ranks.get(edge.sourceId) || 0;
          sum += sourceRank / sourceOutDegree;
        }
        newRanks.set(nodeId, baseRank + dampingFactor * sum);
      }
      ranks = newRanks;
    }

    for (const [id, rank] of ranks.entries()) {
      const node = this.nodes.get(id);
      if (node) {
        node.metadata.pagerank = Math.round(rank * 10000) / 10000;
      }
    }
  }

  public getStats(): CodeGraphStats {
    let filesCount = 0;
    let classesCount = 0;
    let functionsCount = 0;
    let callsCount = 0;
    let importsCount = 0;
    let inheritancesCount = 0;

    for (const node of this.nodes.values()) {
      if (node.kind === 'File') filesCount++;
      if (node.kind === 'Class') classesCount++;
      if (node.kind === 'Function' || node.kind === 'Method') functionsCount++;
    }

    for (const edge of this.edges.values()) {
      if (edge.kind === 'CALLS') callsCount++;
      if (edge.kind === 'IMPORTS') importsCount++;
      if (edge.kind === 'EXTENDS' || edge.kind === 'IMPLEMENTS') inheritancesCount++;
    }

    return {
      nodesCount: this.nodes.size,
      edgesCount: this.edges.size,
      filesCount,
      classesCount,
      functionsCount,
      callsCount,
      importsCount,
      inheritancesCount,
    };
  }
}
