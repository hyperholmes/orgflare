# Workers for Platforms vs Standard Workers: Comparison for FlareCog

## Executive Summary

**Workers for Platforms (WFP) has DIFFERENT pricing and some DIFFERENT limits compared to standard Workers.** The key differences impact the cost model significantly, especially for FlareCog's use case.

## Pricing Comparison

### Base Subscription Cost

| Plan | Standard Workers | Workers for Platforms |
|------|------------------|----------------------|
| **Monthly Base** | **$5.00** | **$25.00** |
| **Difference** | — | **5x higher base cost** |

### Request Pricing

| Metric | Standard Workers | Workers for Platforms |
|--------|------------------|----------------------|
| **Included Requests** | 1 million/month | **20 million/month** |
| **Overage Cost** | $0.15/million | **$0.30/million** |
| **Difference** | — | **20x more included, 2x higher overage** |

### Compute Pricing

| Metric | Standard Workers | Workers for Platforms |
|--------|------------------|----------------------|
| **Pricing Model** | **Duration-based** (GB-seconds) | **CPU-time based** (CPU milliseconds) |
| **Included** | N/A (duration model) | **60 million CPU ms/month** |
| **Overage Cost** | N/A | **$0.02/million CPU ms** |
| **Max CPU Time** | 30s default, 5min configurable | **30s per invocation** |

**Critical Difference:** Standard Workers charge for **wall-clock duration** (including I/O wait), while WFP charges only for **active CPU time**. This is a **MAJOR advantage** for I/O-heavy workloads like database queries.

### Script Pricing

| Metric | Standard Workers | Workers for Platforms |
|--------|------------------|----------------------|
| **Included Scripts** | 500 (Paid plan limit) | **1,000 scripts** |
| **Overage Cost** | N/A (hard limit) | **$0.02/script** |
| **Difference** | — | **Unlimited scripts with per-script pricing** |

## Durable Objects Pricing (SAME for both)

**Important:** Durable Objects pricing is **identical** for both Standard Workers and Workers for Platforms.

| Component | Pricing |
|-----------|---------|
| **Requests** | 1M included, then $0.15/million |
| **Duration** | 400,000 GB-s included, then $12.50/million GB-s |
| **Row Reads** | 25B/month included, then $0.001/million |
| **Row Writes** | 50M/month included, then $1.00/million |
| **Storage** | 5 GB included, then $0.20/GB-month |

**Key Insight:** Since FlareCog is primarily a Durable Objects application, the **Durable Objects costs remain the same** regardless of whether you use Standard Workers or WFP.

## Limits Comparison

### Script Limits

| Limit | Standard Workers | Workers for Platforms |
|-------|------------------|----------------------|
| **Number of Scripts** | 500 (Paid) / 100 (Free) | **Unlimited** |
| **Durable Object Namespaces** | 500 (Paid) / 100 (Free) | **Unlimited** |

### Other Limits (SAME for both)

- Durable Object storage per instance: **10 GB** (same)
- Durable Object memory per instance: **128 MB** (same)
- Account storage: **Unlimited** (same for Paid plans)
- Request rate per DO: **~1,000 req/s soft limit** (same)

## Cost Impact Analysis for FlareCog

### Scenario: Small Deployment (10 AtomSpaces)

**Standard Workers:**
- Base: $5.00
- Requests: $0.35 (within DO allocation)
- **DO Duration: $15.74**
- **DO Storage: $13.00**
- DO Writes: $0.55
- **Total: $34.64/month**

**Workers for Platforms:**
- Base: **$25.00** (vs $5.00)
- Requests: $0.00 (within 20M allocation)
- WFP CPU time: Minimal (most time is I/O wait in SQLite)
- **DO Duration: $15.74** (same - DO pricing unchanged)
- **DO Storage: $13.00** (same)
- DO Writes: $0.55 (same)
- **Total: ~$54.29/month** (+$19.65, **+57% more expensive**)

### Scenario: Large Deployment (100 AtomSpaces)

**Standard Workers:**
- Base: $5.00
- Requests: $4.80
- **DO Duration: $340.60**
- **DO Storage: $139.40**
- DO Writes: $5.95
- **Total: $495.75/month**

**Workers for Platforms:**
- Base: **$25.00**
- Requests: $0.00 (within 20M allocation)
- WFP CPU time: Minimal
- **DO Duration: $340.60** (same)
- **DO Storage: $139.40** (same)
- DO Writes: $5.95 (same)
- **Total: ~$511.00/month** (+$15.25, **+3% more expensive**)

## Key Findings

### 1. Durable Objects Costs Dominate at Scale

At larger scales, **Durable Objects costs (Duration + Storage) represent 90%+ of total cost**. The difference between Standard Workers ($5 base) and WFP ($25 base) becomes negligible.

### 2. WFP is More Expensive for Small Deployments

For deployments under ~20 AtomSpaces, the **$25 base cost of WFP makes it 50-100% more expensive** than Standard Workers.

### 3. WFP Becomes Competitive at Scale

For deployments over 100 AtomSpaces, the difference is only **3-5%**, which may be worth it for the additional features of WFP (unlimited scripts, multi-tenancy, etc.).

### 4. CPU-Time Pricing is NOT an Advantage for FlareCog

FlareCog's workload is **I/O-heavy** (SQLite queries, network calls). The CPU-time pricing model of WFP would be advantageous for **CPU-intensive** workloads, but FlareCog spends most of its time waiting on I/O, which is charged as **duration** in Durable Objects regardless.

## When to Use Workers for Platforms for FlareCog

### Use WFP if:
1. **Multi-tenancy is required** - You want to isolate different customers' AtomSpaces in separate namespaces
2. **You need >500 scripts** - Standard Workers has a hard limit of 500 scripts
3. **You need >500 DO namespaces** - Standard Workers has a hard limit
4. **You're building a SaaS platform** - WFP provides better isolation and management for multi-tenant applications
5. **Scale is very large** - At 100+ AtomSpaces, the cost difference is minimal

### Use Standard Workers if:
1. **Cost-sensitive small deployment** - Under 20 AtomSpaces, Standard Workers is significantly cheaper
2. **Single-tenant application** - No need for namespace isolation
3. **Under 500 scripts/namespaces** - Standard limits are sufficient
4. **Prototyping/development** - Lower base cost for experimentation

## Revised Cost Estimates for FlareCog on WFP

| Scenario | AtomSpaces | Standard Workers | Workers for Platforms | Difference |
|----------|------------|------------------|----------------------|------------|
| Micro | 3 | $8.21 | **$28.21** | +$20 (+244%) |
| Small | 10 | $34.64 | **$54.29** | +$20 (+57%) |
| Medium | 50 | $212.72 | **$232.37** | +$20 (+9%) |
| Large | 100 | $495.75 | **$515.40** | +$20 (+4%) |
| Very Large | 500 | $2,829.15 | **$2,848.80** | +$20 (+0.7%) |
| Extreme | 1,000 | $5,659.50 | **$5,679.15** | +$20 (+0.4%) |

**Pattern:** The difference is essentially **the $20 base cost difference** ($25 - $5), since DO costs dominate and WFP request/CPU costs are negligible for FlareCog's workload.

## Recommendation for FlareCog

### For Single-Tenant Deployment:
**Use Standard Workers.** The cost savings at small-to-medium scale are significant, and the 500 script/namespace limit is more than sufficient for most use cases.

### For Multi-Tenant SaaS Platform:
**Use Workers for Platforms.** The isolation, unlimited scripts/namespaces, and multi-tenancy features justify the $20/month premium, especially at scale.

### Hybrid Approach:
Consider using **Standard Workers for the core FlareCog implementation** and **WFP only if you need to provide FlareCog-as-a-Service** to multiple customers with strong isolation requirements.

## Updated Optimal Operating Zone

The optimal operating zone remains **10-100 AtomSpaces**, but the cost range shifts slightly:

**Standard Workers:** $30-$500/month
**Workers for Platforms:** $50-$520/month (+$20 flat premium)

The strategic recommendations and feasibility zones remain unchanged, as the cost difference is minimal relative to the total cost at scale.
