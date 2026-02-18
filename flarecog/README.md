# Cogflare OpenCog Platform Template

An autonomous cognitive architecture based on OpenCog, running on Cloudflare Workers. This template provides distributed AtomSpace hypergraph knowledge representation, intelligent MindAgents, and goal-oriented cognitive processing across the edge.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cogpy/cogflare-temp/tree/main/cogflare-worker-platform-template)

## 🧠 Features

- **AtomSpace**: Hypergraph knowledge representation using Durable Objects
- **MindAgents**: Autonomous cognitive processing agents
- **Goal System**: Goal-oriented behavior and autonomous goal creation
- **AI Integration**: Enhanced reasoning using Cloudflare Workers AI
- **Distributed Architecture**: Scalable across multiple Workers
- **Real-time Dashboard**: Web interface for cognitive system monitoring

## 🚀 Quick Start

### Local Development

1. **Clone and navigate to the template:**

   ```bash
   git clone https://github.com/cogpy/cogflare-temp.git
   cd cogflare-temp/cogflare-worker-platform-template
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start development server:**

   ```bash
   npm run dev
   ```

4. **Visit the cognitive dashboard:**
   Open [http://localhost:8787](http://localhost:8787) in your browser

### Deploy to Cloudflare

1. **Build the project:**

   ```bash
   npm run build
   ```

2. **Deploy:**
   ```bash
   npm run deploy
   ```

## 🏗️ Architecture

### Core Components

#### AtomSpace (Durable Object)

- Hypergraph knowledge representation
- Node and Link types for cognitive elements
- Truth and attention values for atoms
- Persistent storage using SQLite

#### MindAgent (Durable Object)

- Autonomous cognitive processing
- Multiple agent types (ForgetAgent, GoalAgent, etc.)
- Scheduled execution with priority
- Goal creation and management

#### Main Worker

- HTTP API for cognitive operations
- Dashboard data aggregation
- AI-enhanced reasoning endpoints
- Static file serving

### API Endpoints

<!-- dash-content-start -->

## API Reference

### Core Platform

- `GET /` - Cognitive dashboard interface
- `GET /health` - Platform health check
- `GET /api/dashboard` - Comprehensive cognitive statistics

### Cognitive Operations

- `POST /api/cognitive/perceive` - Process input and create perceptual atoms
- `POST /api/cognitive/reason` - AI-enhanced reasoning with context

### AtomSpace Operations

- `GET /atomspace/stats` - AtomSpace statistics
- `POST /atomspace/node` - Create new cognitive nodes
- `POST /atomspace/link` - Create new cognitive links
- `GET /atomspace/atom/{id}` - Retrieve specific atoms
- `POST /atomspace/query` - Query atoms by criteria

### MindAgent Operations

- `GET /mindagent/agents` - List all cognitive agents
- `GET /mindagent/goals` - List all goals
- `POST /mindagent/goal` - Create new goals
- `POST /mindagent/execute/{agentId}` - Execute specific agent

<!-- dash-content-end -->

## 🔧 Configuration

### Environment Variables

Set these in your `wrangler.json` or Cloudflare dashboard:

```json
{
	"vars": {
		"ATOMSPACE_MODE": "development"
	}
}
```

### Required Bindings

The template requires these Cloudflare bindings:

- **Durable Objects**: `ATOMSPACE`, `MIND_AGENT`
- **D1 Database**: `COGNITIVE_DB`
- **KV Namespace**: `ATOM_CACHE`
- **Workers AI**: `AI`

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Test specific functionality:

```bash
# Test AtomSpace operations
npm test -- --grep "AtomSpace"

# Test MindAgent functionality
npm test -- --grep "MindAgent"
```

## 📊 OpenCog Implementation

This template implements key OpenCog components:

### Atom Types

- **Nodes**: ConceptNode, PredicateNode, VariableNode
- **Links**: EvaluationLink, InheritanceLink, ImplicationLink, etc.

### Truth Values

- Strength (0.0 to 1.0) - confidence in the atom's truth
- Confidence (0.0 to 1.0) - confidence in the strength value

### Attention Values

- STI (Short-term importance) - immediate relevance
- LTI (Long-term importance) - persistent importance
- VLTI (Very long-term importance) - foundational importance

### MindAgent Types

- **ForgetAgent**: Manages attention decay and memory cleanup
- **ImportanceSpreadingAgent**: Spreads attention through connected atoms
- **GoalAgent**: Creates and pursues system goals
- **HebbianAgent**: Implements Hebbian learning patterns
- **ReasoningAgent**: Performs logical inference
- **LearningAgent**: Adapts behavior based on experience

## 🎯 Usage Examples

### Creating Cognitive Knowledge

```javascript
// Create a concept node
const concept = await fetch("/atomspace/node", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		type: "ConceptNode",
		name: "human",
		truthValue: { strength: 0.9, confidence: 0.8 },
		attentionValue: { sti: 100, lti: 50, vlti: 10 },
	}),
});

// Process perceptual input
const perception = await fetch("/api/cognitive/perceive", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		input: "I see a red car",
		inputType: "text",
	}),
});

// Perform AI reasoning
const reasoning = await fetch("/api/cognitive/reason", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		query: "What can you infer about red cars?",
		context: "Transportation and color perception",
	}),
});
```

### Goal Management

```javascript
// Create a cognitive goal
const goal = await fetch("/mindagent/goal", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		type: "explicit",
		description: "Learn about vehicle colors",
		priority: 7,
		status: "active",
		conditions: [],
		actions: [],
	}),
});
```

## 🔗 Related Projects

- [OpenCog](https://opencog.org/) - The original OpenCog cognitive architecture
- [AtomSpace](https://github.com/opencog/atomspace) - OpenCog's knowledge representation
- [Cloudflare Workers](https://workers.cloudflare.com/) - Serverless platform
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) - Stateful serverless objects

## 📄 License

This template is part of the Cloudflare Workers Templates collection.

## 🤝 Contributing

Contributions welcome! This template demonstrates:

- OpenCog cognitive architecture concepts
- Distributed system design patterns
- Cloudflare Workers best practices
- Real-time cognitive monitoring

---

**Built with** ❤️ **by the cognitive computing community**
