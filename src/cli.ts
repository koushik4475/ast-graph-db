#!/usr/bin/env node
import * as path from 'path';
import { ASTGraphDB } from './index.js';

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const db = new ASTGraphDB();

  console.log('⚡ [AST-Graph-DB] Codebase Knowledge Graph & Static Analysis DB v1.0.0');

  if (command === 'index') {
    const targetDir = args[1] || process.cwd();
    console.log(`Indexing directory: ${targetDir}...`);
    const start = performance.now();
    db.indexDirectory(targetDir);
    const duration = Math.round(performance.now() - start);

    const stats = db.getStats();
    console.log(`\n✅ Graph Built in ${duration}ms!`);
    console.log(`- Nodes: ${stats.nodesCount}`);
    console.log(`- Edges: ${stats.edgesCount}`);
    console.log(`- Files: ${stats.filesCount}`);
    console.log(`- Classes/Structs: ${stats.classesCount}`);
    console.log(`- Functions/Methods: ${stats.functionsCount}`);
    console.log(`- Call Edges: ${stats.callsCount}`);
    console.log(`- Import Edges: ${stats.importsCount}`);
  } else if (command === 'query') {
    const targetDir = args[1] || process.cwd();
    const query = args[2] || 'MATCH (c:Class) RETURN c.name';
    db.indexDirectory(targetDir);
    console.log(`\nExecuting Cypher Query: ${query}`);
    const results = db.cypher(query);
    console.log(`Found ${results.length} result(s):`);
    console.log(JSON.stringify(results, null, 2));
  } else if (command === 'search') {
    const targetDir = args[1] || process.cwd();
    const term = args[2] || 'execute';
    db.indexDirectory(targetDir);
    console.log(`\nSemantic Search for: "${term}"`);
    const results = db.search(term, 5);
    for (const res of results) {
      console.log(`- [${res.score} pts] [${res.node.kind}] ${res.node.name} (${res.node.filePath})`);
      console.log(`  Reasons: ${res.matchReasons.join(', ')}`);
    }
  } else {
    console.log(`
Usage:
  ast-graph-db index <directory>
  ast-graph-db query <directory> "<cypher-query>"
  ast-graph-db search <directory> "<search-term>"

Examples:
  ast-graph-db index ./src
  ast-graph-db query ./src 'MATCH (f:Function) RETURN f.name'
  ast-graph-db search ./src "Parser"
`);
  }
}

main();
