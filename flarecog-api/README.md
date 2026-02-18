# FlareCog API - Python Client

Comprehensive Python client for the FlareCog cognitive computing platform. Provides programmatic access to tenant management, cognitive operations, MCP integration, and CloudFlare infrastructure.

## Installation

```bash
pip install flarecog-api
```

Or install from source:

```bash
cd flarecog-api
pip install -e .
```

## Quick Start

```python
from flarecog_api import FlareCogAPI

# Initialize client
client = FlareCogAPI(
    api_token="your_cloudflare_api_token",
    account_id="your_cloudflare_account_id"
)

# Create a tenant
tenant = client.create_tenant(
    tenant_id="my-tenant",
    name="My Tenant",
    tier="pro"
)

# Perform cognitive operations
result = client.perceive(
    tenant.tenant_id,
    "AI is transforming technology"
)

# Query AtomSpace
atoms = client.query_atomspace(
    tenant.tenant_id,
    {"type": "ConceptNode"}
)

# Get metrics
metrics = client.get_tenant_metrics(tenant.tenant_id)
print(f"Total atoms: {metrics.total_atoms}")
```

## Features

### Tenant Management

```python
# Create tenant
tenant = client.create_tenant("tenant-id", "Tenant Name", "pro")

# Get tenant info
tenant = client.get_tenant("tenant-id")

# List all tenants
tenants = client.list_tenants()

# Update tenant
client.update_tenant("tenant-id", tier="enterprise")

# Delete tenant
client.delete_tenant("tenant-id")
```

### Cognitive Operations

```python
# Perceive (extract concepts from text)
result = client.perceive("tenant-id", "Your text here")

# Reason (logical inference)
result = client.reason(
    "tenant-id",
    premises=["A→B", "B→C"],
    rule="deduction"
)

# Query AtomSpace
atoms = client.query_atomspace(
    "tenant-id",
    {"type": "ConceptNode", "name": "AI"}
)

# Create goal
goal = client.create_goal(
    "tenant-id",
    description="Learn about AI",
    priority=8
)
```

### MCP Integration

```python
# Connect to MCP server
connection = client.connect_mcp_server(
    "tenant-id",
    "https://mcp-server.example.com",
    api_key="optional_api_key"
)

# List available tools
tools = client.list_mcp_tools("tenant-id")

# Execute tool
result = client.execute_mcp_tool(
    "tenant-id",
    "https://mcp-server.example.com",
    "tool_name",
    {"arg1": "value1"}
)
```

### Metrics & Analytics

```python
# Get tenant metrics
metrics = client.get_tenant_metrics("tenant-id")
print(f"Total atoms: {metrics.total_atoms}")
print(f"Inferences made: {metrics.inferences_made}")

# Get platform stats
stats = client.get_platform_stats()
```

### CloudFlare Infrastructure

```python
# Create D1 database
db_id = client.create_d1_database("my-database")

# Create KV namespace
kv_id = client.create_kv_namespace("my-kv-store")

# Deploy Worker
client.deploy_worker(
    "worker-name",
    script_content="export default { async fetch(request) { return new Response('Hello'); } }",
    bindings=[
        {"type": "d1_database", "name": "DB", "database_id": db_id}
    ]
)
```

## Configuration

### Environment Variables

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
export CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

### Programmatic Configuration

```python
client = FlareCogAPI(
    api_token="your_token",
    account_id="your_account_id",
    platform_url="https://platform.flarecog.ai"  # optional
)
```

## API Reference

### FlareCogAPI

Main client class for interacting with the FlareCog platform.

#### Methods

**Tenant Management:**
- `create_tenant(tenant_id, name, tier)` - Create a new tenant
- `get_tenant(tenant_id)` - Get tenant information
- `list_tenants()` - List all tenants
- `update_tenant(tenant_id, **kwargs)` - Update tenant configuration
- `delete_tenant(tenant_id)` - Delete a tenant

**Cognitive Operations:**
- `perceive(tenant_id, text)` - Extract concepts from text
- `reason(tenant_id, premises, rule)` - Perform logical reasoning
- `query_atomspace(tenant_id, query)` - Query the AtomSpace
- `create_goal(tenant_id, description, priority, conditions)` - Create a goal

**MCP Management:**
- `connect_mcp_server(tenant_id, server_url, api_key)` - Connect to MCP server
- `list_mcp_tools(tenant_id)` - List available MCP tools
- `execute_mcp_tool(tenant_id, server_url, tool_name, args)` - Execute MCP tool

**Metrics & Analytics:**
- `get_tenant_metrics(tenant_id)` - Get cognitive metrics
- `get_platform_stats()` - Get platform-wide statistics

**CloudFlare Infrastructure:**
- `create_d1_database(name)` - Create D1 database
- `create_kv_namespace(title)` - Create KV namespace
- `deploy_worker(script_name, script_content, bindings)` - Deploy Worker

### Data Classes

#### TenantInfo

```python
@dataclass
class TenantInfo:
    tenant_id: str
    name: str
    tier: str
    status: str
    created_at: int
    worker_url: str
    database_id: str
    kv_namespace_id: str
```

#### CognitiveMetrics

```python
@dataclass
class CognitiveMetrics:
    total_atoms: int
    total_goals: int
    inferences_made: int
    last_operation: int
    operations_per_minute: float
```

## Examples

### Example 1: Create and Test Tenant

```python
from flarecog_api import FlareCogAPI

client = FlareCogAPI()

# Create tenant
tenant = client.create_tenant("demo", "Demo Tenant", "free")
print(f"Tenant created: {tenant.worker_url}")

# Test cognitive operation
result = client.perceive(tenant.tenant_id, "Hello world")
print(f"Perception result: {result}")
```

### Example 2: Batch Tenant Creation

```python
tenants = [
    ("tenant1", "Tenant 1", "free"),
    ("tenant2", "Tenant 2", "pro"),
    ("tenant3", "Tenant 3", "enterprise"),
]

for tenant_id, name, tier in tenants:
    tenant = client.create_tenant(tenant_id, name, tier)
    print(f"Created: {tenant.tenant_id}")
```

### Example 3: Monitor Platform

```python
import time

while True:
    stats = client.get_platform_stats()
    print(f"Active tenants: {stats['activeTenants']}")
    print(f"Total operations: {stats['totalOperations']}")
    time.sleep(60)  # Check every minute
```

## Error Handling

```python
try:
    tenant = client.create_tenant("invalid id", "Name", "free")
except Exception as e:
    print(f"Error: {e}")
```

## Development

### Running Tests

```bash
pytest tests/
```

### Code Formatting

```bash
black flarecog_api/
```

### Type Checking

```bash
mypy flarecog_api/
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Links

- [FlareCog Platform](https://flarecog.ai)
- [Documentation](https://docs.flarecog.ai)
- [GitHub Repository](https://github.com/cogpy/cogflare-temp)
- [CloudFlare API Documentation](https://developers.cloudflare.com/api/)

## Support

For issues and questions:
- Open an issue on GitHub
- Email: support@flarecog.ai
- Documentation: https://docs.flarecog.ai

---

Built with ❤️ for cognitive computing on the edge
