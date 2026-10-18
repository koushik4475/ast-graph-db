import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ASTGraphDB } from '../index.js';
import { ASTParser } from '../parser/index.js';

describe('AST Parser multi-language extraction', () => {
  const parser = new ASTParser();

  it('should parse TypeScript classes, methods, and calls', () => {
    const tsCode = `
      import { BaseService } from './base';

      export class UserService extends BaseService {
        private db: Database;

        public async getUser(id: string): Promise<User> {
          this.logAccess(id);
          return this.db.find(id);
        }
      }
    `;

    const res = parser.parse('src/user.ts', tsCode);
    assert.strictEqual(res.language, 'typescript');
    assert.strictEqual(res.symbols.length >= 2, true);
    
    const userClass = res.symbols.find((s) => s.name === 'UserService');
    assert.ok(userClass);
    assert.strictEqual(userClass?.kind, 'class');

    const method = res.symbols.find((s) => s.name === 'getUser');
    assert.ok(method);
    assert.strictEqual(method?.kind, 'method');

    // Inheritance
    assert.strictEqual(res.inheritances.length, 1);
    assert.strictEqual(res.inheritances[0].superType, 'BaseService');

    // Calls
    assert.ok(res.calls.some((c) => c.calleeName === 'find' || c.calleeName === 'logAccess'));
  });

  it('should parse Python classes, inheritance, and defs', () => {
    const pyCode = `
from models import BaseModel

class Animal(BaseModel):
    def speak(self, sound: str) -> None:
        print(sound)

class Dog(Animal):
    def bark(self):
        self.speak("woof")
    `;

    const res = parser.parse('animal.py', pyCode);
    assert.strictEqual(res.language, 'python');
    assert.ok(res.symbols.some((s) => s.name === 'Animal'));
    assert.ok(res.symbols.some((s) => s.name === 'Dog'));
    assert.ok(res.symbols.some((s) => s.name === 'bark'));

    // Inheritances
    assert.ok(res.inheritances.some((inh) => inh.subType === 'Dog' && inh.superType === 'Animal'));
  });

  it('should parse Rust structs and trait implementations', () => {
    const rsCode = `
pub struct Engine {
    speed: u32,
}

impl Motor for Engine {
    fn drive(&self) {
        start_engine();
    }
}
    `;

    const res = parser.parse('engine.rs', rsCode);
    assert.strictEqual(res.language, 'rust');
    assert.ok(res.symbols.some((s) => s.name === 'Engine' && s.kind === 'struct'));
    assert.ok(res.symbols.some((s) => s.name === 'drive' && s.kind === 'function'));
    assert.ok(res.inheritances.some((i) => i.subType === 'Engine' && i.superType === 'Motor'));
  });
});

describe('Graph Indexer & Cypher Query Engine', () => {
  const db = new ASTGraphDB();

  it('should index code snippets and build connected graph', () => {
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

    const stats = db.getStats();
    assert.ok(stats.nodesCount >= 4);
    assert.ok(stats.callsCount >= 1);
  });

  it('should execute Cypher queries on classes and functions', () => {
    const classes = db.cypher('MATCH (c:Class) RETURN c.name');
    assert.ok(classes.length >= 1);
    assert.strictEqual(classes[0]['c.name'], 'AuthController');

    const filtered = db.cypher('MATCH (f:Function) WHERE f.name = "validateToken" RETURN f.name');
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0]['f.name'], 'validateToken');
  });

  it('should perform semantic search with relevance scoring', () => {
    const results = db.search('validateToken');
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].node.name, 'validateToken');
    assert.ok(results[0].score >= 100);
  });
});
