import { ExtractedCall, ExtractedImport, ExtractedInheritance, ExtractedSymbol, SupportedLanguage } from '../parser/types.js';

export type NodeKind =
  | 'File'
  | 'Module'
  | 'Class'
  | 'Interface'
  | 'Struct'
  | 'Function'
  | 'Method'
  | 'Variable'
  | 'Parameter';

export type EdgeKind =
  | 'DEFINES'          // File -> Symbol
  | 'CALLS'            // Function/Method -> Function/Method
  | 'IMPORTS'          // File -> Symbol / File -> Module
  | 'EXTENDS'          // Class -> Class / Interface -> Interface
  | 'IMPLEMENTS'       // Class -> Interface / Struct -> Trait
  | 'CONTAINS'         // Class -> Method
  | 'DEPENDS_ON';      // General dependency

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  filePath: string;
  language?: SupportedLanguage;
  line?: number;
  column?: number;
  properties: Record<string, unknown>;
  metadata: {
    createdAt: number;
    inDegree: number;
    outDegree: number;
    pagerank?: number;
  };
}

export interface GraphEdge {
  id: string;
  kind: EdgeKind;
  sourceId: string;
  targetId: string;
  properties: Record<string, unknown>;
  weight: number;
}

export interface CodeGraphStats {
  nodesCount: number;
  edgesCount: number;
  filesCount: number;
  classesCount: number;
  functionsCount: number;
  callsCount: number;
  importsCount: number;
  inheritancesCount: number;
}
