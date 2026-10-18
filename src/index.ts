export * from './parser/index.js';
export * from './graph/index.js';
export * from './query/index.js';

import { ASTParser } from './parser/index.js';
import { CodebaseGraph, GraphIndexer } from './graph/index.js';
import { QueryEngine } from './query/index.js';

/**
 * High-level ASTGraphDB factory instance.
 */
export class ASTGraphDB {
  public parser: ASTParser;
  public graph: CodebaseGraph;
  public indexer: GraphIndexer;
  public query: QueryEngine;

  constructor() {
    this.parser = new ASTParser();
    this.graph = new CodebaseGraph();
    this.indexer = new GraphIndexer(this.graph, this.parser);
    this.query = new QueryEngine(this.graph);
  }

  public indexCode(filePath: string, code: string): void {
    this.indexer.indexFile(filePath, code);
  }

  public indexDirectory(dirPath: string): void {
    this.indexer.indexDirectory(dirPath);
  }

  public cypher(queryString: string): Record<string, unknown>[] {
    return this.query.executeCypher(queryString);
  }

  public search(query: string, limit = 10) {
    return this.query.semanticSearch(query, limit);
  }

  public getStats() {
    return this.graph.getStats();
  }
}
