use crate::graph::{CodebaseGraph, GraphNode};

pub struct QueryEngine<'a> {
    graph: &'a CodebaseGraph,
}

impl<'a> QueryEngine<'a> {
    pub fn new(graph: &'a CodebaseGraph) -> Self {
        Self { graph }
    }

    pub fn query_by_name(&self, name: &str) -> Vec<&GraphNode> {
        self.graph.get_nodes_by_name(name)
    }

    pub fn semantic_search(&self, term: &str, limit: usize) -> Vec<(&GraphNode, usize)> {
        let term_lower = term.to_lowercase();
        let mut results = Vec::new();

        for node in self.graph.nodes.values() {
            let mut score = 0;
            if node.name.to_lowercase() == term_lower {
                score += 100;
            } else if node.name.to_lowercase().contains(&term_lower) {
                score += 50;
            }

            if score > 0 {
                results.push((node, score));
            }
        }

        results.sort_by(|a, b| b.1.cmp(&a.1));
        results.truncate(limit);
        results
    }
}
