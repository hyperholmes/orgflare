# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FlareCog** (Flare + Cognition) is a distributed cognitive architecture that implements OpenCog's AGI principles on Cloudflare's global edge network. It brings **ontogenetic entelechy** - the self-actualizing, self-organizing force that drives cognitive systems toward full AGI realization.

### Core Mission

- Create a **distributed hypergraph knowledge system** (AtomSpace) across Cloudflare's edge network
- Enable **autonomous MindAgents** with emergent cognitive capabilities
- Support **symbolic-neural hybrid reasoning** combining OpenCog principles with Workers AI
- Implement **distributed coordination** for multi-node cognitive processing

### Current Development Stage

**Juvenile Stage** (71% Overall Actualization)
- Ontological (Being): 80% - Foundation + Core + Cognitive layers operational
- Teleological (Purpose): 75% - Clear roadmap, active AGI development
- Cognitive (Thinking): 68% - PLN + Pattern Matching + Learning functional
- Integrative (Coherence): 71% - Strong component integration
- Evolutionary (Growth): 58% - Self-improvement framework in place

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers (serverless edge computing)
- **Language**: TypeScript 5.9
- **API Framework**: Hono 4.8
- **Persistent State**: Durable Objects (with SQLite), D1 Database
- **Caching**: Cloudflare KV Namespace
- **AI Integration**: Workers AI
- **Build System**: Turbo 2.5 (monorepo orchestration)
- **Testing**: Vitest 3.2 with @cloudflare/vitest-pool-workers

### Frontend
- **flarecog-admin**: Astro 5 + React 19 + Tailwind CSS
- **flarecog-playground**: Vite + React 18 + Tailwind CSS

### Supporting Tools
- **Package Manager**: pnpm 10
- **CLI**: Custom CLI tool (Commander.js)
- **Python API Client**: flarecog-api
- **E2E Testing**: Playwright 1.53

## Essential Commands

### Development
```bash
pnpm run dev          # Start dev server (wrangler dev)
pnpm run build        # Build TypeScript
pnpm run deploy       # Deploy to Cloudflare Workers
pnpm run check        # Check templates, lockfiles, formatting
pnpm run fix          # Fix all auto-fixable issues
```

### Testing
```bash
pnpm run test         # Run all tests (turbo + vitest)
pnpm run test:cli     # Run CLI tests
pnpm run test:e2e     # Playwright E2E tests (local)
pnpm run test:e2e:live # E2E against live deployments
```

### Template Management
```bash
pnpm run check:templates     # Lint templates for compliance
pnpm run fix:templates       # Fix template issues
pnpm run fix:lockfiles       # Generate npm lockfiles
pnpm run deploy-live-demos   # Deploy live demos
pnpm run upload              # Upload to Cloudflare API
```

## Project Structure

```
/flarecog/
├── flarecog/                    # Main cognitive platform worker
│   ├── src/
│   │   ├── index.ts             # Entry point (Hono router)
│   │   ├── durable-objects/     # Stateful components
│   │   │   ├── AtomSpace.ts     # Hypergraph knowledge store
│   │   │   ├── MindAgent.ts     # Cognitive agents scheduler
│   │   │   └── StorageNode.ts   # Distributed storage
│   │   ├── core/                # Core cognitive systems
│   │   │   ├── distributed/     # Distributed coordination
│   │   │   └── attention/       # Attention allocation
│   │   ├── cognitive/           # Cognitive algorithms
│   │   │   ├── PLNReasoning.ts  # Probabilistic Logic Networks
│   │   │   ├── ECANAttention.ts # Economic Attention Network
│   │   │   ├── HTNPlannerIntegration.ts
│   │   │   ├── SchemeKernel.ts  # Lisp interpreter
│   │   │   ├── PatternMatcher.ts
│   │   │   └── AIEnhancedReasoning.ts
│   │   ├── api/
│   │   │   └── v6-endpoints.ts  # REST API endpoints
│   │   ├── types/
│   │   │   └── cognitive.ts     # TypeScript definitions
│   │   └── tests/               # Unit and integration tests
│   ├── wrangler.json            # Worker configuration
│   └── vitest.config.ts
│
├── flarecog-admin/              # Admin dashboard (Astro)
├── flarecog-platform/           # Multi-tenant platform
│   ├── platform-api/            # Tenant management API
│   ├── dispatch-worker/         # Dispatch routing
│   └── user-worker-template/    # Per-tenant worker template
├── flarecog-playground/         # Interactive playground (Vite)
├── flarecog-api/                # Python client library
├── cli/                         # Template management CLI
├── templates/                   # Cloudflare Workers templates
├── playwright-tests/            # E2E tests
├── docs/                        # Documentation
├── turbo.json                   # Turbo build config
└── pnpm-workspace.yaml          # Workspace config
```

## Core Cognitive Components

### 1. AtomSpace (Durable Object)
Hypergraph knowledge representation - the foundation of FlareCog's cognition.

**Location**: `flarecog/src/durable-objects/AtomSpace.ts`

- **Nodes**: Concepts, predicates, numbers, schemas
- **Links**: Inheritance, similarity, evaluation, execution
- **Truth Values**: Probabilistic knowledge (strength, confidence)
- **Attention Values**: STI/LTI/VLTI (Short/Long/Very-Long-Term Importance)
- **Pattern Matching**: Inverted index for fast pattern queries
- **Persistence**: SQLite in Durable Objects

### 2. MindAgent (Durable Object)
Autonomous cognitive agents that continuously process the AtomSpace.

**Location**: `flarecog/src/durable-objects/MindAgent.ts`

Eight agent types:
- **ForgetAgent**: Memory decay and cleanup
- **HebbianAgent**: Hebbian learning ("fire together, wire together")
- **ImportanceSpreadingAgent**: Spreads attention through knowledge
- **GoalAgent**: Goal management and pursuit
- **ReasoningAgent**: Logical inference
- **LearningAgent**: Adaptive behavior
- **PlanningAgent**: Task decomposition
- **PerceptionAgent**: Concept extraction

### 3. PLN Reasoning Engine
Probabilistic Logic Networks for uncertain inference.

**Location**: `flarecog/src/cognitive/PLNReasoning.ts`

Inference rules: Deduction, Induction, Abduction, Modus Ponens, and more.

### 4. ECAN (Economic Attention Network)
Economic model for attention allocation.

**Location**: `flarecog/src/cognitive/ECANAttention.ts`

- Three-level importance tracking (STI, LTI, VLTI)
- Attention decay (forgetting)
- Importance spreading
- Rent collection mechanism

### 5. HTN Planner
Hierarchical Task Network planning.

**Location**: `flarecog/src/cognitive/HTNPlannerIntegration.ts`

- Task decomposition
- Precondition validation
- Dynamic replanning

### 6. Scheme Kernel
Minimal Lisp interpreter for symbolic reasoning.

**Location**: `flarecog/src/cognitive/SchemeKernel.ts`

- Lambda functions with lexical scoping
- Atom/Scheme bidirectional conversion

### 7. Relevance Realization Engine
Multi-dimensional relevance assessment (v6.0 feature).

**Location**: `flarecog/src/core/RelevanceRealizationEngine.ts`

Dimensions: Goal alignment, contextual fit, novelty, coherence, pragmatic value.

### 8. Distributed Query Engine
Cross-node coordination for distributed AtomSpace.

**Location**: `flarecog/src/core/distributed/EnhancedDistributedQueryEngine.ts`

- Consistent hashing for atom distribution
- Multi-node synchronization

## Cloudflare Bindings

Configured in `flarecog/wrangler.json`:

```json
{
  "durable_objects": {
    "bindings": [
      { "name": "ATOMSPACE", "class_name": "AtomSpace" },
      { "name": "MIND_AGENT", "class_name": "MindAgent" }
    ]
  },
  "d1_databases": [
    { "binding": "COGNITIVE_DB", "database_name": "cogflare-cognitive-db" }
  ],
  "kv_namespaces": [
    { "binding": "ATOM_CACHE" }
  ],
  "ai": { "binding": "AI" }
}
```

## API Endpoints (v6)

**Location**: `flarecog/src/api/v6-endpoints.ts`

### AtomSpace Operations
- `POST /api/v6/atoms` - Create atom
- `GET /api/v6/atoms/:id` - Get atom by ID
- `GET /api/v6/atoms` - List atoms with filters
- `DELETE /api/v6/atoms/:id` - Delete atom
- `POST /api/v6/links` - Create link between atoms

### Cognitive Operations
- `POST /api/v6/pln/infer` - Run PLN inference
- `POST /api/v6/pattern/match` - Pattern matching query
- `POST /api/v6/attention/spread` - Spread attention
- `POST /api/v6/agents/run` - Trigger MindAgent execution

### System Operations
- `GET /api/v6/health` - Health check
- `GET /api/v6/stats` - System statistics

## Development Workflow

### Before Making Changes
```bash
pnpm run check    # Ensure clean state
```

### After Making Changes
```bash
pnpm run fix      # Auto-format and lint
pnpm run test     # Run tests
```

### Cognitive Development Guidelines

1. **AtomSpace Modifications**: Always ensure atoms have valid truth values and attention values
2. **MindAgent Changes**: Agents must be idempotent and handle concurrent execution
3. **PLN Rules**: New inference rules must preserve truth value semantics
4. **Distributed Operations**: Use D1CoordinationLayer for cross-node consistency

### Key Concepts

- **Entelechy**: Self-actualizing force driving AGI realization
- **Ontogenesis**: Self-generating, evolving cognitive systems
- **Truth Values**: Probabilistic knowledge (strength 0-1, confidence 0-1)
- **Attention Values**: Cognitive focus allocation
  - **STI**: Short-Term Importance (working memory)
  - **LTI**: Long-Term Importance (persistent relevance)
  - **VLTI**: Very-Long-Term Importance (never forget)

## Testing

### Test Locations
- `flarecog/src/tests/v6-tests.test.ts` - v6.0 component tests
- `flarecog/src/tests/integration.test.ts` - Integration tests
- `flarecog/src/cognitive/__tests__/` - Cognitive algorithm tests
- `playwright-tests/` - E2E tests

### Running Specific Tests
```bash
cd flarecog && pnpm vitest run src/tests/v6-tests.test.ts
```

## Deployment

### Production Deployment
```bash
pnpm run deploy   # Deploys to flarecog.d-d1f.workers.dev
```

### GitHub Actions
- Auto-deploys on push to main
- Requires secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### Multi-Tenant Platform
For deploying tenant-isolated instances:
```bash
cd flarecog-platform/platform-api && pnpm run deploy
cd flarecog-platform/dispatch-worker && pnpm run deploy
```

## Important Files

- `flarecog/wrangler.json` - Worker and bindings configuration
- `flarecog/src/index.ts` - Main entry point
- `flarecog/src/types/cognitive.ts` - Core type definitions
- `turbo.json` - Build orchestration
- `pnpm-workspace.yaml` - Workspace packages

## Common Tasks

### Adding a New Atom Type
1. Update `flarecog/src/types/cognitive.ts` with new type
2. Add handling in `AtomSpace.ts`
3. Update pattern matcher if needed
4. Add tests

### Adding a New MindAgent
1. Define agent in `flarecog/src/agents/v6-agents.ts`
2. Implement logic in `MindAgent.ts`
3. Register in agent scheduler
4. Add tests

### Adding a New PLN Rule
1. Add rule to `PLNReasoning.ts`
2. Implement truth value formula
3. Add to inference engine
4. Add tests with known truth values

## Architecture Principles

1. **Edge-First**: All computation at the edge for low latency
2. **Stateful via Durable Objects**: AtomSpace persists across requests
3. **Distributed by Design**: Multi-node coordination built-in
4. **Hybrid AI**: Symbolic (PLN) + Neural (Workers AI) reasoning
5. **Self-Organizing**: MindAgents operate autonomously
6. **Observable**: Full metrics and tracing via Cloudflare
