import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GraphIndexer } from '../graph/indexer.js';

describe('GraphIndexer exclusion patterns', () => {
  it('resets global regular expressions for every directory entry', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-graph-indexer-'));
    const skippedA = path.join(directory, 'skip-a.ts');
    const skippedB = path.join(directory, 'skip-b.ts');
    const included = path.join(directory, 'keep.ts');

    try {
      fs.writeFileSync(skippedA, 'export const a = 1;');
      fs.writeFileSync(skippedB, 'export const b = 2;');
      fs.writeFileSync(included, 'export const keep = 3;');

      const indexer = new GraphIndexer();
      indexer.indexDirectory(directory, { excludePatterns: [/^skip-[ab][.]ts$/g] });
      const graph = indexer.getGraph();

      assert.equal(graph.getNode(`file:${skippedA}`), undefined);
      assert.equal(graph.getNode(`file:${skippedB}`), undefined);
      assert.ok(graph.getNode(`file:${included}`));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
