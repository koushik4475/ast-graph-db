use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SupportedLanguage {
    Rust,
    Python,
    TypeScript,
    JavaScript,
    Go,
    Java,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceLocation {
    pub line: usize,
    pub column: usize,
    pub byte_offset: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SourceSpan {
    pub start: SourceLocation,
    pub end: SourceLocation,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SymbolKind {
    Function,
    Method,
    Class,
    Interface,
    Struct,
    Trait,
    Enum,
    Variable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedSymbol {
    pub id: String,
    pub name: String,
    pub kind: SymbolKind,
    pub file_path: String,
    pub span: SourceSpan,
    pub language: SupportedLanguage,
    pub modifiers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedCall {
    pub id: String,
    pub caller_id: Option<String>,
    pub callee_name: String,
    pub file_path: String,
    pub span: SourceSpan,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedImport {
    pub id: String,
    pub source_file: String,
    pub module_specifier: String,
    pub imported_symbols: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedInheritance {
    pub id: String,
    pub sub_type: String,
    pub super_type: String,
    pub is_implementation: bool,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub file_path: String,
    pub language: SupportedLanguage,
    pub symbols: Vec<ExtractedSymbol>,
    pub calls: Vec<ExtractedCall>,
    pub imports: Vec<ExtractedImport>,
    pub inheritances: Vec<ExtractedInheritance>,
}

pub struct ASTParser {
    counter: usize,
}

impl ASTParser {
    pub fn new() -> Self {
        Self { counter: 0 }
    }

    fn next_id(&mut self, prefix: &str) -> String {
        self.counter += 1;
        format!("{}_{}", prefix, self.counter)
    }

    pub fn detect_language(path: &str) -> Option<SupportedLanguage> {
        if path.ends_with(".rs") {
            Some(SupportedLanguage::Rust)
        } else if path.ends_with(".py") {
            Some(SupportedLanguage::Python)
        } else if path.ends_with(".ts") || path.ends_with(".tsx") {
            Some(SupportedLanguage::TypeScript)
        } else if path.ends_with(".js") || path.ends_with(".jsx") {
            Some(SupportedLanguage::JavaScript)
        } else if path.ends_with(".go") {
            Some(SupportedLanguage::Go)
        } else if path.ends_with(".java") {
            Some(SupportedLanguage::Java)
        } else {
            None
        }
    }

    pub fn parse(&mut self, file_path: &str, content: &str) -> ParseResult {
        let lang = Self::detect_language(file_path).unwrap_or(SupportedLanguage::Rust);
        let mut symbols = Vec::new();
        let mut calls = Vec::new();
        let mut imports = Vec::new();
        let mut inheritances = Vec::new();

        let lines: Vec<&str> = content.lines().collect();

        for (line_idx, raw_line) in lines.iter().enumerate() {
            let line = raw_line.trim();
            let line_num = line_idx + 1;

            match lang {
                SupportedLanguage::Rust => {
                    // struct Name
                    if line.starts_with("pub struct ") || line.starts_with("struct ") {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if let Some(&name) = parts.get(if line.starts_with("pub") { 2 } else { 1 }) {
                            let clean_name = name.trim_end_matches('{').trim();
                            symbols.push(ExtractedSymbol {
                                id: self.next_id("sym_struct"),
                                name: clean_name.to_string(),
                                kind: SymbolKind::Struct,
                                file_path: file_path.to_string(),
                                span: SourceSpan {
                                    start: SourceLocation { line: line_num, column: 1, byte_offset: 0 },
                                    end: SourceLocation { line: line_num, column: line.len(), byte_offset: line.len() },
                                },
                                language: lang,
                                modifiers: if line.starts_with("pub") { vec!["pub".into()] } else { vec![] },
                            });
                        }
                    }
                    // fn name(...)
                    if line.contains("fn ") {
                        let fn_slice = line.split("fn ").nth(1).unwrap_or("");
                        let fn_name = fn_slice.split('(').next().unwrap_or("").trim();
                        if !fn_name.is_empty() {
                            symbols.push(ExtractedSymbol {
                                id: self.next_id("sym_fn"),
                                name: fn_name.to_string(),
                                kind: SymbolKind::Function,
                                file_path: file_path.to_string(),
                                span: SourceSpan {
                                    start: SourceLocation { line: line_num, column: 1, byte_offset: 0 },
                                    end: SourceLocation { line: line_num, column: line.len(), byte_offset: line.len() },
                                },
                                language: lang,
                                modifiers: vec![],
                            });
                        }
                    }
                }
                SupportedLanguage::Python => {
                    if line.starts_with("class ") {
                        let class_slice = line.trim_start_matches("class ").trim_end_matches(':');
                        let class_name = class_slice.split('(').next().unwrap_or("").trim();
                        symbols.push(ExtractedSymbol {
                            id: self.next_id("sym_py_class"),
                            name: class_name.to_string(),
                            kind: SymbolKind::Class,
                            file_path: file_path.to_string(),
                            span: SourceSpan {
                                start: SourceLocation { line: line_num, column: 1, byte_offset: 0 },
                                end: SourceLocation { line: line_num, column: line.len(), byte_offset: line.len() },
                            },
                            language: lang,
                            modifiers: vec![],
                        });
                    }
                    if line.starts_with("def ") {
                        let fn_slice = line.trim_start_matches("def ");
                        let fn_name = fn_slice.split('(').next().unwrap_or("").trim();
                        symbols.push(ExtractedSymbol {
                            id: self.next_id("sym_py_fn"),
                            name: fn_name.to_string(),
                            kind: SymbolKind::Function,
                            file_path: file_path.to_string(),
                            span: SourceSpan {
                                start: SourceLocation { line: line_num, column: 1, byte_offset: 0 },
                                end: SourceLocation { line: line_num, column: line.len(), byte_offset: line.len() },
                            },
                            language: lang,
                            modifiers: vec![],
                        });
                    }
                }
                _ => {}
            }
        }

        ParseResult {
            file_path: file_path.to_string(),
            language: lang,
            symbols,
            calls,
            imports,
            inheritances,
        }
    }
}
