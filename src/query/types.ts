import { EdgeKind, GraphNode, NodeKind } from '../graph/types.js';

export interface CypherPatternNode {
  variable?: string;
  kind?: NodeKind | string;
  name?: string;
  properties?: Record<string, unknown>;
}

export interface CypherPatternEdge {
  variable?: string;
  kind?: EdgeKind | string;
  direction?: 'out' | 'in' | 'both';
  properties?: Record<string, unknown>;
}

export interface CypherWhereClause {
  field: string;
  operator: '=' | '!=' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean;
}

export interface ParsedCypherQuery {
  matchPattern: {
    source: CypherPatternNode;
    edge?: CypherPatternEdge;
    target?: CypherPatternNode;
  };
  whereClauses: CypherWhereClause[];
  returnFields: string[];
  limit?: number;
}

export interface SemanticSearchResult {
  node: GraphNode;
  score: number;
  matchReasons: string[];
}
