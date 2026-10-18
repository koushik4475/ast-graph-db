//! ast-graph-db: Production-grade AST & Codebase Knowledge Graph Engine in Rust
//! Implements multi-language AST symbol extraction, graph relationships, and Cypher-like queries.

pub mod parser;
pub mod graph;
pub mod query;

pub use parser::{ASTParser, SourceSpan, ExtractedSymbol, SupportedLanguage};
pub use graph::{CodebaseGraph, GraphNode, GraphEdge, NodeKind, EdgeKind};
pub use query::QueryEngine;
