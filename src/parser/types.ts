/**
 * Core type definitions for AST nodes, symbols, and code locations.
 */

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java';

export interface SourceLocation {
  line: number;
  column: number;
  byteOffset: number;
}

export interface SourceSpan {
  start: SourceLocation;
  end: SourceLocation;
}

export type ASTNodeType =
  | 'Program'
  | 'SourceFile'
  | 'FunctionDeclaration'
  | 'MethodDeclaration'
  | 'ArrowFunction'
  | 'ClassDeclaration'
  | 'InterfaceDeclaration'
  | 'StructDeclaration'
  | 'EnumDeclaration'
  | 'VariableDeclaration'
  | 'ImportDeclaration'
  | 'ExportDeclaration'
  | 'CallExpression'
  | 'InheritanceClause'
  | 'Parameter'
  | 'Identifier'
  | 'Literal'
  | 'Block';

export interface ASTNode {
  id: string;
  type: ASTNodeType;
  text: string;
  span: SourceSpan;
  filePath: string;
  language: SupportedLanguage;
  children: ASTNode[];
  parent?: ASTNode;
  metadata?: Record<string, unknown>;
}

export interface ExtractedSymbol {
  id: string;
  name: string;
  kind: 'function' | 'method' | 'class' | 'interface' | 'struct' | 'enum' | 'variable' | 'constant';
  filePath: string;
  span: SourceSpan;
  language: SupportedLanguage;
  modifiers: ('public' | 'private' | 'protected' | 'async' | 'static' | 'export')[];
  docstring?: string;
  returnType?: string;
  parameterTypes?: { name: string; type?: string }[];
}

export interface ExtractedCall {
  id: string;
  callerSymbolId?: string;
  calleeName: string;
  calleeSymbolId?: string;
  filePath: string;
  span: SourceSpan;
  argumentsCount: number;
}

export interface ExtractedImport {
  id: string;
  sourceFilePath: string;
  moduleSpecifier: string;
  importedSymbols: { name: string; alias?: string; isDefault?: boolean; isNamespace?: boolean }[];
  resolvedPath?: string;
  span: SourceSpan;
}

export interface ExtractedInheritance {
  id: string;
  subType: string;
  subTypeId: string;
  superType: string;
  superTypeId?: string;
  kind: 'extends' | 'implements';
  filePath: string;
  span: SourceSpan;
}

export interface ParseResult {
  filePath: string;
  language: SupportedLanguage;
  root: ASTNode;
  symbols: ExtractedSymbol[];
  calls: ExtractedCall[];
  imports: ExtractedImport[];
  inheritances: ExtractedInheritance[];
  parseDurationMs: number;
}
