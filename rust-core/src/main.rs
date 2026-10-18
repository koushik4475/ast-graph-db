use ast_graph_db::{ASTParser, CodebaseGraph, GraphNode, NodeKind, QueryEngine};

fn main() {
    println!("⚡ ast-graph-db (Rust Engine) v1.0.0");
    let mut parser = ASTParser::new();
    let sample_code = r#"
        pub struct StorageEngine {
            capacity: u64,
        }

        impl StorageEngine {
            pub fn new() -> Self {
                StorageEngine { capacity: 1024 }
            }
        }
    "#;

    let parsed = parser.parse("engine.rs", sample_code);
    println!("Parsed {} symbols from engine.rs", parsed.symbols.len());

    let mut graph = CodebaseGraph::new();
    for sym in parsed.symbols {
        graph.add_node(GraphNode {
            id: sym.id,
            kind: NodeKind::Struct,
            name: sym.name,
            file_path: sym.file_path,
            language: Some(sym.language),
            in_degree: 0,
            out_degree: 0,
        });
    }

    let query = QueryEngine::new(&graph);
    let results = query.semantic_search("StorageEngine", 5);
    println!("Query results: {} matches", results.len());
}
