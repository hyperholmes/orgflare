# Cognitive AtomSpace Template

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/o9nn/flarecog/tree/main/templates/cognitive-atomspace-template)

A cognitive computing template featuring **AtomSpace**, the hypergraph knowledge representation system from OpenCog, running on Cloudflare Workers with Durable Objects.

## What is AtomSpace?

**AtomSpace** is a sophisticated knowledge representation system that stores information as a hypergraph:

- **Nodes**: Represent concepts (e.g., "cat", "intelligence", "red")
- **Links**: Represent relationships between nodes (e.g., inheritance, similarity, implication)
- **Truth Values**: Probabilistic strength and confidence for uncertain knowledge
- **Attention Values**: Cognitive focus tracking (short-term, long-term, very-long-term importance)

This template brings AtomSpace to the edge using Cloudflare's distributed infrastructure.

<!-- dash-content-start -->

## Features

### 🔗 Hypergraph Knowledge Representation
Store complex relationships as nodes and links in a flexible hypergraph structure.

### 📊 Probabilistic Truth Values
Every piece of knowledge has a strength (0.0-1.0) and confidence (0.0-1.0) measure.

### 🎯 Attention Value System
Cognitive resources focused on important concepts through STI (short-term), LTI (long-term), and VLTI (very-long-term) importance values.

### ⚡ Edge-Native Architecture
Distributed cognitive processing using Cloudflare Durable Objects with SQLite persistence.

### 🤖 AI-Enhanced Perception
Integrate Workers AI for concept extraction from natural language text.

## Use Cases

- **Knowledge Graphs**: Build semantic networks of interconnected concepts
- **Cognitive Systems**: Implement attention-based reasoning and learning
- **AI Context Management**: Store and query contextual knowledge for AI applications
- **Semantic Search**: Enable relationship-based information retrieval
- **Multi-Agent Systems**: Coordinate knowledge between distributed agents

## API Endpoints

### Create Node
```typescript
POST /atomspace/node
Content-Type: application/json

{
  "type": "ConceptNode",
  "name": "intelligence",
  "truthValue": { "strength": 0.9, "confidence": 0.8 },
  "attentionValue": { "sti": 100, "lti": 50, "vlti": 20 }
}
```

### Create Link
```typescript
POST /atomspace/link
Content-Type: application/json

{
  "type": "InheritanceLink",
  "outgoing": ["atom-id-1", "atom-id-2"],
  "truthValue": { "strength": 0.95, "confidence": 0.9 }
}
```

### Query Atoms
```typescript
POST /atomspace/query
Content-Type: application/json

{
  "type": "ConceptNode",
  "minSTI": 50,
  "minStrength": 0.7,
  "limit": 10
}
```

### Get Statistics
```typescript
GET /atomspace/stats
```

### AI Perception
```typescript
POST /api/perceive
Content-Type: application/json

{
  "text": "Artificial intelligence enables machines to learn and reason"
}
```

<!-- dash-content-end -->

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Cloudflare account

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/o9nn/flarecog.git
cd flarecog/templates/cognitive-atomspace-template
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:8787 in your browser to see the cognitive dashboard.

### Deploy to Cloudflare

```bash
npm run deploy
```

## Example: Building a Knowledge Graph

```typescript
// 1. Create concept nodes
const humanRes = await fetch('/atomspace/node', {
  method: 'POST',
  body: JSON.stringify({
    type: 'ConceptNode',
    name: 'human',
    truthValue: { strength: 1.0, confidence: 0.9 },
    attentionValue: { sti: 100, lti: 50, vlti: 20 }
  })
});
const human = await humanRes.json();

const mortalRes = await fetch('/atomspace/node', {
  method: 'POST',
  body: JSON.stringify({
    type: 'ConceptNode',
    name: 'mortal',
    truthValue: { strength: 1.0, confidence: 0.9 }
  })
});
const mortal = await mortalRes.json();

// 2. Create relationship: "humans are mortal"
await fetch('/atomspace/link', {
  method: 'POST',
  body: JSON.stringify({
    type: 'InheritanceLink',
    outgoing: [human.data.id, mortal.data.id],
    truthValue: { strength: 0.95, confidence: 0.9 }
  })
});

// 3. Query all concepts with high attention
const conceptsRes = await fetch('/atomspace/query', {
  method: 'POST',
  body: JSON.stringify({
    type: 'ConceptNode',
    minSTI: 50
  })
});
const concepts = await conceptsRes.json();
```

## Architecture

### AtomSpace Durable Object
The core cognitive storage using SQLite for persistence:
- `atoms` table: Stores nodes and links with truth/attention values
- `links` table: Tracks link connections and ordering
- Indexed queries for efficient retrieval

### Main Worker
HTTP interface and AI integration:
- Proxies requests to AtomSpace Durable Object
- Handles AI-enhanced perception
- Serves interactive cognitive dashboard

### Atom Types

**Node Types:**
- `ConceptNode`: General concepts (e.g., "cat", "intelligence")
- `PredicateNode`: Properties or relations (e.g., "is-red", "loves")
- `VariableNode`: Variables for pattern matching (e.g., "$X", "$Y")

**Link Types:**
- `InheritanceLink`: IS-A relationships (cat → mammal)
- `SimilarityLink`: Similarity relations (cat ≈ dog)
- `ImplicationLink`: Logical implication (P → Q)
- `EvaluationLink`: Property evaluations (loves(John, Mary))
- `ListLink`: Ordered lists of atoms

## Truth Values

Truth values represent uncertain knowledge:
- **Strength**: Probability that the statement is true (0.0 to 1.0)
- **Confidence**: Amount of evidence supporting the strength (0.0 to 1.0)

Example:
```typescript
// "Most cats are mammals" - high strength, high confidence
truthValue: { strength: 0.95, confidence: 0.9 }

// "This cat might be friendly" - medium strength, low confidence
truthValue: { strength: 0.6, confidence: 0.3 }
```

## Attention Values

Attention values guide cognitive resource allocation:
- **STI** (Short-Term Importance): Current attention focus, decays over time
- **LTI** (Long-Term Importance): Persistent relevance, accumulated through use
- **VLTI** (Very Long-Term Importance): Core foundational knowledge

Example:
```typescript
// Recently perceived concept
attentionValue: { sti: 100, lti: 20, vlti: 0 }

// Core knowledge
attentionValue: { sti: 50, lti: 100, vlti: 100 }
```

## Resources

- [OpenCog AtomSpace](https://wiki.opencog.org/w/AtomSpace) - Original specification
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) - Stateful edge computing
- [Workers AI](https://developers.cloudflare.com/workers-ai/) - AI model integration
- [FlareCog Platform](https://github.com/o9nn/flarecog) - Full cognitive architecture

## License

MIT License - see [LICENSE](../../LICENSE) for details.
