# Crisis Burst Scenario: Cost Analysis

## Scenario Overview

**Problem:** Complex cognitive task requiring ~1 month of continuous compute at normal AI agent inference rates

**Solution:** Massive horizontal scaling with 1000 concurrent AtomSpaces to compress compute into 45 minutes

**Architecture:**
- 1 Aggregation Agent (single Durable Object) - coordinates and merges results
- 1000 Worker AtomSpaces (1000 Durable Objects) - parallel shard processing
- Duration: 45 minutes (0.75 hours)
- Compression ratio: 1 month (720 hours) → 0.75 hours = **960x speedup**

---

## Cost Breakdown

### 1. Durable Objects Costs (Identical for Both Platforms)

#### Active Time Charges
- **1000 AtomSpaces × 0.75 hours = 750 DO-hours**
- **1 Aggregation Agent × 0.75 hours = 0.75 DO-hours**
- **Total: 750.75 DO-hours**

**Cost:** 750.75 × $0.15/hour = **$112.61**

#### Request Charges

**Assumptions for 45-minute burst:**
- Each AtomSpace processes cognitive operations continuously
- Average: 10 requests/second per AtomSpace (pattern matching, reasoning, updates)
- Total requests per AtomSpace: 10 req/s × 2,700 seconds = 27,000 requests
- Aggregation agent: 100 req/s (merging results from 1000 shards)
- Total aggregation requests: 100 req/s × 2,700 seconds = 270,000 requests

**Worker AtomSpaces:**
- 1000 AtomSpaces × 27,000 requests = 27,000,000 requests
- Cost: 27M × $0.15/million = **$4.05**

**Aggregation Agent:**
- 270,000 requests
- Cost: 0.27M × $0.15/million = **$0.04**

**Total DO Request Cost:** $4.05 + $0.04 = **$4.09**

#### Storage I/O

**Assumptions:**
- Each AtomSpace reads initial state (10 MB) and writes final state (10 MB)
- Aggregation agent reads all results (1000 × 10 MB = 10 GB) and writes final output (100 MB)

**Worker AtomSpaces:**
- 1000 × (10 MB read + 10 MB write) = 20,000 MB = 20 GB
- Reads: 20 GB × $0.20/GB = $4.00
- Writes: 20 GB × $1.00/GB = $20.00

**Aggregation Agent:**
- Reads: 10 GB × $0.20/GB = $2.00
- Writes: 0.1 GB × $1.00/GB = $0.10

**Total Storage I/O Cost:** $4.00 + $20.00 + $2.00 + $0.10 = **$26.10**

#### Total Durable Objects Cost
- Active time: $112.61
- Requests: $4.09
- Storage I/O: $26.10
- **Total DO: $142.80**

---

### 2. Workers Request Costs (Platform-Specific)

#### Standard Workers

**Assumptions:**
- Each DO request triggers a Worker invocation
- Total Worker requests = Total DO requests = 27,270,000
- Included: 1M requests/month (negligible for burst)
- Overage: 27.27M - 1M = 26.27M requests

**Cost:**
- Base: $5/month
- Overage: 26.27M × $0.15/million = **$3.94**
- **Total Workers: $8.94**

#### Workers for Platforms

**Assumptions:**
- Same request pattern as Standard Workers
- Included: 20M requests/month
- Overage: 27.27M - 20M = 7.27M requests

**Cost:**
- Base: $25/month
- Overage: 7.27M × $0.30/million = **$2.18**
- **Total Workers: $27.18**

---

## Total Crisis Burst Cost

| Component | Standard Workers | Workers for Platforms | Difference |
|-----------|------------------|----------------------|------------|
| **Durable Objects** | $142.80 | $142.80 | $0.00 |
| **Workers Platform** | $8.94 | $27.18 | +$18.24 |
| **TOTAL** | **$151.74** | **$169.98** | **+$18.24 (+12%)** |

---

## Key Insights

### 1. Durable Objects Dominate (94% of cost)

For this burst scenario, **Durable Objects account for 94% of the total cost** on Standard Workers ($142.80 / $151.74).

The Workers platform choice only affects **6% of the total cost**.

### 2. Workers for Platforms Premium is Minimal

The $18.24 premium for WFP represents only **12% more** than Standard Workers for this crisis scenario.

**Why so small?**
- WFP's 20M included requests cover most of the burst (27.27M total)
- Only 7.27M requests hit the $0.30/million overage rate
- The 2x request price ($0.30 vs $0.15) has minimal impact when most requests are included

### 3. Cost Per Hour of "Compressed Compute"

Since this burst compresses 720 hours of compute into 0.75 hours:

**Standard Workers:**
- $151.74 / 720 hours = **$0.21 per equivalent compute-hour**

**Workers for Platforms:**
- $169.98 / 720 hours = **$0.24 per equivalent compute-hour**

**Compared to running 1 AtomSpace for 720 hours:**
- 1 DO × 720 hours × $0.15 = $108.00 (active time only)
- Plus requests and I/O: ~$130-150 total

**The burst is only ~15% more expensive than sequential processing**, despite achieving **960x speedup**!

### 4. Storage I/O is Significant

Storage I/O ($26.10) represents **17% of total cost**, primarily from writes ($20.10).

**Optimization opportunity:**
- Use R2 cold storage for final results instead of DO storage
- R2 writes: 20 GB × $0.005/GB = $0.10 (200x cheaper!)
- **Potential savings: $20.00** (13% of total cost)

### 5. Request Costs are Negligible

Despite 27.27M requests, the cost is only **$4.09** (2.7% of total).

This validates that **request volume is not a cost concern** for cognitive workloads, even at massive scale.

---

## Recommendations

### For Crisis Burst Scenarios

1. **Use Standard Workers** unless you need WFP's multi-tenancy features
   - Saves $18.24 (12%) with identical functionality
   - The premium is small but unnecessary for single-tenant bursts

2. **Optimize Storage I/O**
   - Write final results to R2 instead of DO storage
   - Potential savings: $20.00 (13% of total cost)
   - **New total with R2: $131.74** (Standard Workers)

3. **Consider Burst Pricing Strategy**
   - The 960x speedup costs only 15% more than sequential processing
   - **Time-to-solution is often worth the premium**
   - Crisis scenarios justify the cost for business-critical problems

4. **Scale Horizontally Without Fear**
   - Going from 1 to 1000 AtomSpaces increases cost by ~1.15x (not 1000x!)
   - Durable Objects scale **sub-linearly** due to fixed per-hour pricing
   - Each additional AtomSpace adds only $0.15/hour + minimal requests/I/O

### Cost-Optimized Crisis Architecture

**With R2 optimization:**

| Component | Cost |
|-----------|------|
| 1000 AtomSpaces (active time) | $112.50 |
| 1 Aggregation Agent (active time) | $0.11 |
| DO Requests | $4.09 |
| DO Storage Reads | $6.00 |
| R2 Storage Writes | $0.10 |
| Workers Platform | $8.94 |
| **TOTAL** | **$131.74** |

**Per equivalent compute-hour: $0.18**

---

## Comparison to Alternative Approaches

### Option A: Single AtomSpace (Sequential)
- Duration: 720 hours (30 days)
- Cost: ~$130-150
- **Time-to-solution: 30 days** ❌

### Option B: 1000 AtomSpaces (Burst) - Standard Workers
- Duration: 0.75 hours (45 minutes)
- Cost: $131.74 (with R2 optimization)
- **Time-to-solution: 45 minutes** ✅

### Option C: 1000 AtomSpaces (Burst) - Workers for Platforms
- Duration: 0.75 hours (45 minutes)
- Cost: $149.98 (with R2 optimization)
- **Time-to-solution: 45 minutes** ✅

### Verdict

For crisis scenarios where **time is critical**, the burst approach is **clearly superior**:
- **960x faster** for only **1.15x cost**
- Solves the problem in **45 minutes instead of 30 days**
- Standard Workers saves $18.24 vs WFP (12% cheaper)

---

## Scaling Analysis

What if the problem requires even more compute?

### 10,000 AtomSpaces (10x scale)

**Duration:** 4.5 minutes (0.075 hours) for same problem
**Cost (Standard Workers with R2):**
- Active time: 10,000 × 0.075 × $0.15 = $112.50
- Requests: 270M × $0.15/million = $40.50
- Storage I/O: ~$60.00
- Workers: $45.00
- **Total: ~$258**

**Per equivalent compute-hour:** $0.36

**Insight:** Doubling the parallelism increases cost by ~2x but reduces time by ~10x. The cost-per-compute-hour increases due to coordination overhead.

### Optimal Scale

For this problem, **1000 AtomSpaces appears optimal**:
- Balances cost ($0.18/compute-hour) and speed (45 min)
- Beyond 1000, coordination overhead increases faster than time savings
- Below 1000, time-to-solution becomes impractical for crisis scenarios

---

## Conclusion

**For crisis burst scenarios, Standard Workers is the clear winner:**

1. **Cost difference is minimal:** Only $18.24 (12%) more for WFP
2. **Durable Objects dominate:** 94% of cost, same on both platforms
3. **Burst is cost-effective:** Only 15% more than sequential for 960x speedup
4. **R2 optimization is key:** Saves $20 (13%) by avoiding DO write costs
5. **Horizontal scaling works:** Sub-linear cost scaling enables massive parallelism

**Bottom line:** Use **Standard Workers + R2 optimization** for crisis bursts. Total cost: **$131.74** to compress 30 days of compute into 45 minutes.
