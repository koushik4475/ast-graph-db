import {
  ASTNode,
  ASTNodeType,
  ExtractedCall,
  ExtractedImport,
  ExtractedInheritance,
  ExtractedSymbol,
  ParseResult,
  SourceLocation,
  SourceSpan,
  SupportedLanguage,
} from './types.js';

export function detectLanguage(filePath: string): SupportedLanguage | null {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.py':
      return 'python';
    case '.rs':
      return 'rust';
    case '.go':
      return 'go';
    case '.java':
      return 'java';
    default:
      return null;
  }
}

/**
 * Universal robust AST extractor for Multi-Language static code analysis.
 * Produces structured AST trees, symbols, import bindings, call edges, and inheritance trees.
 */
export class ASTParser {
  private idCounter = 0;

  private nextId(prefix = 'node'): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}_${Math.random().toString(36).slice(2, 7)}`;
  }

  public parse(filePath: string, code: string, forcedLanguage?: SupportedLanguage): ParseResult {
    const startTime = performance.now();
    const language = forcedLanguage || detectLanguage(filePath) || 'typescript';

    const lines = code.split(/\r?\n/);
    const root: ASTNode = {
      id: this.nextId('root'),
      type: 'Program',
      text: code.slice(0, 100),
      filePath,
      language,
      span: {
        start: { line: 1, column: 1, byteOffset: 0 },
        end: { line: lines.length, column: (lines[lines.length - 1] || '').length + 1, byteOffset: code.length },
      },
      children: [],
    };

    const symbols: ExtractedSymbol[] = [];
    const calls: ExtractedCall[] = [];
    const imports: ExtractedImport[] = [];
    const inheritances: ExtractedInheritance[] = [];

    switch (language) {
      case 'typescript':
      case 'javascript':
        this.parseTypeScript(filePath, code, lines, root, symbols, calls, imports, inheritances);
        break;
      case 'python':
        this.parsePython(filePath, code, lines, root, symbols, calls, imports, inheritances);
        break;
      case 'rust':
        this.parseRust(filePath, code, lines, root, symbols, calls, imports, inheritances);
        break;
      case 'go':
        this.parseGo(filePath, code, lines, root, symbols, calls, imports, inheritances);
        break;
      case 'java':
        this.parseJava(filePath, code, lines, root, symbols, calls, imports, inheritances);
        break;
    }

    const duration = performance.now() - startTime;
    return {
      filePath,
      language,
      root,
      symbols,
      calls,
      imports,
      inheritances,
      parseDurationMs: Math.round(duration * 100) / 100,
    };
  }

  private createSpan(lineNum: number, startCol: number, endCol: number, byteOffset: number): SourceSpan {
    return {
      start: { line: lineNum, column: startCol, byteOffset },
      end: { line: lineNum, column: endCol, byteOffset: byteOffset + (endCol - startCol) },
    };
  }

  private parseTypeScript(
    filePath: string,
    code: string,
    lines: string[],
    root: ASTNode,
    symbols: ExtractedSymbol[],
    calls: ExtractedCall[],
    imports: ExtractedImport[],
    inheritances: ExtractedInheritance[]
  ): void {
    let currentClassId: string | undefined;

    // Extract imports
    const importRegex = /import\s+(?:(?:\*\s+as\s+(\w+)|(\w+)|(?:\{([^}]+)\}))\s+from\s+)?['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split(/\r?\n/).length;
      const [full, namespaceImport, defaultImport, namedImports, moduleSpecifier] = match;
      const importedSymbols: ExtractedImport['importedSymbols'] = [];

      if (namespaceImport) {
        importedSymbols.push({ name: namespaceImport, isNamespace: true });
      }
      if (defaultImport) {
        importedSymbols.push({ name: defaultImport, isDefault: true });
      }
      if (namedImports) {
        namedImports.split(',').forEach((s) => {
          const item = s.trim();
          if (item) {
            const [orig, alias] = item.split(/\s+as\s+/);
            importedSymbols.push({ name: orig.trim(), alias: alias ? alias.trim() : undefined });
          }
        });
      }

      imports.push({
        id: this.nextId('import'),
        sourceFilePath: filePath,
        moduleSpecifier: moduleSpecifier || '',
        importedSymbols,
        span: this.createSpan(lineNum, 1, full.length, match.index),
      });
    }

    // Line-by-line parsing for classes, functions, calls, and interfaces
    let currentByteOffset = 0;
    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      // Class declaration with inheritance
      const classMatch = line.match(/^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?/);
      if (classMatch) {
        const [, className, extendsClass, implementsClasses] = classMatch;
        const symId = this.nextId('sym_class');
        currentClassId = symId;

        symbols.push({
          id: symId,
          name: className,
          kind: 'class',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(className), rawLine.indexOf(className) + className.length, currentByteOffset),
          language: 'typescript',
          modifiers: line.includes('export') ? ['export'] : [],
        });

        if (extendsClass) {
          inheritances.push({
            id: this.nextId('inh'),
            subType: className,
            subTypeId: symId,
            superType: extendsClass.trim(),
            kind: 'extends',
            filePath,
            span: this.createSpan(lineNum, rawLine.indexOf(extendsClass), rawLine.indexOf(extendsClass) + extendsClass.length, currentByteOffset),
          });
        }

        if (implementsClasses) {
          implementsClasses.split(',').forEach((iface) => {
            const trimmed = iface.trim();
            if (trimmed) {
              inheritances.push({
                id: this.nextId('inh'),
                subType: className,
                subTypeId: symId,
                superType: trimmed,
                kind: 'implements',
                filePath,
                span: this.createSpan(lineNum, rawLine.indexOf(trimmed), rawLine.indexOf(trimmed) + trimmed.length, currentByteOffset),
              });
            }
          });
        }
      }

      // Interface declaration
      const ifaceMatch = line.match(/^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([\w\s,]+))?/);
      if (ifaceMatch) {
        const [, ifaceName, extendsIfaces] = ifaceMatch;
        const symId = this.nextId('sym_iface');
        symbols.push({
          id: symId,
          name: ifaceName,
          kind: 'interface',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(ifaceName), rawLine.indexOf(ifaceName) + ifaceName.length, currentByteOffset),
          language: 'typescript',
          modifiers: line.includes('export') ? ['export'] : [],
        });

        if (extendsIfaces) {
          extendsIfaces.split(',').forEach((ext) => {
            const trimmed = ext.trim();
            if (trimmed) {
              inheritances.push({
                id: this.nextId('inh'),
                subType: ifaceName,
                subTypeId: symId,
                superType: trimmed,
                kind: 'extends',
                filePath,
                span: this.createSpan(lineNum, rawLine.indexOf(trimmed), rawLine.indexOf(trimmed) + trimmed.length, currentByteOffset),
              });
            }
          });
        }
      }

      // Function or Method declaration
      const funcMatch = line.match(/^(?:export\s+)?(?:public|private|protected|async|static|\s)*function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^;{]+))?/);
      const methodMatch = line.match(/^(?:public|private|protected|async|static|\s)+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^;{]+))?\s*\{/);

      const targetMatch = funcMatch || methodMatch;
      if (targetMatch) {
        const [, funcName, params, returnType] = targetMatch;
        const isMethod = !funcMatch && Boolean(methodMatch);
        const symId = this.nextId(isMethod ? 'sym_meth' : 'sym_fn');
        
        const paramList = (params || '').split(',').map((p) => {
          const [pName, pType] = p.split(':');
          return { name: (pName || '').trim(), type: pType ? pType.trim() : undefined };
        }).filter((p) => p.name.length > 0);

        symbols.push({
          id: symId,
          name: funcName,
          kind: isMethod ? 'method' : 'function',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(funcName), rawLine.indexOf(funcName) + funcName.length, currentByteOffset),
          language: 'typescript',
          modifiers: [
            ...(line.includes('export') ? ['export' as const] : []),
            ...(line.includes('async') ? ['async' as const] : []),
            ...(line.includes('static') ? ['static' as const] : []),
            ...(line.includes('public') ? ['public' as const] : []),
            ...(line.includes('private') ? ['private' as const] : []),
          ],
          returnType: returnType ? returnType.trim() : undefined,
          parameterTypes: paramList,
        });
      }

      // Call expression extraction
      const callMatches = [...line.matchAll(/(?:([a-zA-Z0-9_$]+)\.)?([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/g)];
      for (const callMatch of callMatches) {
        const callee = callMatch[2];
        // Filter out keyword invocations
        if (!['if', 'for', 'while', 'switch', 'catch', 'function', 'return'].includes(callee)) {
          const args = callMatch[3] ? callMatch[3].split(',').filter((a) => a.trim().length > 0) : [];
          calls.push({
            id: this.nextId('call'),
            calleeName: callee,
            callerSymbolId: currentClassId,
            filePath,
            span: this.createSpan(lineNum, rawLine.indexOf(callee), rawLine.indexOf(callee) + callee.length, currentByteOffset),
            argumentsCount: args.length,
          });
        }
      }

      currentByteOffset += rawLine.length + 1;
    });
  }

  private parsePython(
    filePath: string,
    code: string,
    lines: string[],
    root: ASTNode,
    symbols: ExtractedSymbol[],
    calls: ExtractedCall[],
    imports: ExtractedImport[],
    inheritances: ExtractedInheritance[]
  ): void {
    let currentByteOffset = 0;
    let currentClassId: string | undefined;

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      // Import statements: import foo, from foo import bar
      const fromImportMatch = line.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
      if (fromImportMatch) {
        const [, moduleSpecifier, imported] = fromImportMatch;
        const syms = imported.split(',').map((s) => ({ name: s.trim() }));
        imports.push({
          id: this.nextId('import'),
          sourceFilePath: filePath,
          moduleSpecifier,
          importedSymbols: syms,
          span: this.createSpan(lineNum, 1, line.length, currentByteOffset),
        });
      } else {
        const directImportMatch = line.match(/^import\s+([\w.,\s]+)/);
        if (directImportMatch) {
          const modules = directImportMatch[1].split(',').map((m) => m.trim());
          modules.forEach((mod) => {
            imports.push({
              id: this.nextId('import'),
              sourceFilePath: filePath,
              moduleSpecifier: mod,
              importedSymbols: [{ name: mod, isNamespace: true }],
              span: this.createSpan(lineNum, 1, line.length, currentByteOffset),
            });
          });
        }
      }

      // Class definitions: class Dog(Animal, Walker):
      const classMatch = line.match(/^class\s+(\w+)(?:\(([^)]+)\))?:/);
      if (classMatch) {
        const [, className, baseClasses] = classMatch;
        const symId = this.nextId('sym_py_class');
        currentClassId = symId;

        symbols.push({
          id: symId,
          name: className,
          kind: 'class',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(className), rawLine.indexOf(className) + className.length, currentByteOffset),
          language: 'python',
          modifiers: [],
        });

        if (baseClasses) {
          baseClasses.split(',').forEach((base) => {
            const b = base.trim();
            if (b && b !== 'object') {
              inheritances.push({
                id: this.nextId('inh'),
                subType: className,
                subTypeId: symId,
                superType: b,
                kind: 'extends',
                filePath,
                span: this.createSpan(lineNum, rawLine.indexOf(b), rawLine.indexOf(b) + b.length, currentByteOffset),
              });
            }
          });
        }
      }

      // Function or method: def foo(x: int) -> int:
      const defMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/);
      if (defMatch) {
        const [, funcName, params, returnType] = defMatch;
        const isMethod = rawLine.startsWith('    ') || rawLine.startsWith('\t');
        const symId = this.nextId(isMethod ? 'sym_py_meth' : 'sym_py_fn');

        symbols.push({
          id: symId,
          name: funcName,
          kind: isMethod ? 'method' : 'function',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(funcName), rawLine.indexOf(funcName) + funcName.length, currentByteOffset),
          language: 'python',
          modifiers: line.startsWith('async') ? ['async'] : [],
          returnType: returnType ? returnType.trim() : undefined,
          parameterTypes: (params || '').split(',').map((p) => {
            const [pName, pType] = p.split(':');
            return { name: (pName || '').trim(), type: pType ? pType.trim() : undefined };
          }).filter((p) => p.name.length > 0 && p.name !== 'self' && p.name !== 'cls'),
        });
      }

      // Calls: func(...)
      const callMatches = [...line.matchAll(/(?:([a-zA-Z0-9_]+)\.)?([a-zA-Z0-9_]+)\s*\(([^)]*)\)/g)];
      for (const callMatch of callMatches) {
        const callee = callMatch[2];
        if (!['if', 'elif', 'while', 'for', 'with', 'def', 'class', 'return'].includes(callee)) {
          calls.push({
            id: this.nextId('call'),
            calleeName: callee,
            callerSymbolId: currentClassId,
            filePath,
            span: this.createSpan(lineNum, rawLine.indexOf(callee), rawLine.indexOf(callee) + callee.length, currentByteOffset),
            argumentsCount: callMatch[3] ? callMatch[3].split(',').filter((a) => a.trim().length > 0).length : 0,
          });
        }
      }

      currentByteOffset += rawLine.length + 1;
    });
  }

  private parseRust(
    filePath: string,
    code: string,
    lines: string[],
    root: ASTNode,
    symbols: ExtractedSymbol[],
    calls: ExtractedCall[],
    imports: ExtractedImport[],
    inheritances: ExtractedInheritance[]
  ): void {
    let currentByteOffset = 0;

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      // use std::sync::Arc;
      const useMatch = line.match(/^pub\s+use\s+([^;]+);|^use\s+([^;]+);/);
      if (useMatch) {
        const path = (useMatch[1] || useMatch[2]).trim();
        imports.push({
          id: this.nextId('import'),
          sourceFilePath: filePath,
          moduleSpecifier: path,
          importedSymbols: [{ name: path.split('::').pop() || path }],
          span: this.createSpan(lineNum, 1, line.length, currentByteOffset),
        });
      }

      // struct / trait
      const structMatch = line.match(/^(?:pub(?:\(crate\))?\s+)?struct\s+(\w+)/);
      if (structMatch) {
        symbols.push({
          id: this.nextId('sym_rust_struct'),
          name: structMatch[1],
          kind: 'struct',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(structMatch[1]), rawLine.indexOf(structMatch[1]) + structMatch[1].length, currentByteOffset),
          language: 'rust',
          modifiers: line.includes('pub') ? ['export', 'public'] : [],
        });
      }

      // trait TraitName
      const traitMatch = line.match(/^(?:pub(?:\(crate\))?\s+)?trait\s+(\w+)/);
      if (traitMatch) {
        symbols.push({
          id: this.nextId('sym_rust_trait'),
          name: traitMatch[1],
          kind: 'interface',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(traitMatch[1]), rawLine.indexOf(traitMatch[1]) + traitMatch[1].length, currentByteOffset),
          language: 'rust',
          modifiers: line.includes('pub') ? ['export', 'public'] : [],
        });
      }

      // impl Trait for Struct
      const implTraitMatch = line.match(/^impl(?:\s*<[^>]+>)?\s+(\w+)\s+for\s+(\w+)/);
      if (implTraitMatch) {
        const [, traitName, structName] = implTraitMatch;
        inheritances.push({
          id: this.nextId('inh'),
          subType: structName,
          subTypeId: structName,
          superType: traitName,
          kind: 'implements',
          filePath,
          span: this.createSpan(lineNum, 1, line.length, currentByteOffset),
        });
      }

      // fn function_name
      const fnMatch = line.match(/^(?:pub(?:\(crate\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*->\s*([^;{]+))?/);
      if (fnMatch) {
        const [, fnName, params, returnType] = fnMatch;
        symbols.push({
          id: this.nextId('sym_rust_fn'),
          name: fnName,
          kind: 'function',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(fnName), rawLine.indexOf(fnName) + fnName.length, currentByteOffset),
          language: 'rust',
          modifiers: [
            ...(line.includes('pub') ? ['public' as const, 'export' as const] : []),
            ...(line.includes('async') ? ['async' as const] : []),
          ],
          returnType: returnType ? returnType.trim() : undefined,
          parameterTypes: (params || '').split(',').map((p) => {
            const [pName, pType] = p.split(':');
            return { name: (pName || '').trim(), type: pType ? pType.trim() : undefined };
          }).filter((p) => p.name.length > 0 && p.name !== '&self' && p.name !== '&mut self'),
        });
      }

      // Calls: foo::bar() or obj.method()
      const callMatches = [...line.matchAll(/(?:([a-zA-Z0-9_]+)(?:::|\.))?([a-zA-Z0-9_]+)\s*\(/g)];
      for (const callMatch of callMatches) {
        const callee = callMatch[2];
        if (!['if', 'match', 'while', 'for', 'loop', 'fn', 'let', 'Some', 'Ok', 'Err', 'return'].includes(callee)) {
          calls.push({
            id: this.nextId('call'),
            calleeName: callee,
            filePath,
            span: this.createSpan(lineNum, rawLine.indexOf(callee), rawLine.indexOf(callee) + callee.length, currentByteOffset),
            argumentsCount: 0,
          });
        }
      }

      currentByteOffset += rawLine.length + 1;
    });
  }

  private parseGo(
    filePath: string,
    code: string,
    lines: string[],
    root: ASTNode,
    symbols: ExtractedSymbol[],
    calls: ExtractedCall[],
    imports: ExtractedImport[],
    inheritances: ExtractedInheritance[]
  ): void {
    let currentByteOffset = 0;
    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      // type StructName struct
      const structMatch = line.match(/^type\s+(\w+)\s+struct/);
      if (structMatch) {
        symbols.push({
          id: this.nextId('sym_go_struct'),
          name: structMatch[1],
          kind: 'struct',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(structMatch[1]), rawLine.indexOf(structMatch[1]) + structMatch[1].length, currentByteOffset),
          language: 'go',
          modifiers: structMatch[1][0] === structMatch[1][0].toUpperCase() ? ['export', 'public'] : [],
        });
      }

      // func (r *Receiver) MethodName(...)
      const methodMatch = line.match(/^func\s*\(([^)]+)\)\s*(\w+)\s*\(([^)]*)\)/);
      if (methodMatch) {
        const [, receiver, methodName] = methodMatch;
        symbols.push({
          id: this.nextId('sym_go_meth'),
          name: methodName,
          kind: 'method',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(methodName), rawLine.indexOf(methodName) + methodName.length, currentByteOffset),
          language: 'go',
          modifiers: methodName[0] === methodName[0].toUpperCase() ? ['export', 'public'] : [],
        });
      } else {
        // func FuncName(...)
        const funcMatch = line.match(/^func\s+(\w+)\s*\(([^)]*)\)/);
        if (funcMatch) {
          const [, funcName] = funcMatch;
          symbols.push({
            id: this.nextId('sym_go_fn'),
            name: funcName,
            kind: 'function',
            filePath,
            span: this.createSpan(lineNum, rawLine.indexOf(funcName), rawLine.indexOf(funcName) + funcName.length, currentByteOffset),
            language: 'go',
            modifiers: funcName[0] === funcName[0].toUpperCase() ? ['export', 'public'] : [],
          });
        }
      }

      // Calls: pkg.Func() or fn()
      const callMatches = [...line.matchAll(/([a-zA-Z0-9_]+)\s*\(/g)];
      for (const callMatch of callMatches) {
        const callee = callMatch[1];
        if (!['if', 'for', 'switch', 'func', 'return', 'make', 'len', 'append'].includes(callee)) {
          calls.push({
            id: this.nextId('call'),
            calleeName: callee,
            filePath,
            span: this.createSpan(lineNum, rawLine.indexOf(callee), rawLine.indexOf(callee) + callee.length, currentByteOffset),
            argumentsCount: 0,
          });
        }
      }

      currentByteOffset += rawLine.length + 1;
    });
  }

  private parseJava(
    filePath: string,
    code: string,
    lines: string[],
    root: ASTNode,
    symbols: ExtractedSymbol[],
    calls: ExtractedCall[],
    imports: ExtractedImport[],
    inheritances: ExtractedInheritance[]
  ): void {
    let currentByteOffset = 0;
    let currentClassId: string | undefined;

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      // import com.example.Foo;
      const importMatch = line.match(/^import\s+([\w.]+);/);
      if (importMatch) {
        imports.push({
          id: this.nextId('import'),
          sourceFilePath: filePath,
          moduleSpecifier: importMatch[1],
          importedSymbols: [{ name: importMatch[1].split('.').pop() || importMatch[1] }],
          span: this.createSpan(lineNum, 1, line.length, currentByteOffset),
        });
      }

      // class ClassName extends Super implements Iface
      const classMatch = line.match(/^(?:public\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w\s,]+))?/);
      if (classMatch) {
        const [, className, extendsClass, implementsClasses] = classMatch;
        const symId = this.nextId('sym_java_class');
        currentClassId = symId;

        symbols.push({
          id: symId,
          name: className,
          kind: 'class',
          filePath,
          span: this.createSpan(lineNum, rawLine.indexOf(className), rawLine.indexOf(className) + className.length, currentByteOffset),
          language: 'java',
          modifiers: line.includes('public') ? ['export', 'public'] : [],
        });

        if (extendsClass) {
          inheritances.push({
            id: this.nextId('inh'),
            subType: className,
            subTypeId: symId,
            superType: extendsClass.trim(),
            kind: 'extends',
            filePath,
            span: this.createSpan(lineNum, rawLine.indexOf(extendsClass), rawLine.indexOf(extendsClass) + extendsClass.length, currentByteOffset),
          });
        }

        if (implementsClasses) {
          implementsClasses.split(',').forEach((iface) => {
            const trimmed = iface.trim();
            if (trimmed) {
              inheritances.push({
                id: this.nextId('inh'),
                subType: className,
                subTypeId: symId,
                superType: trimmed,
                kind: 'implements',
                filePath,
                span: this.createSpan(lineNum, rawLine.indexOf(trimmed), rawLine.indexOf(trimmed) + trimmed.length, currentByteOffset),
              });
            }
          });
        }
      }

      currentByteOffset += rawLine.length + 1;
    });
  }
}
