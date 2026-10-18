import { CodebaseGraph } from '../graph/graph.js';
import { EdgeKind, GraphNode, NodeKind } from '../graph/types.js';
import {
  CypherPatternEdge,
  CypherPatternNode,
  CypherWhereClause,
  ParsedCypherQuery,
  SemanticSearchResult,
} from './types.js';

/**
 * Cypher-like Declarative Graph Query Engine & Semantic Search.
 * Example queries supported:
 * - MATCH (c:Class)-[:EXTENDS]->(b:Class) WHERE c.name CONTAINS "Service" RETURN c, b
 * - MATCH (f:Function)-[:CALLS]->(t:Function) WHERE t.name = "execute" RETURN f, t
 * - MATCH (n:Function) WHERE n.name STARTS_WITH "parse" RETURN n
 */
export class QueryEngine {
  private graph: CodebaseGraph;

  constructor(graph: CodebaseGraph) {
    this.graph = graph;
  }

  /**
   * Parse a Cypher-like AST query string into an executable plan
   */
  public parseCypher(query: string): ParsedCypherQuery {
    const trimmed = query.trim();

    // Regex for MATCH: MATCH (a:Kind)-[:EDGE]->(b:Kind) OR MATCH (a:Kind)
    const matchClauseMatch = trimmed.match(
      /MATCH\s+\(([\w\s:]+)\)(?:-\[:([\w\s:]+)\]->\(([\w\s:]+)\))?/i
    );

    if (!matchClauseMatch) {
      throw new Error(`Invalid Cypher MATCH syntax in query: ${query}`);
    }

    const [, srcPattern, edgePattern, tgtPattern] = matchClauseMatch;

    const parseNodePattern = (pat: string): CypherPatternNode => {
      const parts = pat.trim().split(':');
      const variable = parts[0]?.trim() || undefined;
      const kind = parts[1]?.trim() || undefined;
      return { variable, kind };
    };

    const parseEdgePattern = (pat?: string): CypherPatternEdge | undefined => {
      if (!pat) return undefined;
      const parts = pat.trim().split(':');
      const variable = parts.length > 1 ? parts[0]?.trim() : undefined;
      const kind = (parts.length > 1 ? parts[1] : parts[0])?.trim();
      return { variable, kind, direction: 'out' };
    };

    const source = parseNodePattern(srcPattern);
    const edge = parseEdgePattern(edgePattern);
    const target = tgtPattern ? parseNodePattern(tgtPattern) : undefined;

    // Parse WHERE clauses: WHERE n.name = "foo" AND n.line > 10
    const whereClauses: CypherWhereClause[] = [];
    const whereMatch = trimmed.match(/WHERE\s+(.+?)(?=\s+RETURN|\s+LIMIT|$)/i);
    if (whereMatch) {
      const conditions = whereMatch[1].split(/\s+AND\s+/i);
      for (const cond of conditions) {
        const condMatch = cond.trim().match(/([\w.]+)\s*(=|!=|CONTAINS|STARTS_WITH|ENDS_WITH|>|<|>=|<=)\s*(["']?[\w\s.:_-]+["']?)/i);
        if (condMatch) {
          const [, field, rawOp, rawVal] = condMatch;
          let val: string | number | boolean = rawVal.replace(/^['"]|['"]$/g, '');
          if (!isNaN(Number(val)) && !rawVal.includes('"') && !rawVal.includes("'")) {
            val = Number(val);
          } else if (val === 'true') {
            val = true;
          } else if (val === 'false') {
            val = false;
          }
          whereClauses.push({
            field,
            operator: rawOp.toUpperCase() as CypherWhereClause['operator'],
            value: val,
          });
        }
      }
    }

    // Parse RETURN clause
    const returnMatch = trimmed.match(/RETURN\s+([\w\s,.*]+?)(?=\s+LIMIT|$)/i);
    const returnFields = returnMatch
      ? returnMatch[1].split(',').map((f) => f.trim())
      : ['*'];

    // Parse LIMIT clause
    const limitMatch = trimmed.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

    return {
      matchPattern: { source, edge, target },
      whereClauses,
      returnFields,
      limit,
    };
  }

  /**
   * Execute a parsed Cypher query against the knowledge graph
   */
  public executeCypher(queryStr: string): Record<string, unknown>[] {
    const parsed = this.parseCypher(queryStr);
    const { source, edge, target } = parsed.matchPattern;

    const candidateSources = source.kind
      ? this.graph.getNodesByKind(source.kind as NodeKind)
      : this.graph.getAllNodes();

    const results: Record<string, unknown>[] = [];

    for (const srcNode of candidateSources) {
      if (!edge || !target) {
        // Single-node query
        const row: Record<string, unknown> = {
          [source.variable || 'n']: srcNode,
        };

        if (this.evalWhere(row, parsed.whereClauses)) {
          results.push(this.projectRow(row, parsed.returnFields));
        }
      } else {
        // Pattern with edge: (source)-[edge]->(target)
        const outEdges = this.graph.getOutEdges(
          srcNode.id,
          edge.kind ? (edge.kind as EdgeKind) : undefined
        );

        for (const outEdge of outEdges) {
          const tgtNode = this.graph.getNode(outEdge.targetId);
          if (!tgtNode) continue;

          if (target.kind && tgtNode.kind.toLowerCase() !== target.kind.toLowerCase()) {
            continue;
          }

          const row: Record<string, unknown> = {
            [source.variable || 'src']: srcNode,
            [edge.variable || 'r']: outEdge,
            [target.variable || 'tgt']: tgtNode,
          };

          if (this.evalWhere(row, parsed.whereClauses)) {
            results.push(this.projectRow(row, parsed.returnFields));
          }
        }
      }

      if (parsed.limit && results.length >= parsed.limit) {
        break;
      }
    }

    return results;
  }

  private evalWhere(row: Record<string, unknown>, clauses: CypherWhereClause[]): boolean {
    for (const clause of clauses) {
      const [varName, ...propPath] = clause.field.split('.');
      const entity = row[varName] as Record<string, unknown> | undefined;
      if (!entity) return false;

      let actualVal: unknown = entity;
      for (const p of propPath) {
        if (actualVal && typeof actualVal === 'object') {
          actualVal = (actualVal as Record<string, unknown>)[p];
        } else {
          actualVal = undefined;
          break;
        }
      }

      const expectedVal = clause.value;
      switch (clause.operator) {
        case '=':
          if (String(actualVal).toLowerCase() !== String(expectedVal).toLowerCase()) return false;
          break;
        case '!=':
          if (String(actualVal).toLowerCase() === String(expectedVal).toLowerCase()) return false;
          break;
        case 'CONTAINS':
          if (typeof actualVal !== 'string' || !actualVal.toLowerCase().includes(String(expectedVal).toLowerCase())) return false;
          break;
        case 'STARTS_WITH':
          if (typeof actualVal !== 'string' || !actualVal.toLowerCase().startsWith(String(expectedVal).toLowerCase())) return false;
          break;
        case 'ENDS_WITH':
          if (typeof actualVal !== 'string' || !actualVal.toLowerCase().endsWith(String(expectedVal).toLowerCase())) return false;
          break;
        case '>':
          if (Number(actualVal) <= Number(expectedVal)) return false;
          break;
        case '<':
          if (Number(actualVal) >= Number(expectedVal)) return false;
          break;
        case '>=':
          if (Number(actualVal) < Number(expectedVal)) return false;
          break;
        case '<=':
          if (Number(actualVal) > Number(expectedVal)) return false;
          break;
      }
    }
    return true;
  }

  private projectRow(row: Record<string, unknown>, returnFields: string[]): Record<string, unknown> {
    if (returnFields.includes('*')) {
      return row;
    }
    const projected: Record<string, unknown> = {};
    for (const field of returnFields) {
      if (row[field] !== undefined) {
        projected[field] = row[field];
      } else if (field.includes('.')) {
        const [varName, ...propPath] = field.split('.');
        const entity = row[varName] as Record<string, unknown> | undefined;
        if (entity) {
          let val: unknown = entity;
          for (const p of propPath) {
            if (val && typeof val === 'object') {
              val = (val as Record<string, unknown>)[p];
            } else {
              val = undefined;
              break;
            }
          }
          projected[field] = val;
        }
      }
    }
    return projected;
  }

  /**
   * Fast semantic and fuzzy search across symbols, files, and signatures
   */
  public semanticSearch(query: string, limit = 10): SemanticSearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const results: SemanticSearchResult[] = [];

    for (const node of this.graph.getAllNodes()) {
      let score = 0;
      const reasons: string[] = [];
      const nodeName = node.name.toLowerCase();
      const filePath = node.filePath.toLowerCase();

      // Exact name match
      if (nodeName === query.toLowerCase()) {
        score += 100;
        reasons.push('Exact name match');
      } else if (nodeName.includes(query.toLowerCase())) {
        score += 50;
        reasons.push('Name contains query');
      }

      // Keyword term matching
      for (const term of terms) {
        if (nodeName.includes(term)) {
          score += 20;
          reasons.push(`Name matches term '${term}'`);
        }
        if (filePath.includes(term)) {
          score += 10;
          reasons.push(`File path matches term '${term}'`);
        }
      }

      // Boost heavily referenced nodes using PageRank
      if (node.metadata.pagerank) {
        score += node.metadata.pagerank * 100;
        reasons.push(`PageRank centrality boost (+${Math.round(node.metadata.pagerank * 100)})`);
      }

      // In-degree popularity boost
      if (node.metadata.inDegree > 0) {
        score += Math.min(node.metadata.inDegree * 2, 20);
      }

      if (score > 0) {
        results.push({ node, score: Math.round(score * 10) / 10, matchReasons: reasons });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
