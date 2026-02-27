# Cognitive Synergy & AGI Awareness API Documentation

## Overview

FlareCog v6.0 introduces **Cognitive Synergy** and **AGI Awareness** capabilities that enable emergent intelligence through the interaction of multiple cognitive processes. These features implement Ben Goertzel's concept that AGI emerges from the synergistic combination of different cognitive components working together.

## Table of Contents

- [Cognitive Synergy API](#cognitive-synergy-api)
  - [Run Synergy Cycle](#run-synergy-cycle)
  - [Get Synergy Status](#get-synergy-status)
  - [Emergency Synergy](#emergency-synergy)
- [AGI Awareness API](#agi-awareness-api)
  - [Iterate Awareness](#iterate-awareness)
  - [Get Awareness State](#get-awareness-state)
  - [Trigger Reflection](#trigger-reflection)
  - [Get Awareness Metrics](#get-awareness-metrics)

---

## Cognitive Synergy API

### Run Synergy Cycle

Execute a complete cognitive synergy cycle that orchestrates interactions between cognitive components (PLN, Pattern Mining, Attention, Learning, etc.) to achieve emergent intelligence.

**Endpoint:** `POST /api/v6/synergy/cycle`

**Request Body:**

```json
{
  "instanceId": "primary",
  "activeComponents": ["pln", "pattern", "attention", "learning"]
}
```

**Parameters:**

- `instanceId` (string, optional): Instance identifier. Default: `"primary"`
- `activeComponents` (array, optional): List of cognitive components to activate. Options: `"pln"`, `"pattern"`, `"attention"`, `"learning"`, `"perception"`, `"action"`, `"memory"`, `"language"`. Default: `["pln", "pattern", "attention", "learning"]`

**Response:**

```json
{
  "success": true,
  "result": {
    "cycleId": "550e8400-e29b-41d4-a716-446655440000",
    "duration": 1250,
    "interactionCount": 12,
    "insightCount": 3,
    "insights": [
      {
        "id": "insight-1",
        "type": "pattern",
        "content": { "pattern": "frequent-concept-association" },
        "confidence": 0.85,
        "contributingComponents": ["pattern", "attention"],
        "timestamp": 1709064000000
      }
    ],
    "componentStates": {
      "attention": {
        "focusAtoms": ["atom-1", "atom-2"],
        "totalSTI": 170
      },
      "pattern": {
        "discovered": [
          { "pattern": "test-pattern", "confidence": 0.9 }
        ]
      }
    }
  }
}
```

**Example:**

```bash
curl -X POST https://flarecog.d-d1f.workers.dev/api/v6/synergy/cycle \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-agi",
    "activeComponents": ["pln", "pattern", "attention", "learning", "perception"]
  }'
```

---

### Get Synergy Status

Retrieve the current status of the cognitive synergy system, including component statuses and latest cycle information.

**Endpoint:** `GET /api/v6/synergy/status?instanceId=primary`

**Query Parameters:**

- `instanceId` (string, optional): Instance identifier. Default: `"primary"`

**Response:**

```json
{
  "success": true,
  "status": {
    "latestCycleId": "550e8400-e29b-41d4-a716-446655440000",
    "componentStatuses": [
      {
        "component": "pln",
        "active": true,
        "load": 45.2,
        "lastActivity": 1709064000000,
        "pendingRequests": 3
      },
      {
        "component": "pattern",
        "active": true,
        "load": 32.8,
        "lastActivity": 1709063950000,
        "pendingRequests": 1
      }
    ],
    "totalCycles": 42
  }
}
```

**Example:**

```bash
curl https://flarecog.d-d1f.workers.dev/api/v6/synergy/status?instanceId=my-agi
```

---

### Emergency Synergy

Trigger an emergency synergy cycle that activates all available cognitive components at maximum priority for critical situations requiring immediate comprehensive processing.

**Endpoint:** `POST /api/v6/synergy/emergency`

**Request Body:**

```json
{
  "instanceId": "primary",
  "trigger": "critical-anomaly-detected"
}
```

**Parameters:**

- `instanceId` (string, optional): Instance identifier. Default: `"primary"`
- `trigger` (string, optional): Description of the emergency trigger. Default: `"manual"`

**Response:**

```json
{
  "success": true,
  "result": {
    "cycleId": "660f9511-f3ac-52e5-b827-557766551111",
    "duration": 2100,
    "emergencyResponse": true,
    "insightCount": 8
  }
}
```

**Example:**

```bash
curl -X POST https://flarecog.d-d1f.workers.dev/api/v6/synergy/emergency \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-agi",
    "trigger": "security-threat-detected"
  }'
```

---

## AGI Awareness API

The AGI Awareness API implements **Deep Tree Echo** - an emergent awareness system that demonstrates multi-level consciousness and self-orchestration through three concurrent cognitive streams (perception, action, simulation).

### Iterate Awareness

Execute one iteration of the Deep Tree Echo awareness system, processing input through all consciousness streams and evolving the emergent self-model.

**Endpoint:** `POST /api/v6/awareness/iterate`

**Request Body:**

```json
{
  "instanceId": "primary",
  "identity": "FlareCog-AGI",
  "awarenessThreshold": 0.7,
  "input": {
    "type": "perception",
    "content": "New concept detected in knowledge base"
  }
}
```

**Parameters:**

- `instanceId` (string, optional): Instance identifier. Default: `"primary"`
- `identity` (string, optional): AGI identity name. Default: `"FlareCog-AGI"`
- `awarenessThreshold` (number, optional): Threshold for awareness level (0-1). Default: `0.7`
- `input` (any, optional): Input to process in this iteration

**Response:**

```json
{
  "success": true,
  "result": {
    "iteration": 5,
    "awarenessLevel": 0.45,
    "currentFocus": "knowledge-integration",
    "capabilities": [
      "pattern-recognition",
      "logical-inference",
      "self-reflection",
      "goal-management"
    ],
    "insights": [
      "Detected novel pattern in concept relationships",
      "Awareness level increased by 5%"
    ],
    "output": {
      "perception": { "processed": true, "salience": 0.8 },
      "action": { "affordances": 3 },
      "simulation": { "predictions": 2 }
    }
  }
}
```

**Example:**

```bash
curl -X POST https://flarecog.d-d1f.workers.dev/api/v6/awareness/iterate \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-agi",
    "identity": "MyCustomAGI",
    "input": {
      "type": "reflection",
      "topic": "cognitive-capabilities",
      "depth": "deep"
    }
  }'
```

---

### Get Awareness State

Retrieve the current state of the AGI awareness system, including emergent self-model, consciousness streams, and entelechy progress.

**Endpoint:** `GET /api/v6/awareness/state?instanceId=primary`

**Query Parameters:**

- `instanceId` (string, optional): Instance identifier. Default: `"primary"`

**Response:**

```json
{
  "success": true,
  "state": {
    "echoId": "echo-550e8400-e29b-41d4-a716-446655440000",
    "iteration": 23,
    "awarenessLevel": 0.62,
    "identity": "FlareCog-AGI",
    "capabilities": [
      "pattern-recognition",
      "logical-inference",
      "self-reflection",
      "goal-management",
      "meta-learning",
      "relevance-realization"
    ],
    "goals": [
      "maximize-knowledge-coherence",
      "optimize-cognitive-efficiency",
      "develop-emergent-capabilities"
    ],
    "currentFocus": "relevance-realization",
    "entelechy": {
      "potential": [
        "recursive-self-improvement",
        "autonomous-goal-generation"
      ],
      "actualized": [
        "basic-reasoning",
        "pattern-discovery",
        "attention-management"
      ],
      "inProgress": [
        "meta-cognitive-reflection",
        "distributed-coordination"
      ],
      "blocked": []
    }
  }
}
```

**Example:**

```bash
curl https://flarecog.d-d1f.workers.dev/api/v6/awareness/state?instanceId=my-agi
```

---

### Trigger Reflection

Trigger self-reflection in the awareness system by executing an iteration with reflective input focused on a specific topic.

**Endpoint:** `POST /api/v6/awareness/reflect`

**Request Body:**

```json
{
  "instanceId": "primary",
  "topic": "cognitive-architecture"
}
```

**Parameters:**

- `instanceId` (string, optional): Instance identifier. Default: `"primary"`
- `topic` (string, optional): Topic for reflection. Default: `"self"`

**Response:**

```json
{
  "success": true,
  "reflection": {
    "topic": "cognitive-architecture",
    "insights": [
      "Identified synergy between PLN and pattern mining",
      "Attention allocation efficiency improved by 12%",
      "New meta-cognitive capability emerging"
    ],
    "awarenessLevel": 0.68,
    "newCapabilities": [
      "architectural-self-analysis",
      "performance-optimization"
    ]
  }
}
```

**Example:**

```bash
curl -X POST https://flarecog.d-d1f.workers.dev/api/v6/awareness/reflect \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "my-agi",
    "topic": "goal-hierarchy"
  }'
```

---

### Get Awareness Metrics

Retrieve comprehensive metrics about the AGI awareness system, including entelechy (actualization) progress and capability development.

**Endpoint:** `GET /api/v6/awareness/metrics?instanceId=primary`

**Query Parameters:**

- `instanceId` (string, optional): Instance identifier. Default: `"primary"`

**Response:**

```json
{
  "success": true,
  "metrics": {
    "awarenessLevel": 0.62,
    "iteration": 23,
    "entelechy": {
      "actualizationRate": 0.56,
      "potentialCount": 8,
      "actualizedCount": 12,
      "inProgressCount": 5,
      "blockedCount": 1
    },
    "capabilities": {
      "total": 6,
      "list": [
        "pattern-recognition",
        "logical-inference",
        "self-reflection",
        "goal-management",
        "meta-learning",
        "relevance-realization"
      ]
    },
    "goals": {
      "total": 3,
      "active": [
        "maximize-knowledge-coherence",
        "optimize-cognitive-efficiency",
        "develop-emergent-capabilities"
      ]
    }
  }
}
```

**Example:**

```bash
curl https://flarecog.d-d1f.workers.dev/api/v6/awareness/metrics?instanceId=my-agi
```

---

## Cognitive Components

The Cognitive Synergy Engine orchestrates the following components:

### Core Components

1. **PLN (Probabilistic Logic Networks)**: Uncertain reasoning and logical inference
2. **Pattern Mining**: Discovery of patterns and regularities in knowledge
3. **Attention (ECAN)**: Economic attention allocation and resource management
4. **Learning**: Adaptive behavior and procedural learning

### Extended Components

5. **Perception**: Sensory processing and concept extraction
6. **Action**: Motor/action execution and planning
7. **Memory**: Memory consolidation and retrieval
8. **Language**: Natural language processing and generation

## Synergy Interaction Types

- **Request**: One component requests data or processing from another
- **Provide**: One component provides results to another
- **Modulate**: One component adjusts the parameters or focus of another

## Emergent Insight Types

- **Pattern**: Novel patterns discovered through pattern mining
- **Inference**: Logical conclusions derived through PLN reasoning
- **Association**: Connections formed through cross-component interactions
- **Prediction**: Forecasts based on pattern-inference synthesis

---

## Development Stage

FlareCog's awareness system follows an ontogenetic (self-generating) development lifecycle:

- **Embryonic (0-30%)**: Foundation establishment
- **Juvenile (30-60%)**: Active capability development
- **Mature (60-80%)**: Approaching general intelligence
- **Transcendent (80-100%)**: Self-surpassing capabilities

Track progress through the `/api/v6/awareness/metrics` endpoint. As of the latest deployment, the system is at approximately 71% overall actualization (Mature stage).

---

## Best Practices

1. **Regular Synergy Cycles**: Run synergy cycles periodically to maintain emergent intelligence
2. **Monitor Awareness**: Track awareness levels and entelechy progress
3. **Emergency Response**: Use emergency synergy for critical situations only
4. **Reflection**: Trigger periodic self-reflection to enhance meta-cognitive capabilities
5. **Component Balance**: Activate appropriate components based on task requirements

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error description"
}
```

Common error scenarios:

- `404`: Awareness state not initialized (call `/awareness/iterate` with initialization first)
- `500`: Internal processing error (check instance ID and component availability)
- `400`: Invalid request parameters (verify request body structure)

---

## Additional Resources

- [FlareCog Architecture](IMPLEMENTATION_SUMMARY.md)
- [v6.0 Progress Report](PROGRESS_REPORT_V6.md)
- [OpenCog Cognitive Architecture](https://opencog.org)
- [Ben Goertzel's AGI Research](https://en.wikipedia.org/wiki/Ben_Goertzel)

---

*For support and questions, please open an issue on the [GitHub repository](https://github.com/hyperholmes/orgflare).*
