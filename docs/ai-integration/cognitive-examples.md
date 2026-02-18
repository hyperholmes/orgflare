# AI-Powered Cognitive Operations: Examples and Use Cases

**Date:** November 23, 2025

**Author:** Manus AI

## Overview

This document provides practical examples of using FlareCog's AI-enhanced cognitive operations. All examples use the CloudFlare AI binding and Vercel AI SDK for seamless integration.

## Prerequisites

- FlareCog tenant provisioned
- API key or authentication token
- HTTP client (curl, Postman, or JavaScript fetch)

## Example 1: AI-Powered Text Perception

Extract concepts and relationships from natural language text and insert them into the AtomSpace.

### Request

```bash
curl -X POST https://acme.flarecog.ai/cognitive/perceive \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Artificial intelligence enables machines to learn from experience and perform human-like tasks. Machine learning is a subset of AI that focuses on data-driven learning."
  }'
```

### Response

```json
{
  "success": true,
  "conceptsExtracted": 5,
  "atomsCreated": 5,
  "concepts": [
    "Artificial intelligence",
    "machines",
    "Machine learning",
    "AI",
    "data-driven learning"
  ],
  "atoms": [
    {
      "handle": "atom-1",
      "type": "ConceptNode",
      "name": "Artificial intelligence",
      "truthValue": { "strength": 0.8, "confidence": 0.6 },
      "attentionValue": { "sti": 100, "lti": 50, "vlti": 10 }
    }
    // ... more atoms
  ]
}
```

### What Happens

1. CloudFlare AI (Llama 3.1) extracts key concepts from the text
2. Each concept is created as a `ConceptNode` in the AtomSpace
3. Attention values are set for relevance realization
4. Truth values indicate confidence in the extracted concepts

## Example 2: Streaming Cognitive Chat

Interactive AI-powered cognitive assistant with tool calling and streaming responses.

### Request (JavaScript)

```javascript
const response = await fetch('https://acme.flarecog.ai/cognitive/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      {
        role: 'user',
        content: 'Extract concepts from this text: "OpenCog is an AGI framework that uses AtomSpace for knowledge representation."'
      }
    ]
  })
});

// Stream the response
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  console.log('Chunk:', chunk);
}
```

### Response (Streamed)

```
I'll extract the key concepts from that text for you.

[Tool Call: perceiveText]
{
  "text": "OpenCog is an AGI framework that uses AtomSpace for knowledge representation.",
  "extractRelationships": true
}

[Tool Result]
{
  "success": true,
  "concepts": ["OpenCog", "AGI framework", "AtomSpace", "knowledge representation"],
  "relationships": [
    { "source": "OpenCog", "relation": "is-a", "target": "AGI framework" },
    { "source": "OpenCog", "relation": "uses", "target": "AtomSpace" },
    { "source": "AtomSpace", "relation": "for", "target": "knowledge representation" }
  ]
}

I've extracted 4 key concepts and 3 relationships from the text. The concepts have been identified as OpenCog, AGI framework, AtomSpace, and knowledge representation, with their semantic relationships preserved.
```

### What Happens

1. User sends a message to the cognitive assistant
2. AI determines that `perceiveText` tool should be called
3. Tool executes automatically (no confirmation needed)
4. AI incorporates tool result into the response
5. Response is streamed in real-time to the client

## Example 3: Logical Inference with Confirmation

Perform PLN inference that requires human confirmation before execution.

### Request

```bash
curl -X POST https://acme.flarecog.ai/cognitive/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Apply deduction to these premises: ImplicationLink(AI, MachineLearning) and ImplicationLink(MachineLearning, DataScience)"
      }
    ]
  }'
```

### Response

```json
{
  "success": true,
  "response": "I can perform a deduction inference on those premises. This will create a new ImplicationLink(AI, DataScience) in your AtomSpace.",
  "toolCalls": [
    {
      "toolName": "performInference",
      "args": {
        "premises": [
          "ImplicationLink(AI, MachineLearning)",
          "ImplicationLink(MachineLearning, DataScience)"
        ],
        "rule": "deduction",
        "maxInferences": 10
      },
      "requiresConfirmation": true
    }
  ],
  "finishReason": "tool-calls"
}
```

### Confirm and Execute

```bash
curl -X POST https://acme.flarecog.ai/cognitive/execute-tool \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "performInference",
    "args": {
      "premises": [
        "ImplicationLink(AI, MachineLearning)",
        "ImplicationLink(MachineLearning, DataScience)"
      ],
      "rule": "deduction",
      "maxInferences": 10
    }
  }'
```

### Execution Response

```json
{
  "success": true,
  "toolName": "performInference",
  "result": {
    "success": true,
    "rule": "deduction",
    "premises": [
      "ImplicationLink(AI, MachineLearning)",
      "ImplicationLink(MachineLearning, DataScience)"
    ],
    "inferences": [
      {
        "conclusion": "ImplicationLink(AI, DataScience)",
        "truthValue": { "strength": 0.8, "confidence": 0.7 }
      }
    ],
    "message": "Generated 1 inferences using deduction"
  }
}
```

### What Happens

1. User requests inference operation
2. AI identifies that `performInference` tool is needed
3. Tool requires confirmation, so AI returns tool call details
4. User reviews and confirms the operation
5. Tool executes and creates new inference in AtomSpace

## Example 4: Pattern Learning from Experiences

Learn associative patterns using Hebbian learning.

### Request

```bash
curl -X POST https://acme.flarecog.ai/cognitive/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Learn patterns from these experiences: [\"user searched for AI\", \"user clicked on machine learning\", \"user read about neural networks\", \"user bookmarked deep learning\"]"
      }
    ]
  }'
```

### Response

```json
{
  "success": true,
  "response": "I've learned associative patterns from those 4 experiences.",
  "toolCalls": [
    {
      "toolName": "learnPattern",
      "args": {
        "experiences": [
          "user searched for AI",
          "user clicked on machine learning",
          "user read about neural networks",
          "user bookmarked deep learning"
        ],
        "learningRate": 0.1
      },
      "result": {
        "success": true,
        "patternsLearned": 6,
        "patterns": [
          {
            "source": "user searched for AI",
            "target": "user clicked on machine learning",
            "strength": 0.1
          },
          {
            "source": "user searched for AI",
            "target": "user read about neural networks",
            "strength": 0.1
          }
          // ... more patterns
        ],
        "message": "Learned 6 associative patterns"
      }
    }
  ]
}
```

### What Happens

1. User provides a sequence of experiences
2. AI calls `learnPattern` tool (auto-executes)
3. Hebbian learning creates associative links between co-occurring experiences
4. Attention values are updated to strengthen learned patterns

## Example 5: Semantic Knowledge Query

Search the AtomSpace using natural language queries.

### Request

```bash
curl -X POST https://acme.flarecog.ai/cognitive/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Find all concepts related to artificial intelligence in my knowledge base"
      }
    ]
  }'
```

### Response

```json
{
  "success": true,
  "response": "I found several concepts related to artificial intelligence in your knowledge base.",
  "toolCalls": [
    {
      "toolName": "queryKnowledge",
      "args": {
        "query": "artificial intelligence",
        "limit": 10
      },
      "result": {
        "success": true,
        "query": "artificial intelligence",
        "keywords": ["AI", "machine learning", "neural networks", "deep learning"],
        "limit": 10,
        "message": "Query processed - integrate with AtomSpace search"
      }
    }
  ]
}
```

### What Happens

1. User asks a natural language question
2. AI extracts search keywords using CloudFlare AI
3. Keywords are used to search the AtomSpace
4. Relevant concepts are returned with their relationships

## Example 6: Relevance Realization Update

Update attention values based on current cognitive context.

### Request

```bash
curl -X POST https://acme.flarecog.ai/cognitive/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "I'\''m currently working on a machine learning project. Update relevance for related concepts."
      }
    ]
  }'
```

### Response

```json
{
  "success": true,
  "response": "I've updated the relevance for concepts related to your machine learning project.",
  "toolCalls": [
    {
      "toolName": "updateRelevance",
      "args": {
        "context": "machine learning project",
        "focusAtoms": [
          "machine learning",
          "neural networks",
          "training data",
          "model optimization"
        ]
      },
      "result": {
        "success": true,
        "context": "machine learning project",
        "updatesApplied": 4,
        "updates": [
          {
            "atom": "machine learning",
            "sti": 100,
            "lti": 50,
            "vlti": 10
          }
          // ... more updates
        ],
        "message": "Updated relevance for 4 atoms"
      }
    }
  ]
}
```

### What Happens

1. User provides current cognitive context
2. AI identifies relevant concepts
3. `updateRelevance` tool increases attention values for those concepts
4. AtomSpace now prioritizes these concepts in reasoning and retrieval

## Example 7: Goal Creation with Confirmation

Create a new cognitive goal for the MindAgent.

### Request

```bash
curl -X POST https://acme.flarecog.ai/cognitive/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Create a goal to learn 100 new concepts about quantum computing with high priority"
      }
    ]
  }'
```

### Response

```json
{
  "success": true,
  "response": "I can create a goal to learn 100 new concepts about quantum computing. This will guide the MindAgent's behavior.",
  "toolCalls": [
    {
      "toolName": "createGoal",
      "args": {
        "description": "Learn 100 new concepts about quantum computing",
        "priority": 0.9,
        "conditions": [
          "AtomSpace contains at least 100 ConceptNodes with 'quantum' in name",
          "Average confidence of quantum concepts > 0.7"
        ]
      },
      "requiresConfirmation": true
    }
  ]
}
```

### Confirm and Execute

```bash
curl -X POST https://acme.flarecog.ai/cognitive/execute-tool \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "createGoal",
    "args": {
      "description": "Learn 100 new concepts about quantum computing",
      "priority": 0.9,
      "conditions": [
        "AtomSpace contains at least 100 ConceptNodes with '\''quantum'\'' in name",
        "Average confidence of quantum concepts > 0.7"
      ]
    }
  }'
```

### Execution Response

```json
{
  "success": true,
  "toolName": "createGoal",
  "result": {
    "success": true,
    "goalId": "goal-1700000000000",
    "description": "Learn 100 new concepts about quantum computing",
    "priority": 0.9,
    "conditions": [
      "AtomSpace contains at least 100 ConceptNodes with 'quantum' in name",
      "Average confidence of quantum concepts > 0.7"
    ],
    "status": "active",
    "message": "Goal created successfully"
  }
}
```

### What Happens

1. User requests goal creation
2. AI identifies that `createGoal` requires confirmation
3. User reviews goal parameters and confirms
4. Goal is created in MindAgent and begins driving cognitive behavior

## Example 8: AI-Powered Reasoning Suggestions

Get AI suggestions for reasoning strategies.

### Request

```bash
curl -X POST https://acme.flarecog.ai/cognitive/reason \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How can I infer new knowledge about programming languages?"
  }'
```

### Response

```json
{
  "success": true,
  "suggestion": "Based on your knowledge base of 150 atoms, I suggest:\n\n1. Use deduction to infer relationships between programming paradigms\n2. Apply induction to generalize from specific language features\n3. Use abduction to hypothesize why certain languages are popular\n4. Consider pattern matching to find similar language constructs",
  "atomSpaceStats": {
    "totalAtoms": 150,
    "nodes": 80,
    "links": 70,
    "atomTypes": {
      "ConceptNode": 60,
      "ImplicationLink": 40,
      "InheritanceLink": 30
    }
  }
}
```

### What Happens

1. User asks for reasoning guidance
2. CloudFlare AI analyzes the current AtomSpace state
3. AI suggests appropriate reasoning strategies
4. User can then apply suggested strategies manually or via chat

## Example 9: Complete Cognitive Workflow

A complete workflow combining perception, reasoning, and learning.

### Step 1: Perceive Text

```bash
curl -X POST https://acme.flarecog.ai/cognitive/perceive \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Python is a high-level programming language. Python supports multiple paradigms including object-oriented and functional programming."
  }'
```

### Step 2: Reason About Concepts

```bash
curl -X POST https://acme.flarecog.ai/cognitive/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What can we infer about Python based on the concepts we just learned?"
      }
    ]
  }'
```

### Step 3: Learn Patterns

```bash
curl -X POST https://acme.flarecog.ai/cognitive/learn \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type": "application/json" \
  -d '{
    "experiences": [
      "Python is high-level",
      "Python supports OOP",
      "Python supports functional programming"
    ]
  }'
```

### Result

A complete cognitive cycle:
1. **Perception**: Extracted concepts from text
2. **Reasoning**: Inferred relationships between concepts
3. **Learning**: Strengthened associative patterns

## Integration Examples

### React Component

```jsx
import { useState } from 'react';

function CognitiveChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    const response = await fetch('https://acme.flarecog.ai/cognitive/chat/stream', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [...messages, { role: 'user', content: input }]
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      assistantMessage += decoder.decode(value);
      setMessages(prev => [...prev.slice(0, -1), 
        { role: 'assistant', content: assistantMessage }
      ]);
    }
  };

  return (
    <div>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>{msg.content}</div>
        ))}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

### Python Client

```python
import requests
import json

class FlareCogClient:
    def __init__(self, tenant_url, api_key):
        self.tenant_url = tenant_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def perceive(self, text):
        response = requests.post(
            f'{self.tenant_url}/cognitive/perceive',
            headers=self.headers,
            json={'text': text}
        )
        return response.json()
    
    def chat(self, messages):
        response = requests.post(
            f'{self.tenant_url}/cognitive/chat',
            headers=self.headers,
            json={'messages': messages}
        )
        return response.json()
    
    def learn(self, experiences):
        response = requests.post(
            f'{self.tenant_url}/cognitive/learn',
            headers=self.headers,
            json={'experiences': experiences}
        )
        return response.json()

# Usage
client = FlareCogClient('https://acme.flarecog.ai', 'YOUR_API_KEY')

# Perceive text
result = client.perceive('AI is transforming technology')
print(f"Extracted {result['conceptsExtracted']} concepts")

# Chat with cognitive assistant
response = client.chat([
    {'role': 'user', 'content': 'What do we know about AI?'}
])
print(response['response'])
```

## Best Practices

### 1. Use Streaming for Long Operations

Streaming provides real-time feedback for complex cognitive operations:

```javascript
// Good: Streaming for responsive UX
const response = await fetch('/cognitive/chat/stream', {...});

// Avoid: Blocking for long operations
const response = await fetch('/cognitive/chat', {...});
```

### 2. Confirm Critical Operations

Always require confirmation for operations that modify knowledge:

```javascript
// Good: Confirm before inference
if (toolCall.requiresConfirmation) {
  const confirmed = await askUserConfirmation(toolCall);
  if (confirmed) {
    await executeTool(toolCall);
  }
}
```

### 3. Batch Perception Operations

Process multiple texts in a single request:

```javascript
// Good: Batch processing
const texts = ['text1', 'text2', 'text3'];
for (const text of texts) {
  await perceive(text);
}

// Better: Parallel processing
await Promise.all(texts.map(text => perceive(text)));
```

### 4. Monitor Attention Values

Track attention values to understand cognitive focus:

```javascript
const dashboard = await fetch('/api/dashboard');
const { atomSpace } = await dashboard.json();
console.log('High attention atoms:', atomSpace.highAttentionAtoms);
```

### 5. Use Relevance Realization

Update relevance based on user context:

```javascript
// When user context changes
await updateRelevance({
  context: 'user is researching quantum computing',
  focusAtoms: ['quantum', 'superposition', 'entanglement']
});
```

## Conclusion

FlareCog's AI-enhanced cognitive operations provide powerful tools for knowledge extraction, reasoning, and learning. By combining CloudFlare AI, Vercel AI SDK, and OpenCog principles, FlareCog enables sophisticated cognitive computing at the edge.

For more information, see:
- [AI Integration Patterns](./AI_INTEGRATION_PATTERNS_ANALYSIS.md)
- [Deployment Guide](../workers-for-platforms/deployment-guide-v2.md)
- [Architecture Overview](../workers-for-platforms/architecture.md)
