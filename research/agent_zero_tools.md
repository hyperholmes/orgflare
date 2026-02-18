# Agent-Zero Tools and Functions Research

## Overview

Agent Zero is a general-purpose AI agent framework (12.6k stars) designed to be dynamic, organically growing, and learning. It uses the computer as a tool to accomplish tasks and features a hierarchical multi-agent architecture.

## Core Architecture

### Hierarchical Agent Structure
- User/Agent 0 at top of hierarchy
- Subordinate agents can be created for subtasks
- Each agent reports back to its superior
- Communication flows through structured messages

### Message Structure
| Argument | Description |
|----------|-------------|
| Thoughts | Agent's Chain of Thought and planning process |
| Tool name | The specific tool used by the agent |
| Responses/queries | Results, feedback or queries from tools/agents |

## Built-in Tools

| Tool | Function | AGI Relevance |
|------|----------|---------------|
| behavior_adjustment | Change agent behavior based on user requests | Self-modification |
| call_subordinate | Delegate tasks to subordinate agents | Multi-agent coordination |
| code_execution_tool | Execute Python, Node.js, Shell code | Action execution |
| input | Keyboard interaction with active shell | Environment interaction |
| response_tool | Output responses to user | Communication |
| memory_tool | Save, load, delete, forget information | Persistent memory |
| knowledge (SearXNG) | Privacy-focused metasearch engine | Information retrieval |

## Memory System

### Memory Categories
| Category | Description | AGI Relevance |
|----------|-------------|---------------|
| Storage/Retrieval | User-provided info (names, API keys) | Declarative memory |
| Fragments | Conversation pieces, auto-updated | Episodic memory |
| Solutions | Successful past solutions | Procedural memory |
| Metadata | IDs, timestamps for filtering | Memory indexing |

### Memory Features
- FAISS vector search for semantic retrieval
- Dynamic context window adjustment
- Automatic summarization of past interactions
- Human-like cognitive process inspiration

## Knowledge System

### Custom Knowledge
- Directory: `/knowledge/custom/main`
- Supported formats: .txt, .pdf, .csv, .html, .json, .md
- Automatic import and indexing
- RAG-augmented task support

### Knowledge Base
- PDFs, databases, books, documentation
- `/docs` folder automatically added
- Used for Q&A and decision-making

## Instruments

Instruments are custom functionalities that don't add to system prompt token count:

| Feature | Description |
|---------|-------------|
| Storage | Long-term memory of Agent Zero |
| Availability | Unlimited number |
| Recall | On-demand by agent |
| Capability | Modify agent behavior, introduce procedures |
| Integration | Function calls, scripts for external systems |
| Execution | Inside Docker container |

## Extensions

Extensions provide modularity and flexibility:

| Aspect | Description |
|--------|-------------|
| Location | `python/extensions` directory |
| Organization | Subfolders for message loop aspects |
| Execution | Alphabetical order |
| Naming | Numbers prefix for order control |
| Focus | Each extension = specific functionality |

## Prompts System

| Component | Description |
|-----------|-------------|
| Location | `prompts/` directory |
| Format | Markdown files |
| Main file | `agent.system.main.md` (central hub) |
| Customization | Full behavior control via prompts |
| Tool prompts | `/prompts/$FOLDERNAME/agent.system.tool.$TOOLNAME.md` |

## Key Features for AGI

### General-purpose Assistant
- Not pre-programmed for specific tasks
- Gathers information, executes commands
- Cooperates with other agent instances
- Persistent memory for learning

### Computer as Tool
- Uses OS as primary tool
- Writes own code and creates tools
- Terminal access for tool creation
- Compatible with small models

### Multi-agent Cooperation
- Hierarchical task delegation
- Context isolation per agent
- Superior-subordinate communication
- Scalable task breakdown

### Customization
- No hard-coded behavior
- Full prompt customization
- Tool modification/creation
- Extension system

## Integration Capabilities

### Connectivity
- External API endpoints
- MCP server connections
- A2A (Agent-to-Agent) protocol
- Remote Function Calling (RFC)

### Deployment
- Docker containerized
- Speech-to-Text and TTS support
- Web UI interface
- Real-time streaming output

## Version History (Recent)

| Version | Key Features |
|---------|--------------|
| v0.9.7 | Projects (isolated workspaces), custom instructions, secrets |
| v0.9.6 | Memory Dashboard, Kali update, Browser Use |
| v0.9.5 | Secrets management, LiteLLM configuration |

## Repository Statistics
- Stars: 12.6k
- Forks: 2.5k
- Releases: 37 (v0.9.7 latest)
- Commits: 947
- License: Active
