use ast_graph_db::{ASTParser, CodebaseGraph, GraphNode, NodeKind, QueryEngine, SymbolKind};

#[test]
fn test_rust_parser_extraction() {
    let mut parser = ASTParser::new();
    let code = r#"
        pub struct UserRegistry {
            count: usize,
        }

        pub fn register_user(id: u64) -> bool {
            true
        }
    "#;

    let res = parser.parse("registry.rs", code);
    assert_eq!(res.symbols.len(), 2);
    assert!(res.symbols.iter().any(|s| s.name == "UserRegistry" && s.kind == SymbolKind::Struct));
    assert!(res.symbols.iter().any(|s| s.name == "register_user" && s.kind == SymbolKind::Function));
}

#[test]
fn test_graph_and_query() {
    let mut graph = CodebaseGraph::new();
    graph.add_node(GraphNode {
        id: "node_1".into(),
        kind: NodeKind::Struct,
        name: "DatabaseClient".into(),
        file_path: "db.rs".into(),
        language: None,
        in_degree: 0,
        out_degree: 0,
    });

    let q = QueryEngine::new(&graph);
    let results = q.semantic_search("DatabaseClient", 10);
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].0.name, "DatabaseClient");
}
