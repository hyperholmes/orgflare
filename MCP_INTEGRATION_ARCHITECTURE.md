# MCP Integration Architecture for FlareCog

**Author:** Manus AI  
**Date:** November 24, 2025  
**Purpose:** Design document for integrating Model Context Protocol (MCP) servers with FlareCog cognitive architecture

---

## Overview

Model Context Protocol (MCP) enables FlareCog to access external knowledge bases, AI services, and data sources through a standardized interface. This document outlines how to integrate the available MCP servers (CloudFlare, Prisma Postgres, Sentry, Neon, Notion, Hugging Face) with OpenCog cognitive components.

---

## Available MCP Servers

| MCP Server | Purpose | OpenCog Use Case |
|------------|---------|------------------|
| **cloudflare** | CloudFlare Workers Bindings (D1, R2, KV) | AtomSpace storage backend |
| **prisma-postgres** | Prisma Postgres database management | Distributed AtomSpace coordination |
| **sentry** | Error monitoring and issue tracking | Cognitive system debugging |
| **neon** | Neon serverless Postgres | AtomSpace-PostgreSQL backend |
| **notion** | Document and knowledge base management | Knowledge ingestion, documentation |
| **hugging-face** | AI models and datasets | NLP, embeddings, Link Grammar |

---

## Integration Patterns

### 1. CloudFlare MCP → AtomSpace Storage Backend

**Use Case:** Use CloudFlare D1, R2, and KV as AtomSpace storage tiers

**Implementation:**

```typescript
export class MCPStorageBackend {
  async storeAtom(atom: Atom, tier: 'hot' | 'warm' | 'cold'): Promise<void> {
    switch (tier) {
      case 'hot':
        // Use KV for high-STI atoms (fast access)
        await this.callMCP('cloudflare', 'kv_put', {
          namespace: 'atomspace-hot',
          key: atom.id,
          value: JSON.stringify(atom),
          expiration_ttl: 3600,  // 1 hour
        });
        break;
      
      case 'warm':
        // Use D1 for medium-STI atoms (queryable)
        await this.callMCP('cloudflare', 'd1_execute', {
          database: 'atomspace-warm',
          query: 'INSERT INTO atoms (id, type, name, outgoing, tv) VALUES (?, ?, ?, ?, ?)',
          params: [atom.id, atom.type, atom.name, JSON.stringify(atom.outgoing), JSON.stringify(atom.truthValue)],
        });
        break;
      
      case 'cold':
        // Use R2 for low-STI atoms (archived)
        await this.callMCP('cloudflare', 'r2_put', {
          bucket: 'atomspace-cold',
          key: `atoms/${atom.id}.json`,
          value: JSON.stringify(atom),
        });
        break;
    }
  }
  
  async retrieveAtom(atomId: string): Promise<Atom | null> {
    // Try hot tier first
    const hotResult = await this.callMCP('cloudflare', 'kv_get', {
      namespace: 'atomspace-hot',
      key: atomId,
    });
    
    if (hotResult) return JSON.parse(hotResult);
    
    // Try warm tier
    const warmResult = await this.callMCP('cloudflare', 'd1_execute', {
      database: 'atomspace-warm',
      query: 'SELECT * FROM atoms WHERE id = ?',
      params: [atomId],
    });
    
    if (warmResult.results.length > 0) {
      const atom = this.rowToAtom(warmResult.results[0]);
      // Promote to hot tier
      await this.storeAtom(atom, 'hot');
      return atom;
    }
    
    // Try cold tier
    const coldResult = await this.callMCP('cloudflare', 'r2_get', {
      bucket: 'atomspace-cold',
      key: `atoms/${atomId}.json`,
    });
    
    if (coldResult) {
      const atom = JSON.parse(coldResult);
      // Promote to warm tier
      await this.storeAtom(atom, 'warm');
      return atom;
    }
    
    return null;
  }
}
```

---

### 2. Neon/Prisma Postgres MCP → AtomSpace-PostgreSQL

**Use Case:** Use serverless Postgres as distributed AtomSpace backend (AtomSpace-PostgreSQL equivalent)

**Implementation:**

```typescript
export class PostgresAtomSpace {
  async initializeSchema(): Promise<void> {
    // Create AtomSpace schema using Neon MCP
    await this.callMCP('neon', 'execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS atoms (
          id BIGSERIAL PRIMARY KEY,
          type VARCHAR(64) NOT NULL,
          name TEXT,
          outgoing BIGINT[],
          tv_strength REAL DEFAULT 0.5,
          tv_confidence REAL DEFAULT 0.5,
          sti SMALLINT DEFAULT 0,
          lti SMALLINT DEFAULT 0,
          vlti BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX idx_atoms_type ON atoms(type);
        CREATE INDEX idx_atoms_name ON atoms(name);
        CREATE INDEX idx_atoms_sti ON atoms(sti DESC);
        CREATE INDEX idx_atoms_outgoing ON atoms USING GIN(outgoing);
      `,
    });
  }
  
  async addAtom(atom: Atom): Promise<number> {
    const result = await this.callMCP('neon', 'execute_sql', {
      query: `
        INSERT INTO atoms (type, name, outgoing, tv_strength, tv_confidence, sti, lti)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (type, name, outgoing) DO UPDATE
        SET tv_strength = EXCLUDED.tv_strength,
            tv_confidence = EXCLUDED.tv_confidence,
            sti = EXCLUDED.sti,
            lti = EXCLUDED.lti,
            updated_at = NOW()
        RETURNING id
      `,
      params: [
        atom.type,
        atom.name,
        atom.outgoing || [],
        atom.truthValue.strength,
        atom.truthValue.confidence,
        atom.attentionValue?.sti || 0,
        atom.attentionValue?.lti || 0,
      ],
    });
    
    return result.rows[0].id;
  }
  
  async patternMatch(pattern: Pattern): Promise<Atom[]> {
    // Use Postgres for complex pattern matching
    const query = this.patternToSQL(pattern);
    const result = await this.callMCP('neon', 'execute_sql', { query });
    
    return result.rows.map(row => this.rowToAtom(row));
  }
  
  patternToSQL(pattern: Pattern): string {
    // Convert OpenCog pattern to SQL query
    // Example: (InheritanceLink (VariableNode $X) (ConceptNode "Animal"))
    // Becomes: SELECT * FROM atoms WHERE type = 'InheritanceLink' AND outgoing[2] = (SELECT id FROM atoms WHERE type = 'ConceptNode' AND name = 'Animal')
    
    if (pattern.type === 'VariableNode') {
      return 'SELECT * FROM atoms';  // Match any atom
    }
    
    let sql = `SELECT * FROM atoms WHERE type = '${pattern.type}'`;
    
    if (pattern.name) {
      sql += ` AND name = '${pattern.name}'`;
    }
    
    if (pattern.outgoing && pattern.outgoing.length > 0) {
      const outgoingConditions = pattern.outgoing.map((p, i) => {
        if (p.type === 'VariableNode') {
          return '';  // No constraint for variables
        }
        const subquery = this.patternToSQL(p);
        return `outgoing[${i + 1}] = (${subquery})`;
      }).filter(c => c !== '');
      
      if (outgoingConditions.length > 0) {
        sql += ` AND ${outgoingConditions.join(' AND ')}`;
      }
    }
    
    return sql;
  }
}
```

---

### 3. Notion MCP → Knowledge Ingestion

**Use Case:** Import knowledge from Notion databases into AtomSpace

**Implementation:**

```typescript
export class NotionKnowledgeIngestion {
  async ingestNotionDatabase(databaseId: string): Promise<void> {
    // Query Notion database
    const pages = await this.callMCP('notion', 'query_database', {
      database_id: databaseId,
    });
    
    for (const page of pages.results) {
      // Extract page content
      const content = await this.callMCP('notion', 'get_page_content', {
        page_id: page.id,
      });
      
      // Convert to atoms
      const atoms = await this.notionPageToAtoms(page, content);
      
      // Add to AtomSpace
      for (const atom of atoms) {
        await this.addAtom(atom);
      }
    }
  }
  
  async notionPageToAtoms(page: NotionPage, content: string): Promise<Atom[]> {
    const atoms: Atom[] = [];
    
    // Create concept node for the page
    atoms.push({
      type: 'ConceptNode',
      name: page.properties.Name.title[0].plain_text,
      truthValue: { strength: 1.0, confidence: 0.9 },
    });
    
    // Extract entities using NLP
    const entities = await this.extractEntities(content);
    
    for (const entity of entities) {
      atoms.push({
        type: 'ConceptNode',
        name: entity.text,
        truthValue: { strength: entity.confidence, confidence: 0.8 },
      });
      
      // Create relationship
      atoms.push({
        type: 'EvaluationLink',
        outgoing: [
          { type: 'PredicateNode', name: 'mentioned-in' },
          {
            type: 'ListLink',
            outgoing: [
              { type: 'ConceptNode', name: entity.text },
              { type: 'ConceptNode', name: page.properties.Name.title[0].plain_text },
            ],
          },
        ],
        truthValue: { strength: 1.0, confidence: 0.9 },
      });
    }
    
    return atoms;
  }
}
```

---

### 4. Hugging Face MCP → NLP & Embeddings

**Use Case:** Use Hugging Face models for Link Grammar parsing, embeddings, and NLP tasks

**Implementation:**

```typescript
export class HuggingFaceNLP {
  async parseSentence(sentence: string): Promise<Atom[]> {
    // Use Link Grammar via Hugging Face
    const result = await this.callMCP('hugging-face', 'text_generation', {
      model: 'link-grammar/english-parser',
      input: sentence,
      parameters: {
        task: 'dependency-parsing',
        return_linkages: true,
      },
    });
    
    return this.linkageToAtoms(result.linkages[0]);
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    // Use Hugging Face embeddings
    const result = await this.callMCP('hugging-face', 'feature_extraction', {
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      input: text,
    });
    
    return result[0];  // 384-dimensional embedding
  }
  
  async semanticSimilarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.generateEmbedding(text1),
      this.generateEmbedding(text2),
    ]);
    
    // Cosine similarity
    return this.cosineSimilarity(emb1, emb2);
  }
  
  async extractEntities(text: string): Promise<Entity[]> {
    const result = await this.callMCP('hugging-face', 'token_classification', {
      model: 'dslim/bert-base-NER',
      input: text,
    });
    
    return result.map(entity => ({
      text: entity.word,
      type: entity.entity_group,
      confidence: entity.score,
    }));
  }
}
```

---

### 5. Sentry MCP → Cognitive System Debugging

**Use Case:** Monitor cognitive system errors and performance issues

**Implementation:**

```typescript
export class CognitiveMonitoring {
  async trackInferenceError(error: Error, context: InferenceContext): Promise<void> {
    // Report to Sentry via MCP
    await this.callMCP('sentry', 'create_issue', {
      title: `Inference Error: ${error.message}`,
      description: `
        Error during cognitive inference:
        
        **Error:** ${error.message}
        **Stack:** ${error.stack}
        
        **Context:**
        - AtomSpace ID: ${context.atomSpaceId}
        - Pattern: ${JSON.stringify(context.pattern)}
        - Bindings: ${JSON.stringify(context.bindings)}
        - Timestamp: ${new Date().toISOString()}
      `,
      tags: {
        component: 'inference',
        atomspace_id: context.atomSpaceId,
        pattern_type: context.pattern.type,
      },
    });
  }
  
  async trackPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    await this.callMCP('sentry', 'create_transaction', {
      name: metric.operation,
      duration: metric.duration,
      tags: {
        atomspace_id: metric.atomSpaceId,
        operation_type: metric.type,
      },
    });
  }
}
```

---

## Unified MCP Integration Layer

```typescript
export class MCPIntegrationLayer {
  private mcpServers: Map<string, MCPServer>;
  
  constructor() {
    this.mcpServers = new Map([
      ['cloudflare', new CloudFlareMCPServer()],
      ['neon', new NeonMCPServer()],
      ['prisma-postgres', new PrismaMCPServer()],
      ['notion', new NotionMCPServer()],
      ['hugging-face', new HuggingFaceMCPServer()],
      ['sentry', new SentryMCPServer()],
    ]);
  }
  
  async callMCP(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const server = this.mcpServers.get(serverName);
    if (!server) {
      throw new Error(`MCP server not found: ${serverName}`);
    }
    
    // Call via manus-mcp-cli
    const result = await this.shell.exec(
      `manus-mcp-cli tool call ${toolName} --server ${serverName} --input '${JSON.stringify(args)}'`
    );
    
    return JSON.parse(result.stdout);
  }
  
  async batchCallMCP(calls: MCPCall[]): Promise<unknown[]> {
    // Execute multiple MCP calls in parallel
    return Promise.all(
      calls.map(call => this.callMCP(call.server, call.tool, call.args))
    );
  }
}
```

---

## Production Workflow Example: Knowledge Graph Construction

**Scenario:** Build a knowledge graph from Notion documents, enrich with Hugging Face NLP, store in Neon Postgres, and monitor with Sentry

```typescript
export class KnowledgeGraphBuilder extends WorkflowEntrypoint {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    const { notionDatabaseId } = event.payload;
    
    try {
      // Step 1: Fetch Notion pages
      const pages = await step.do('fetch notion pages', async () => {
        return await this.mcp.callMCP('notion', 'query_database', {
          database_id: notionDatabaseId,
        });
      });
      
      // Step 2: Extract entities from each page
      const entities = await step.do('extract entities', async () => {
        const allEntities = [];
        for (const page of pages.results) {
          const content = await this.mcp.callMCP('notion', 'get_page_content', {
            page_id: page.id,
          });
          
          const pageEntities = await this.mcp.callMCP('hugging-face', 'token_classification', {
            model: 'dslim/bert-base-NER',
            input: content,
          });
          
          allEntities.push(...pageEntities);
        }
        return allEntities;
      });
      
      // Step 3: Create atoms and store in Neon Postgres
      await step.do('store atoms', async () => {
        for (const entity of entities) {
          await this.mcp.callMCP('neon', 'execute_sql', {
            query: `
              INSERT INTO atoms (type, name, tv_strength, tv_confidence)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (type, name) DO UPDATE
              SET tv_confidence = GREATEST(atoms.tv_confidence, EXCLUDED.tv_confidence)
            `,
            params: ['ConceptNode', entity.word, entity.score, 0.9],
          });
        }
      });
      
      // Step 4: Generate embeddings and store in Vectorize
      await step.do('generate embeddings', async () => {
        for (const entity of entities) {
          const embedding = await this.mcp.callMCP('hugging-face', 'feature_extraction', {
            model: 'sentence-transformers/all-MiniLM-L6-v2',
            input: entity.word,
          });
          
          await this.vectorize.insert({
            id: entity.word,
            values: embedding[0],
            metadata: { type: entity.entity_group, confidence: entity.score },
          });
        }
      });
      
      return { success: true, entityCount: entities.length };
      
    } catch (error) {
      // Report error to Sentry
      await this.mcp.callMCP('sentry', 'create_issue', {
        title: `Knowledge Graph Build Failed`,
        description: error.message,
        tags: { workflow: 'knowledge-graph-builder' },
      });
      
      throw error;
    }
  }
}
```

---

## MCP Server Configuration

**wrangler.toml additions:**

```toml
# Environment variables for MCP integration
[env.production.vars]
ENABLE_MCP_INTEGRATION = "true"
MCP_TIMEOUT_MS = "30000"

# MCP server endpoints (if using custom deployments)
NOTION_MCP_URL = "https://mcp-notion.example.com"
HUGGINGFACE_MCP_URL = "https://mcp-huggingface.example.com"
```

**Secrets (set via wrangler secret put):**

```bash
# Notion integration
wrangler secret put NOTION_API_KEY

# Hugging Face API
wrangler secret put HUGGINGFACE_API_TOKEN

# Sentry DSN
wrangler secret put SENTRY_DSN

# Neon/Prisma Postgres
wrangler secret put NEON_DATABASE_URL
```

---

## Performance Considerations

| MCP Operation | Latency | Cost | Caching Strategy |
|---------------|---------|------|------------------|
| **CloudFlare KV** | 1-5ms | $0.50/million | Cache hot atoms in DO memory |
| **Neon SQL Query** | 10-50ms | $0.16/compute-hour | Cache frequent patterns in KV |
| **Notion API** | 100-500ms | Free (rate limited) | Cache pages in R2, refresh daily |
| **Hugging Face** | 50-200ms | $0.06/1000 requests | Cache embeddings in Vectorize |
| **Sentry** | 20-100ms | Free (10k events/month) | Batch errors, send async |

---

## Conclusion

MCP integration enables FlareCog to leverage external services while maintaining a unified cognitive architecture. The key patterns are:

1. **Storage Tiering:** CloudFlare MCP for hot/warm/cold storage tiers
2. **Distributed Backend:** Neon/Prisma Postgres for AtomSpace-PostgreSQL equivalent
3. **Knowledge Ingestion:** Notion MCP for importing structured knowledge
4. **NLP Pipeline:** Hugging Face MCP for parsing, embeddings, and entity extraction
5. **Observability:** Sentry MCP for error tracking and performance monitoring

**Next Steps:**

1. Implement MCPIntegrationLayer class in FlareCog
2. Deploy knowledge graph builder workflow
3. Set up MCP server authentication and secrets
4. Benchmark MCP call latencies and optimize caching
5. Create MCP fallback strategies for offline operation
