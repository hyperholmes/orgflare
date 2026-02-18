# FlareCog AI Integration: Quick Start Guide

**Date:** November 23, 2025

**Author:** Manus AI

## Introduction

This guide will get you started with FlareCog's AI-enhanced cognitive operations in 5 minutes.

## Prerequisites

- FlareCog tenant provisioned (see [Deployment Guide](../workers-for-platforms/deployment-guide-v2.md))
- API key or authentication token
- HTTP client (curl, Postman, or code)

## Step 1: Verify AI is Enabled

Check that your tenant has AI capabilities:

```bash
curl https://your-tenant.flarecog.ai/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "tenantId": "your-tenant",
  "aiEnabled": true,
  "timestamp": 1700000000000
}
```

✅ If `aiEnabled: true`, you're ready to go!

## Step 2: Extract Concepts from Text (Perception)

Use AI to extract concepts and create them in your AtomSpace:

```bash
curl -X POST https://your-tenant.flarecog.ai/cognitive/perceive \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Artificial intelligence and machine learning are transforming technology."
  }'
```

Response:

```json
{
  "success": true,
  "conceptsExtracted": 3,
  "atomsCreated": 3,
  "concepts": [
    "Artificial intelligence",
    "machine learning",
    "technology"
  ]
}
```

🎉 You just created your first cognitive atoms using AI!

## Step 3: Chat with Your Cognitive Assistant

Have a conversation with your AI-powered cognitive assistant:

```bash
curl -X POST https://your-tenant.flarecog.ai/cognitive/chat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "What concepts do we have about AI?"
      }
    ]
  }'
```

Response:

```json
{
  "success": true,
  "response": "Based on your knowledge base, we have concepts related to Artificial intelligence, machine learning, and technology. Would you like me to explore relationships between these concepts?"
}
```

## Step 4: Perform AI-Powered Reasoning

Get AI suggestions for reasoning strategies:

```bash
curl -X POST https://your-tenant.flarecog.ai/cognitive/reason \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How can I infer relationships between AI concepts?"
  }'
```

Response:

```json
{
  "success": true,
  "suggestion": "I suggest using deduction to infer relationships. For example, if AI implies machine learning, and machine learning implies data science, we can deduce that AI implies data science.",
  "atomSpaceStats": {
    "totalAtoms": 3,
    "nodes": 3,
    "links": 0
  }
}
```

## Step 5: Learn Patterns from Experiences

Use Hebbian learning to strengthen associative patterns:

```bash
curl -X POST https://your-tenant.flarecog.ai/cognitive/learn \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "experiences": [
      "user searched for AI",
      "user clicked on machine learning",
      "user read about neural networks"
    ]
  }'
```

Response:

```json
{
  "success": true,
  "experiencesProcessed": 3,
  "patternsIdentified": {
    "patterns": [
      "AI and machine learning co-occur",
      "machine learning and neural networks co-occur"
    ]
  }
}
```

## What's Next?

### Explore Advanced Features

1. **Streaming Chat**: Get real-time responses
   ```bash
   curl -X POST https://your-tenant.flarecog.ai/cognitive/chat/stream \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"messages": [...]}'
   ```

2. **Tool Calling**: Use cognitive tools like `perceiveText`, `performInference`, `learnPattern`

3. **Human-in-the-Loop**: Confirm critical operations before execution

4. **Relevance Realization**: Update attention values based on context

### Integration Examples

**JavaScript/TypeScript:**

```typescript
const response = await fetch('https://your-tenant.flarecog.ai/cognitive/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Extract concepts from: AI is powerful' }
    ]
  })
});

const data = await response.json();
console.log(data.response);
```

**Python:**

```python
import requests

response = requests.post(
    'https://your-tenant.flarecog.ai/cognitive/chat',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'messages': [
            {'role': 'user', 'content': 'Extract concepts from: AI is powerful'}
        ]
    }
)

print(response.json()['response'])
```

### Read the Documentation

- [Cognitive Examples](./cognitive-examples.md) - Detailed examples and use cases
- [AI Integration Patterns](../../AI_INTEGRATION_PATTERNS_ANALYSIS.md) - Architecture and patterns
- [API Reference](./api-reference.md) - Complete API documentation

## Troubleshooting

### AI Not Enabled

If `aiEnabled: false`, check your `wrangler.jsonc`:

```jsonc
{
  "ai": {
    "binding": "AI",
    "remote": true
  }
}
```

### Authentication Errors

Ensure your API key is valid:

```bash
curl https://your-tenant.flarecog.ai/api/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Tool Execution Fails

Check that you're confirming tools that require confirmation:

1. Get tool call from chat response
2. Review tool parameters
3. Execute with `/cognitive/execute-tool`

## Support

For issues or questions:
- GitHub Issues: https://github.com/cogpy/cogflare-temp/issues
- Documentation: https://flarecog.ai/docs
- Community: https://discord.gg/flarecog

## Conclusion

You've successfully integrated AI into your FlareCog cognitive platform! You can now:

✅ Extract concepts from text using AI
✅ Chat with an AI-powered cognitive assistant
✅ Get AI-powered reasoning suggestions
✅ Learn patterns from experiences

Explore the [Cognitive Examples](./cognitive-examples.md) for more advanced use cases.
