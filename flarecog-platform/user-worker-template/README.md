# FlareCog User Worker Template - AtomSpace Integration

This user worker template demonstrates **FlareSpace**, the Cloudflare Workers adaptation of OpenCog's AtomSpace for distributed cognitive computing at the edge.

## What is FlareSpace?

**FlareSpace** is FlareCog's implementation of AtomSpace (hypergraph knowledge representation) optimized for Cloudflare's distributed edge infrastructure. It provides:

- **Tenant Isolation**: Each tenant gets their own AtomSpace instance
- **Global Distribution**: Cognitive knowledge replicated across edge nodes
- **Persistent Storage**: Durable Objects with SQLite for reliable persistence
- **AI Enhancement**: Integration with Workers AI for perception and reasoning

## AtomSpace Integration Examples

This template includes 6 comprehensive examples demonstrating how to use AtomSpace as the cognitive foundation for platform applications:

### Example 1: Knowledge Graph Construction
**Endpoint:** `GET /examples/atomspace/knowledge-graph`

Demonstrates building a semantic network of interconnected concepts with inheritance relationships.

```typescript
// Creates: AI → ML → DL hierarchy
artificial_intelligence (parent)
  ↑
machine_learning (child/parent)
  ↑
deep_learning (child)
```

### Example 2: Conversation Context Storage
**Endpoint:** `POST /examples/atomspace/conversation-context`

Shows how to store conversation history and context for multi-turn AI interactions.

```json
{
  "userId": "user123",
  "message": "What is machine learning?",
  "response": "Machine learning is..."
}
```

### Example 3: Semantic Similarity Tracking
**Endpoint:** `GET /examples/atomspace/semantic-similarity`

Demonstrates relationship tracking between semantically similar concepts.

```typescript
// Creates similarity network
cat ↔ dog (0.75 similarity)
  ↓     ↓
   mammal (parent)
```

### Example 4: Attention-Based Prioritization
**Endpoint:** `GET /examples/atomspace/attention-system`

Shows how to use STI/LTI/VLTI attention values to prioritize important concepts.

```typescript
critical_system_alert: STI=200, LTI=100, VLTI=50  // High priority
user_preference:       STI=100, LTI=80,  VLTI=20  // Medium priority
temp_cache_data:       STI=50,  LTI=10,  VLTI=0   // Low priority
```

### Example 5: Multi-Tenant Knowledge Isolation
**Endpoint:** `GET /examples/atomspace/tenant-isolation`

Demonstrates complete isolation between tenant AtomSpace instances.

```typescript
// Tenant 1's knowledge is completely isolated from Tenant 2
tenant1:primary → AtomSpace Instance 1
tenant2:primary → AtomSpace Instance 2
```

### Example 6: Probabilistic Reasoning
**Endpoint:** `GET /examples/atomspace/probabilistic-reasoning`

Shows uncertain knowledge representation with truth values.

```typescript
rain_tomorrow: strength=0.65, confidence=0.7
  → need_umbrella: strength=0.7, confidence=0.65
```

## Architecture

### FlareSpace Components

1. **AtomSpace Durable Object**
   - SQLite-backed persistence
   - Hypergraph structure (nodes + links)
   - Truth values (strength, confidence)
   - Attention values (STI, LTI, VLTI)

2. **User Worker**
   - Tenant-specific routing
   - AtomSpace proxy endpoints
   - Cognitive operations API
   - Example implementations

3. **Platform Integration**
   - Multi-tenant architecture
   - Distributed coordination
   - AI-enhanced reasoning
   - Real-time synchronization

## API Endpoints

### Core AtomSpace Operations

```typescript
// Proxied to tenant-specific AtomSpace
POST   /atomspace/node          // Create concept node
POST   /atomspace/link          // Create relationship link
GET    /atomspace/atom/:id      // Get atom by ID
POST   /atomspace/query         // Query atoms
GET    /atomspace/stats         // Get statistics
```

### Cognitive Operations

```typescript
POST   /cognitive/perceive      // Extract concepts from text
POST   /cognitive/reason        // Trigger reasoning
POST   /cognitive/plan          // Create action plans
POST   /cognitive/learn         // Update knowledge
```

### Example Demonstrations

```typescript
GET    /examples/atomspace/knowledge-graph
POST   /examples/atomspace/conversation-context
GET    /examples/atomspace/semantic-similarity
GET    /examples/atomspace/attention-system
GET    /examples/atomspace/tenant-isolation
GET    /examples/atomspace/probabilistic-reasoning
```

## Usage Example

```typescript
// 1. Get tenant-specific worker URL
const workerUrl = "https://flarecog-user-tenant123.workers.dev";

// 2. Create a concept
const response = await fetch(`${workerUrl}/atomspace/node`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Tenant-ID": "tenant123",
    "X-User-ID": "user456"
  },
  body: JSON.stringify({
    type: "ConceptNode",
    name: "customer_preference",
    truthValue: { strength: 0.9, confidence: 0.85 },
    attentionValue: { sti: 100, lti: 50, vlti: 20 }
  })
});

// 3. Run an example
const example = await fetch(
  `${workerUrl}/examples/atomspace/knowledge-graph`,
  {
    headers: { "X-Tenant-ID": "tenant123" }
  }
);
```

## Development

### Local Setup

```bash
cd flarecog-platform/user-worker-template
npm install
npm run dev
```

### Deploy

```bash
# Deploy for a specific tenant
npm run deploy
```

### Configuration

The worker requires the following bindings (configured in `wrangler.jsonc`):

- `ATOMSPACE`: Durable Object namespace for AtomSpace
- `MIND_AGENT`: Durable Object namespace for MindAgents
- `COGNITIVE_DB`: D1 database for global coordination
- `ATOM_CACHE`: KV namespace for caching
- `AI`: Workers AI binding

## Key Concepts

### Truth Values
Represent uncertain knowledge with two dimensions:
- **Strength**: Probability the statement is true (0.0-1.0)
- **Confidence**: Amount of evidence for the strength (0.0-1.0)

### Attention Values
Guide cognitive resource allocation:
- **STI** (Short-Term Importance): Current focus, decays over time
- **LTI** (Long-Term Importance): Persistent value, accumulated through use
- **VLTI** (Very Long-Term Importance): Core foundational knowledge

### Atom Types

**Nodes** (concepts):
- `ConceptNode`: General concepts ("intelligence", "customer")
- `PredicateNode`: Properties/relations ("is-premium", "prefers")
- `VariableNode`: Pattern matching variables ("$X", "$Y")

**Links** (relationships):
- `InheritanceLink`: IS-A relationships (child → parent)
- `SimilarityLink`: Similarity relations (concept ↔ concept)
- `ImplicationLink`: Logical implications (premise → conclusion)
- `EvaluationLink`: Property evaluations

## Best Practices

### 1. Tenant Isolation
Always use tenant-specific AtomSpace instances:
```typescript
const atomSpaceId = c.env.ATOMSPACE.idFromName(`${tenantId}:primary`);
```

### 2. Attention Management
Set appropriate attention values based on importance:
- Critical data: STI=200, LTI=100, VLTI=50
- User data: STI=100, LTI=50, VLTI=10
- Temporary data: STI=50, LTI=10, VLTI=0

### 3. Truth Value Updates
Update truth values as evidence accumulates:
```typescript
// Initial uncertain knowledge
truthValue: { strength: 0.6, confidence: 0.4 }

// After more evidence
truthValue: { strength: 0.8, confidence: 0.8 }
```

### 4. Query Optimization
Use indexed fields for fast queries:
- `type`: Atom type
- `name`: Node name
- `sti`: Short-term importance

### 5. Structured Knowledge
Build semantic networks with clear hierarchies:
```typescript
// Good: Clear inheritance hierarchy
product → electronics → smartphone → iphone

// Good: Semantic relationships
user → prefers → product
```

## Integration Patterns

### Pattern 1: AI Context Management
Store conversation context in AtomSpace for coherent multi-turn interactions.

### Pattern 2: User Preference Learning
Track user behaviors and preferences as evolving knowledge with attention values.

### Pattern 3: Recommendation Systems
Build knowledge graphs of items and relationships for semantic recommendations.

### Pattern 4: Anomaly Detection
Represent normal patterns as high-truth-value concepts, detect deviations.

### Pattern 5: Multi-Source Knowledge Fusion
Merge knowledge from different sources with probabilistic truth values.

## Resources

- [FlareCog Documentation](https://github.com/o9nn/flarecog)
- [OpenCog AtomSpace](https://wiki.opencog.org/w/AtomSpace)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Workers for Platforms](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/)

## License

MIT License - see main repository [LICENSE](../../LICENSE)
