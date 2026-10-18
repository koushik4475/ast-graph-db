import * as fs from 'fs';
import * as path from 'path';
import { ASTParser, detectLanguage } from '../parser/index.js';
import { CodebaseGraph } from './graph.js';
import { NodeKind } from './types.js';

export interface IndexerOptions {
  includeExtensions?: string[];
  excludePatterns?: (string | RegExp)[];
  maxDepth?: number;
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java'];
const DEFAULT_EXCLUDE = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.pytest_cache'];

/**
 * High-performance graph indexer. Walks codebases, parses ASTs, and connects
 * cross-file symbol references, callgraphs, module imports, and class hierarchies.
 */
export class GraphIndexer {
  private parser: ASTParser;
  private graph: CodebaseGraph;

  constructor(graph?: CodebaseGraph, parser?: ASTParser) {
    this.graph = graph || new CodebaseGraph();
    this.parser = parser || new ASTParser();
  }

  public getGraph(): CodebaseGraph {
    return this.graph;
  }

  public indexFile(filePath: string, content?: string): void {
    const code = content !== undefined ? content : fs.readFileSync(filePath, 'utf-8');
    const parseResult = this.parser.parse(filePath, code);

    // 1. Create or register File node
    const fileNodeId = `file:${filePath}`;
    this.graph.addNode({
      id: fileNodeId,
      kind: 'File',
      name: path.basename(filePath),
      filePath,
      language: parseResult.language,
      properties: {
        durationMs: parseResult.parseDurationMs,
        lineCount: code.split(/\r?\n/).length,
      },
    });

    // 2. Add Symbol nodes & connect DEFINES edge
    for (const sym of parseResult.symbols) {
      let kind: NodeKind = 'Function';
      if (sym.kind === 'class') kind = 'Class';
      else if (sym.kind === 'interface') kind = 'Interface';
      else if (sym.kind === 'struct') kind = 'Struct';
      else if (sym.kind === 'method') kind = 'Method';
      else if (sym.kind === 'variable' || sym.kind === 'constant') kind = 'Variable';

      // Check if an unresolved placeholder node already exists with this name
      const placeholderId = `call_target:${sym.name}`;
      const placeholderNode = this.graph.getNode(placeholderId);
      if (placeholderNode && placeholderNode.properties.isUnresolved) {
        // Re-link incoming edges to this real symbol node
        const inEdges = [...this.graph.getInEdges(placeholderId)];
        for (const edge of inEdges) {
          this.graph.addEdge({
            kind: edge.kind,
            sourceId: edge.sourceId,
            targetId: sym.id,
            properties: edge.properties,
          });
        }
        // Remove placeholder node from graph
        this.graph.removeNode(placeholderId);
      }

      this.graph.addNode({
        id: sym.id,
        kind,
        name: sym.name,
        filePath,
        language: sym.language,
        line: sym.span.start.line,
        column: sym.span.start.column,
        properties: {
          modifiers: sym.modifiers,
          returnType: sym.returnType,
          parameterTypes: sym.parameterTypes,
        },
      });

      this.graph.addEdge({
        kind: 'DEFINES',
        sourceId: fileNodeId,
        targetId: sym.id,
        properties: {},
      });
    }

    // 3. Connect Inheritances
    for (const inh of parseResult.inheritances) {
      // Find matching super symbol or placeholder
      const superMatches = this.graph.getNodesByName(inh.superType);
      const targetId = superMatches.length > 0 ? superMatches[0].id : `external:${inh.superType}`;

      if (superMatches.length === 0) {
        // Register external symbol node
        this.graph.addNode({
          id: targetId,
          kind: inh.kind === 'extends' ? 'Class' : 'Interface',
          name: inh.superType,
          filePath: 'external',
          properties: { isExternal: true },
        });
      }

      this.graph.addEdge({
        kind: inh.kind === 'extends' ? 'EXTENDS' : 'IMPLEMENTS',
        sourceId: inh.subTypeId,
        targetId,
        properties: {},
      });
    }

    // 4. Connect Imports
    for (const imp of parseResult.imports) {
      const targetModuleId = `module:${imp.moduleSpecifier}`;
      if (!this.graph.getNode(targetModuleId)) {
        this.graph.addNode({
          id: targetModuleId,
          kind: 'Module',
          name: imp.moduleSpecifier,
          filePath: imp.moduleSpecifier,
          properties: { isModule: true },
        });
      }

      this.graph.addEdge({
        kind: 'IMPORTS',
        sourceId: fileNodeId,
        targetId: targetModuleId,
        properties: {
          importedSymbols: imp.importedSymbols,
        },
      });
    }

    // 5. Connect Calls
    for (const call of parseResult.calls) {
      const calleeMatches = this.graph.getNodesByName(call.calleeName);
      const targetId = calleeMatches.length > 0 ? calleeMatches[0].id : `call_target:${call.calleeName}`;

      if (calleeMatches.length === 0 && !this.graph.getNode(targetId)) {
        this.graph.addNode({
          id: targetId,
          kind: 'Function',
          name: call.calleeName,
          filePath: 'external',
          properties: { isUnresolved: true },
        });
      }

      const sourceId = call.callerSymbolId || fileNodeId;
      this.graph.addEdge({
        kind: 'CALLS',
        sourceId,
        targetId,
        properties: {
          argumentsCount: call.argumentsCount,
        },
      });
    }
  }

  public indexDirectory(dirPath: string, options: IndexerOptions = {}): void {
    const extensions = options.includeExtensions || DEFAULT_EXTENSIONS;
    const excludes = options.excludePatterns || DEFAULT_EXCLUDE;

    const walk = (currentDir: string, depth: number) => {
      if (options.maxDepth !== undefined && depth > options.maxDepth) return;
      if (!fs.existsSync(currentDir)) return;

      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relativeName = entry.name;

        // Skip excluded directories / files
        const isExcluded = excludes.some((exc) => {
          if (typeof exc === 'string') return relativeName === exc;
          return exc.test(relativeName);
        });
        if (isExcluded) continue;

        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            try {
              this.indexFile(fullPath);
            } catch (err) {
              console.warn(`Failed to parse file ${fullPath}:`, err);
            }
          }
        }
      }
    };

    walk(dirPath, 0);
    this.graph.computePageRank();
  }
}
