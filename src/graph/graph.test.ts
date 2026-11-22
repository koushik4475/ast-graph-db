import assert from 'node:assert/strict';
import test from 'node:test';

import { CodebaseGraph } from './graph.js';

const makeNode = (id: string) => ({
  id,
  kind: 'Function' as const,
  name: id,
  filePath: 'src/example.ts',
  properties: {},
});

test('re-adding an edge does not inflate degree counters or edge indexes', () => {
  const graph = new CodebaseGraph();
  graph.addNode(makeNode('source'));
  graph.addNode(makeNode('target'));

  const edge = {
    kind: 'CALLS' as const,
    sourceId: 'source',
    targetId: 'target',
    properties: {},
  };

  graph.addEdge(edge);
  graph.addEdge(edge);

  assert.equal(graph.getAllEdges().length, 1);
  assert.equal(graph.getNode('source')?.metadata.outDegree, 1);
  assert.equal(graph.getNode('target')?.metadata.inDegree, 1);
  assert.equal(graph.getOutEdges('source').length, 1);
  assert.equal(graph.getInEdges('target').length, 1);
});

test('replacing an edge ID moves indexes and degree counts to the new endpoints', () => {
  const graph = new CodebaseGraph();
  for (const id of ['old-source', 'old-target', 'new-source', 'new-target']) {
    graph.addNode(makeNode(id));
  }

  graph.addEdge({
    id: 'shared-edge',
    kind: 'CALLS',
    sourceId: 'old-source',
    targetId: 'old-target',
    properties: {},
  });
  graph.addEdge({
    id: 'shared-edge',
    kind: 'CALLS',
    sourceId: 'new-source',
    targetId: 'new-target',
    properties: {},
  });

  assert.equal(graph.getAllEdges().length, 1);
  assert.equal(graph.getNode('old-source')?.metadata.outDegree, 0);
  assert.equal(graph.getNode('old-target')?.metadata.inDegree, 0);
  assert.equal(graph.getNode('new-source')?.metadata.outDegree, 1);
  assert.equal(graph.getNode('new-target')?.metadata.inDegree, 1);
  assert.equal(graph.getOutEdges('old-source').length, 0);
  assert.equal(graph.getInEdges('old-target').length, 0);
  assert.equal(graph.getOutEdges('new-source')[0]?.targetId, 'new-target');
});

test('removing a node decrements degrees on its remaining neighbors', () => {
  const graph = new CodebaseGraph();
  graph.addNode(makeNode('source'));
  graph.addNode(makeNode('target'));
  graph.addEdge({
    kind: 'CALLS',
    sourceId: 'source',
    targetId: 'target',
    properties: {},
  });

  assert.equal(graph.removeNode('target'), true);

  assert.equal(graph.getNode('source')?.metadata.outDegree, 0);
  assert.equal(graph.getOutEdges('source').length, 0);
  assert.equal(graph.getAllEdges().length, 0);
});
