# CloudFlare Platform Limits Research

## Durable Objects - Hard Limits (SQLite-backed)

### Per-Object Limits
- **Storage**: 10 GB per Durable Object (hard limit)
- **Memory**: 128 MB allocated per instance (shared if multiple instances on same machine)
- **CPU Time**: 30 seconds default per request (configurable up to 5 minutes)
- **Key+Value Size**: 2 MB combined maximum
- **WebSocket Message**: 32 MiB for received messages

### Per-Account Limits
- **Storage (Free)**: 5 GB total
- **Storage (Paid)**: Unlimited
- **Durable Object Classes (Free)**: 100 maximum
- **Durable Object Classes (Paid)**: 500 maximum
- **Number of Objects**: Unlimited

### Per-Request Limits
- **Soft Throughput**: ~1,000 requests/second per individual Durable Object
- **CPU Reset**: Each incoming HTTP request or WebSocket message resets CPU timer to 30s

### SQL-Specific Limits
- **Columns per table**: 100 maximum
- **Rows per table**: Unlimited (within storage limits)
- **String/BLOB/Row size**: 2 MB maximum
- **SQL statement length**: 100 KB maximum
- **Bound parameters**: 100 maximum per query
- **SQL function arguments**: 32 maximum
- **LIKE/GLOB pattern**: 50 bytes maximum

## Pricing Structure (Workers Paid Plan)

### Compute Billing
- **Requests**: 1 million included, then $0.15/million
  - Includes HTTP requests, RPC sessions, WebSocket messages (20:1 ratio), alarm invocations
- **Duration**: 400,000 GB-seconds included, then $12.50/million GB-seconds
  - Billed for 128 MB regardless of actual usage
  - Wall-clock time while object is active

### Storage Billing (SQLite-backed)
- **Row Reads**: 25 billion/month included, then $0.001/million rows
- **Row Writes**: 50 million/month included, then $1.00/million rows
- **Stored Data**: 5 GB included, then $0.20/GB-month

### Minimum Cost
- **Base**: $5/month minimum for Workers Paid plan

## Key Observations

1. **Storage is the primary constraint** for individual AtomSpace instances (10 GB hard limit)
2. **Unlimited account storage** on paid plan allows horizontal scaling
3. **CPU time resets per request** - good for burst processing, limits long-running operations
4. **Memory is fixed at 128 MB** regardless of usage
5. **Soft throughput limit** of ~1,000 req/s per DO suggests need for load distribution
6. **Row write costs are 1000x higher** than row reads ($1.00 vs $0.001 per million)
7. **Duration billing is for 128 MB** even if using less - no memory optimization benefit

## Implications for FlareCog

### Single AtomSpace Capacity
- **10 GB storage** = theoretical max ~5-10 million atoms (depending on complexity)
- **128 MB memory** = working set of ~50,000-100,000 atoms
- **1,000 req/s** = need multiple DOs for high-traffic scenarios

### Cost Drivers
- **Row writes dominate** - every atom creation/update is expensive
- **Duration charges** - keeping DOs active is costly
- **Request volume** - high query rates add up quickly

### Scaling Strategy Implications
- **Horizontal scaling is mandatory** beyond 10 GB per AtomSpace
- **Attention-based partitioning** makes sense (hot atoms in memory, cold in storage)
- **Read-heavy workloads** are much cheaper than write-heavy
- **Hibernation is critical** to avoid duration charges
