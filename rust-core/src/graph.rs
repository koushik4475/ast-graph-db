use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use crate::parser::SupportedLanguage;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NodeKind {
    File,
    Module,
    Class,
    Interface,
    Struct,
    Function,
    Method,
    Variable,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EdgeKind {
    Defines,
    Calls,
    Imports,
    Extends,
    Implements,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub kind: NodeKind,
    pub name: String,
    pub file_path: String,
    pub language: Option<SupportedLanguage>,
    pub in_degree: usize,
    pub out_degree: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub id: String,
    pub kind: EdgeKind,
    pub source_id: String,
    pub target_id: String,
    pub weight: f64,
}

pub struct CodebaseGraph {
    pub nodes: HashMap<String, GraphNode>,
    pub edges: HashMap<String, GraphEdge>,
    pub out_edges: HashMap<String, HashSet<String>>,
    pub in_edges: HashMap<String, HashSet<String>>,
    pub name_index: HashMap<String, HashSet<String>>,
}

impl CodebaseGraph {
    pub fn new() -> Self {
        Self {
            nodes: HashMap::new(),
            edges: HashMap::new(),
            out_edges: HashMap::new(),
            in_edges: HashMap::new(),
            name_index: HashMap::new(),
        }
    }

    pub fn add_node(&mut self, mut node: GraphNode) {
        let id = node.id.clone();
        let name = node.name.clone();

        node.in_degree = 0;
        node.out_degree = 0;

        self.nodes.insert(id.clone(), node);
        self.name_index.entry(name).or_default().insert(id.clone());
        self.out_edges.entry(id.clone()).or_default();
        self.in_edges.entry(id).or_default();
    }

    pub fn add_edge(&mut self, edge: GraphEdge) {
        if !self.nodes.contains_key(&edge.source_id) || !self.nodes.contains_key(&edge.target_id) {
            return;
        }

        let edge_id = edge.id.clone();
        let src = edge.source_id.clone();
        let tgt = edge.target_id.clone();

        if let Some(src_node) = self.nodes.get_mut(&src) {
            src_node.out_degree += 1;
        }
        if let Some(tgt_node) = self.nodes.get_mut(&tgt) {
            tgt_node.in_degree += 1;
        }

        self.out_edges.entry(src).or_default().insert(edge_id.clone());
        self.in_edges.entry(tgt).or_default().insert(edge_id.clone());
        self.edges.insert(edge_id, edge);
    }

    pub fn get_nodes_by_name(&self, name: &str) -> Vec<&GraphNode> {
        if let Some(ids) = self.name_index.get(name) {
            ids.iter().filter_map(|id| self.nodes.get(id)).collect()
        } else {
            Vec::new()
        }
    }
}
