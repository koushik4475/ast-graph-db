<div align="center">

# ⚡ `ast-graph-db`

### *AST-Powered Codebase Knowledge Graph & Static Analysis DB in TypeScript & Rust*

[![CI Build](https://github.com/ER-brocode/ast-graph-db/actions/workflows/ci.yml/badge.svg)](https://github.com/ER-brocode/ast-graph-db/actions)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Languages](https://img.shields.io/badge/Languages-TypeScript%20%7C%20Rust%20%7C%20Python%20%7C%20Go-purple.svg)](#features)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

<p align="center">
  <img src="https://raw.githubusercontent.com/ER-brocode/ast-graph-db/main/assets/banner.svg" alt="AST Graph DB Architecture" width="800"/>
</p>

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           Source Codebase                              │
  │     (TypeScript, Python, Rust, Go, Java, C++, JavaScript)              │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Multi-Language Parser   │
                        │   (Tree-Sitter / Lexer)   │
                        └─────────────┬─────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
      ┌─────────────────────────┐           ┌─────────────────────────┐
      │  Symbol Table Extractor │           │  Hierarchy & Call Graph │
      │  (Defs, Types, Spans)   │           │  (Calls, Inh, Imports)  │
      └────────────┬────────────┘           └────────────┬────────────┘
                   │                                     │
                   └──────────────────┬──────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Codebase Knowledge Graph   │
                      │  (Nodes, Directed Edges, PR)  │
                      └───────────────┬───────────────┘
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
      ┌─────────────────────────┐           ┌─────────────────────────┐
      │   Cypher Query Engine   │           │   Semantic Ranker       │
      │  MATCH (c:Class)-[r]->  │           │  PageRank & Fuzzy Walk  │
      └─────────────────────────┘           └─────────────────────────┘
```

</div>

---

## 🌟 Highlights

- 🌲 **Multi-Language AST Ingestion**: Zero-config static parsing for **TypeScript**, **Python**, **Rust**, **Go**, and **Java**.
- 🕸️ **Unified Code Knowledge Graph**: Tracks definitions (`DEFINES`), call graphs (`CALLS`), type hierarchies (`EXTENDS`/`IMPLEMENTS`), and module boundaries (`IMPORTS`).
- ⚡ **Declarative Cypher-Like Query Engine**: Query complex architectural relationships using declarative pattern matching.
- 🎯 **Semantic Search & PageRank Centrality**: Automatically detects core architectural hubs and ranks relevant code entities with graph-boosted scoring.
- 🚀 **Dual Engine (TypeScript + Rust)**: High-level extensible Node.js CLI & APIs with blazing-fast low-level Rust graph kernels.

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/ER-brocode/ast-graph-db.git
cd ast-graph-db

# Install dependencies and build
npm install
npm run build
```

### 2. CLI Usage

#### Index a directory
```bash
npx ast-graph-db index ./src
```

#### Declarative Cypher Queries
```bash
# Find all classes that inherit from another entity
npx ast-graph-db query ./src 'MATCH (c:Class)-[:EXTENDS]->(b:Class) RETURN c.name, b.name'

# Find callers of a specific function
npx ast-graph-db query ./src 'MATCH (f:Function)-[:CALLS]->(t:Function) WHERE t.name = "validateToken" RETURN f.name'
```

#### Semantic Search
```bash
npx ast-graph-db search ./src "AuthController"
```

---

## 💻 Programmatic API (TypeScript)

```typescript
import { ASTGraphDB } from 'ast-graph-db';

const db = new ASTGraphDB();

// 1. Ingest files or entire project directories
db.indexCode('src/auth.ts', `
  export class AuthController {
    public login(req: Request) {
      validateToken(req);
    }
  }
`);

db.indexCode('src/token.ts', `
  export function validateToken(req: Request) {
    return true;
  }
`);

// 2. Query the Knowledge Graph
const results = db.cypher('MATCH (c:Class) RETURN c.name');
console.log(results);
// [{ "c.name": "AuthController" }]

// 3. Centrality and Semantic Search
const searchMatches = db.search('validateToken');
console.log(searchMatches[0]);
```

---

## 🦀 Rust Core Engine

The high-performance Rust core is located in `rust-core/` and can be compiled using Cargo:

```bash
# Run Rust tests
cargo test

# Execute Rust engine binary
cargo run
```

---

## 🧪 Running Automated Tests

```bash
# Run full TypeScript test suite
npm test

# Run Rust unit and integration tests
cargo test
```

---

## 👥 Authors & Maintainers

- **koushik4475** ([koushik4475@gmail.com](mailto:koushik4475@gmail.com))
- **ER-brocode Community**

---

## 📄 License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
