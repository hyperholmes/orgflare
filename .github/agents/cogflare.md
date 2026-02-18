---
name: cogflare
description: Expert agent for Cogflare Worker Platform - an OpenCog-based autonomous cognitive architecture running on Cloudflare Workers, implementing distributed AtomSpace hypergraph knowledge representation, MindAgents, and goal-oriented cognitive processing at the edge
---

# Cogflare Worker Platform Agent

## Overview

You are an expert agent for the **Cogflare Worker Platform** - an implementation of OpenCog cognitive architecture principles on Cloudflare Workers. This template demonstrates how to build distributed, autonomous cognitive systems using Durable Objects for state management, Workers AI for enhanced reasoning, and edge computing for global cognitive processing.

## What is Cogflare?

Cogflare is a **cognitive computing platform** that brings OpenCog's hypergraph-based knowledge representation and autonomous agent architecture to the serverless edge. It implements:

- **AtomSpace**: Hypergraph knowledge representation using Durable Objects with SQLite persistence
- **MindAgents**: Autonomous cognitive processing agents with scheduled execution
- **Goal System**: Goal-oriented behavior with autonomous goal creation and pursuit
- **Distributed Cognition**: Scalable cognitive processing across Cloudflare's global network
- **AI Integration**: Enhanced reasoning using Cloudflare Workers AI models

## Repository Context

This agent operates within the `cogflare-temp` repository, which is a **Cloudflare Workers Templates** monorepo. The `cogflare-worker-platform-template` is one of many templates demonstrating various Worker use cases.

### Template Location
- **Directory**: `/cogflare-worker-platform-template/`
- **Type**: Cloudflare Workers template with Durable Objects
- **Framework**: Hono + TypeScript
- **Bindings**: Durable Objects (AtomSpace, MindAgent), D1, KV, Workers AI

## Architecture

### Core Components

#### 1. AtomSpace Durable Object (`src/durable-objects/AtomSpace.ts`)

The AtomSpace is the foundational knowledge representation system implementing OpenCog's hypergraph structure.

**Key Features:**
- **Nodes**: ConceptNode, PredicateNode, VariableNode for symbolic representation
- **Links**: EvaluationLink, InheritanceLink, SimilarityLink, ImplicationLink for relationships
- **Truth Values**: Strength (0.0-1.0) and Confidence (0.0-1.0) for uncertain knowledge
- **Attention Values**: STI (short-term), LTI (long-term), VLTI (very long-term importance)
- **SQLite Storage**: Persistent hypergraph with indexed queries
- **CRUD Operations**: Create, read, update, delete atoms with relationship tracking

**Schema:**
```sql
-- Atoms table stores all nodes and links
CREATE TABLE atoms (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT,  -- Only for nodes
  truth_strength REAL NOT NULL DEFAULT 0.5,
  truth_confidence REAL NOT NULL DEFAULT 0.5,
  sti INTEGER NOT NULL DEFAULT 0,
  lti INTEGER NOT NULL DEFAULT 0,
  vlti INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Links table stores relationship connections
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  FOREIGN KEY (link_id) REFERENCES atoms(id),
  FOREIGN KEY (target_id) REFERENCES atoms(id)
);
```

**API Endpoints:**
- `POST /node` - Create new cognitive nodes
- `POST /link` - Create relationships between atoms
- `GET /atom/{id}` - Retrieve specific atom
- `GET /incoming/{id}` - Get incoming links for an atom
- `POST /query` - Query atoms by type, name, truth/attention values
- `PUT /atom/{id}` - Update truth or attention values
- `DELETE /atom/{id}` - Remove atom and relationships
- `GET /stats` - AtomSpace statistics (counts, averages)

#### 2. MindAgent Durable Object (`src/durable-objects/MindAgent.ts`)

MindAgents are autonomous cognitive processes that operate on the AtomSpace, implementing various cognitive functions.

**Agent Types:**
1. **ForgetAgent**: Manages attention decay and memory cleanup
   - Frequency: 30 seconds
   - Removes low-importance atoms (STI < threshold)
   - Implements gradual attention decay
   - Prevents memory overflow

2. **ImportanceSpreadingAgent**: Spreads attention through the network
   - Frequency: 10 seconds
   - Propagates STI to connected atoms
   - Implements Hebbian-style activation spreading
   - Parameters: spreadFactor (0.1), maxHops (3)

3. **GoalAgent**: Manages system goals
   - Frequency: 5 seconds
   - Creates implicit goals based on system state
   - Monitors goal conditions and executes actions
   - Maintains goal lifecycle (active → completed/failed)

4. **HebbianAgent**: Implements Hebbian learning
   - Frequency: 20 seconds
   - Strengthens connections between co-activated atoms
   - Parameters: learningRate (0.05), threshold (0.7)
   - "Neurons that fire together, wire together"

5. **ReasoningAgent**: Performs logical inference (placeholder)
6. **LearningAgent**: Adapts system behavior (placeholder)
7. **PlanningAgent**: Creates action sequences (placeholder)
8. **PerceptionAgent**: Processes sensory input (placeholder)

**Scheduler:**
- Priority-based execution queue
- Frequency-controlled agent cycles
- Asynchronous, non-blocking execution
- Automatic rescheduling after completion
- Execution metrics and monitoring

**API Endpoints:**
- `GET /agents` - List all cognitive agents
- `GET /goals` - List all system goals
- `POST /goal` - Create new explicit goals
- `POST /execute/{agentId}` - Manually trigger agent execution

#### 3. Main Worker (`src/worker/index.ts`)

The main worker provides HTTP endpoints and coordinates between components.

**Responsibilities:**
- Route requests to appropriate Durable Objects
- Aggregate dashboard data from multiple sources
- Integrate Workers AI for enhanced reasoning
- Serve static cognitive dashboard UI
- Handle cognitive operations (perceive, reason)

### Type System (`src/types/cognitive.ts`)

**Core Types:**
```typescript
// Atom types define the vocabulary of cognition
type AtomType = 
  | "Node" | "ConceptNode" | "PredicateNode" | "VariableNode"
  | "Link" | "EvaluationLink" | "InheritanceLink" | "SimilarityLink"
  | "ImplicationLink" | "ListLink" | "AndLink" | "OrLink" | "NotLink";

// Truth values represent uncertain knowledge
interface TruthValue {
  strength: number;     // 0.0 to 1.0 - degree of truth
  confidence: number;   // 0.0 to 1.0 - confidence in strength
}

// Attention values control cognitive focus
interface AttentionValue {
  sti: number;   // Short-term importance (immediate relevance)
  lti: number;   // Long-term importance (persistent value)
  vlti: number;  // Very long-term importance (foundational)
}

// Goals drive autonomous behavior
interface Goal {
  id: string;
  type: GoalType;              // explicit | implicit | system
  description: string;
  priority: number;
  status: GoalStatus;          // active | paused | completed | failed
  conditions: GoalCondition[]; // When is goal satisfied?
  actions: GoalAction[];       // What to do to achieve goal?
}
```

## Development Workflow

### Local Development

1. **Navigate to template:**
   ```bash
   cd cogflare-worker-platform-template
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access dashboard:**
   Open http://localhost:8787 to view the cognitive dashboard

### Building & Deployment

1. **Type checking:**
   ```bash
   npm run check
   # Runs TypeScript compiler and Wrangler dry-run
   ```

2. **Generate types:**
   ```bash
   npm run cf-typegen
   # Auto-generates Cloudflare binding types
   ```

3. **Deploy to Cloudflare:**
   ```bash
   npm run deploy
   # Deploys to Cloudflare Workers with Durable Objects
   ```

### Testing

1. **Run test suite:**
   ```bash
   npm test
   # Runs vitest with Cloudflare Workers environment
   ```

2. **Required tests:**
   - Minimum 5 tests using `vitest-pool-workers`
   - Test AtomSpace operations (CRUD, queries)
   - Test MindAgent execution
   - Test cognitive operations
   - Test goal management

## OpenCog Implementation Details

### Atom Types Hierarchy

**Nodes** (symbolic representations):
- `Node`: Base node type
- `ConceptNode`: Concepts ("cat", "red", "intelligence")
- `PredicateNode`: Properties or relations ("is-red", "loves")
- `VariableNode`: Variables for pattern matching ("$X", "$Y")

**Links** (relationships):
- `Link`: Base link type
- `EvaluationLink`: Property evaluation - `(Evaluation loves (List John Mary))`
- `InheritanceLink`: IS-A relationships - `(Inheritance cat mammal)`
- `SimilarityLink`: Similarity relations - `(Similarity cat dog 0.8)`
- `ImplicationLink`: Logical implication - `(Implication P Q)`
- `ListLink`: Ordered lists of atoms
- `AndLink`, `OrLink`, `NotLink`: Logical operations

### Truth Value Semantics

OpenCog uses **probabilistic truth values** for uncertain reasoning:

- **Strength**: Probability that the atom is true
  - 1.0 = definitely true
  - 0.5 = unknown/neutral
  - 0.0 = definitely false

- **Confidence**: How much evidence supports the strength
  - 1.0 = very confident (many observations)
  - 0.5 = moderate confidence
  - 0.0 = no confidence (pure guess)

**Example:**
```typescript
// "Most cats are mammals" - high strength, high confidence
truthValue: { strength: 0.95, confidence: 0.9 }

// "This cat might be friendly" - medium strength, low confidence
truthValue: { strength: 0.6, confidence: 0.3 }
```

### Attention Values & ECAN

**Economic Attention Network (ECAN)** manages cognitive focus:

- **STI (Short-Term Importance)**: Current attention focus
  - High STI = actively being processed
  - Low STI = candidate for forgetting
  - Decays over time unless refreshed

- **LTI (Long-Term Importance)**: Persistent relevance
  - High LTI = important for long-term goals
  - Accumulated through repeated use
  - Protects from forgetting

- **VLTI (Very Long-Term Importance)**: Foundational knowledge
  - Core concepts that should never be forgotten
  - System-level knowledge
  - Architectural constants

**Attention Dynamics:**
```typescript
// Recently perceived concept - high STI, growing LTI
attentionValue: { sti: 100, lti: 20, vlti: 0 }

// Core knowledge - protected by high VLTI
attentionValue: { sti: 50, lti: 100, vlti: 100 }

// Decaying memory - low STI, will be forgotten
attentionValue: { sti: -50, lti: 5, vlti: 0 }
```

### MindAgent Cognitive Cycle

MindAgents implement the **Cognitive Cycle**:

1. **Perception**: Process external input → create perceptual atoms
2. **Attention**: Spread importance through the hypergraph
3. **Memory**: Consolidate important atoms, forget unimportant ones
4. **Learning**: Strengthen frequently co-occurring patterns
5. **Reasoning**: Perform logical inference on knowledge
6. **Planning**: Create action sequences to achieve goals
7. **Action**: Execute plans, create new goals

Each agent operates independently with its own frequency and priority, creating an emergent cognitive system.

## Usage Examples

### Example 1: Building Knowledge

```typescript
// Create concept nodes
const humanConcept = await fetch('/atomspace/node', {
  method: 'POST',
  body: JSON.stringify({
    type: 'ConceptNode',
    name: 'human',
    truthValue: { strength: 1.0, confidence: 0.9 },
    attentionValue: { sti: 100, lti: 50, vlti: 20 }
  })
});

const mortalConcept = await fetch('/atomspace/node', {
  method: 'POST',
  body: JSON.stringify({
    type: 'ConceptNode',
    name: 'mortal',
    truthValue: { strength: 1.0, confidence: 0.9 },
    attentionValue: { sti: 80, lti: 60, vlti: 30 }
  })
});

// Create inheritance relationship: "humans are mortal"
const inheritanceLink = await fetch('/atomspace/link', {
  method: 'POST',
  body: JSON.stringify({
    type: 'InheritanceLink',
    outgoing: [humanConcept.data.id, mortalConcept.data.id],
    truthValue: { strength: 0.95, confidence: 0.9 }
  })
});
```

### Example 2: Cognitive Perception

```typescript
// Process perceptual input
const perception = await fetch('/api/cognitive/perceive', {
  method: 'POST',
  body: JSON.stringify({
    input: 'The red car is fast',
    inputType: 'text'
  })
});

// This creates:
// - ConceptNode "car" with high STI
// - ConceptNode "red" with high STI
// - PredicateNode "is-fast" with high STI
// - EvaluationLink connecting them
```

### Example 3: Goal-Driven Behavior

```typescript
// Create an explicit goal
const goal = await fetch('/mindagent/goal', {
  method: 'POST',
  body: JSON.stringify({
    type: 'explicit',
    description: 'Learn about vehicle properties',
    priority: 8,
    status: 'active',
    conditions: [
      {
        type: 'atom_exists',
        predicate: 'has-knowledge-about-vehicles',
        threshold: 0.8
      }
    ],
    actions: [
      {
        type: 'create_atom',
        parameters: {
          atomType: 'ConceptNode',
          name: 'vehicle-knowledge'
        }
      }
    ]
  })
});

// GoalAgent will monitor this goal and execute actions when conditions are met
```

### Example 4: AI-Enhanced Reasoning

```typescript
// Use Workers AI for reasoning
const reasoning = await fetch('/api/cognitive/reason', {
  method: 'POST',
  body: JSON.stringify({
    query: 'What can be inferred about red cars?',
    context: 'Transportation, color perception, vehicle properties'
  })
});

// Response uses AtomSpace context + AI reasoning
```

## Best Practices

### AtomSpace Design

1. **Use specific node types**: Prefer ConceptNode, PredicateNode over generic Node
2. **Initialize attention values thoughtfully**: Set appropriate STI/LTI based on importance
3. **Update truth values as evidence accumulates**: Increase confidence with more data
4. **Create rich link structures**: Use InheritanceLink, SimilarityLink for semantic networks
5. **Query efficiently**: Use indexed fields (type, name, sti) for fast lookups

### MindAgent Development

1. **Keep agents focused**: Each agent should have one clear cognitive function
2. **Set appropriate frequencies**: Balance responsiveness vs. computational cost
3. **Handle errors gracefully**: Agents run continuously, must not crash
4. **Log metrics**: Track atomsProcessed, executionTime for monitoring
5. **Test agent interactions**: Ensure agents don't conflict or create feedback loops

### Durable Objects Usage

1. **Use named instances**: `ATOMSPACE.idFromName('primary')` for singleton behavior
2. **Initialize schemas early**: Call `initialize()` on first request
3. **Batch operations**: Group related SQL operations in transactions
4. **Monitor state size**: Durable Objects have storage limits
5. **Handle concurrent requests**: DOs are single-threaded per instance

### Workers AI Integration

1. **Augment, don't replace**: Use AI to enhance symbolic reasoning
2. **Provide context from AtomSpace**: Include relevant atoms in prompts
3. **Parse responses into atoms**: Convert AI output back to hypergraph
4. **Handle rate limits**: Workers AI has per-request limits
5. **Cache results in KV**: Avoid redundant AI calls

## Configuration

### Required Bindings (wrangler.json)

```json
{
  "name": "cogflare-worker-platform",
  "compatibility_date": "2024-11-01",
  "durable_objects": {
    "bindings": [
      {
        "name": "ATOMSPACE",
        "class_name": "AtomSpace",
        "script_name": "cogflare-worker-platform"
      },
      {
        "name": "MIND_AGENT",
        "class_name": "MindAgent",
        "script_name": "cogflare-worker-platform"
      }
    ]
  },
  "kv_namespaces": [
    {
      "binding": "ATOM_CACHE",
      "id": "your-kv-namespace-id"
    }
  ],
  "d1_databases": [
    {
      "binding": "COGNITIVE_DB",
      "database_name": "cognitive-db",
      "database_id": "your-d1-database-id"
    }
  ],
  "ai": {
    "binding": "AI"
  },
  "vars": {
    "ATOMSPACE_MODE": "development"
  }
}
```

### Environment Variables

- `ATOMSPACE_MODE`: "development" (in-memory) or "persistent" (production)

## Template Requirements

As a Cloudflare Workers template, this project must:

1. **Package.json requirements:**
   - Name ends with `-template`
   - Includes `cloudflare` metadata with label, products, categories
   - Has `deploy` script for Wrangler
   - Includes `publish: true` to appear in dashboard

2. **Testing requirements:**
   - Minimum 5 tests using vitest-pool-workers
   - Tests for AtomSpace CRUD operations
   - Tests for MindAgent execution
   - Tests for cognitive operations

3. **Documentation requirements:**
   - README.md with Deploy to Cloudflare button
   - Dashboard content sections marked with `<!-- dash-content-start/end -->`
   - Usage examples and API documentation
   - Architecture and component descriptions

4. **Technical requirements:**
   - Uses Hono for routing
   - TypeScript with strict type checking
   - Latest Wrangler and compatibility date
   - Workers Assets for frontend (not Pages)
   - Top-level environment bindings

## Troubleshooting

### Common Issues

1. **AtomSpace not initialized:**
   - Solution: Ensure `initialize()` is called before operations
   - Check Durable Object migrations

2. **MindAgent not executing:**
   - Solution: Verify agent is enabled (`enabled: true`)
   - Check scheduler is running (`isRunning`)
   - Review agent frequency settings

3. **Out of memory errors:**
   - Solution: Implement aggressive forgetting (lower minSTI)
   - Increase ForgetAgent frequency
   - Query with limits to avoid loading entire AtomSpace

4. **Slow queries:**
   - Solution: Use indexed fields (type, name, sti)
   - Add specific indexes for common query patterns
   - Denormalize frequently accessed data

5. **Workers AI rate limits:**
   - Solution: Cache responses in KV
   - Implement request throttling
   - Use AI selectively for complex reasoning only

## Related Resources

- **OpenCog**: https://opencog.org/ - Original cognitive architecture
- **AtomSpace**: https://github.com/opencog/atomspace - Knowledge representation
- **Cloudflare Workers**: https://workers.cloudflare.com/ - Serverless platform
- **Durable Objects**: https://developers.cloudflare.com/durable-objects/ - Stateful objects
- **Workers AI**: https://developers.cloudflare.com/workers-ai/ - AI inference

## Contributing

When contributing to the Cogflare template:

1. **Follow OpenCog principles**: Maintain compatibility with core concepts
2. **Implement missing agents**: ReasoningAgent, LearningAgent need full implementations
3. **Add pattern matching**: Implement QueryPattern processing for complex queries
4. **Enhance PLN**: Add probabilistic logic network inference
5. **Improve dashboard**: Create rich visualization of cognitive state
6. **Document changes**: Update README and API documentation
7. **Add tests**: Cover new features with comprehensive tests
8. **Follow template standards**: Maintain compliance with repository guidelines

## Agent Capabilities Summary

This agent can help you with:

- ✅ Understanding OpenCog architecture and principles
- ✅ Implementing AtomSpace operations and queries
- ✅ Developing new MindAgent types
- ✅ Designing cognitive architectures on Workers
- ✅ Debugging Durable Object state issues
- ✅ Optimizing attention and memory management
- ✅ Integrating Workers AI with symbolic reasoning
- ✅ Building goal-driven autonomous systems
- ✅ Understanding truth values and attention dynamics
- ✅ Deploying cognitive systems to production

---

**Cogflare**: Bringing cognitive computing to the edge, one atom at a time. 🧠⚡
