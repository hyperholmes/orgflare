#!/usr/bin/env python3
"""
Update wrangler.toml with actual Cloudflare resource IDs
"""

import json
import os

# Load resource IDs
with open('/home/ubuntu/flarecog/resource_ids.json', 'r') as f:
    resources = json.load(f)

# Create minimal wrangler.toml for v6.0
wrangler_config = f"""# FlareCog v6.0 Production Configuration
name = "flarecog"
main = "workers/app.ts"
compatibility_date = "2024-11-01"
account_id = "{os.environ.get('CLOUDFLARE_ACCOUNT_ID')}"

# ==================== KV Namespaces ====================

[[kv_namespaces]]
binding = "STORAGE_METADATA"
id = "{resources['kv_namespaces']['flarecog-storage-metadata']}"

[[kv_namespaces]]
binding = "TASK_RESULTS"
id = "{resources['kv_namespaces']['flarecog-task-results']}"

[[kv_namespaces]]
binding = "TENANT_REGISTRY"
id = "{resources['kv_namespaces']['flarecog-tenant-registry']}"

[[kv_namespaces]]
binding = "USAGE_TRACKER"
id = "{resources['kv_namespaces']['flarecog-usage-tracker']}"

[[kv_namespaces]]
binding = "SHARED_KNOWLEDGE"
id = "{resources['kv_namespaces']['flarecog-shared-knowledge']}"

[[kv_namespaces]]
binding = "KV_WARM_STORAGE"
id = "{resources['kv_namespaces']['flarecog-warm-storage']}"

# ==================== R2 Storage ====================

[[r2_buckets]]
binding = "R2_COLD_STORAGE"
bucket_name = "{resources['r2_buckets']['flarecog-cold-storage']}"

# ==================== Queues ====================

[[queues.producers]]
binding = "COGNITIVE_QUEUE"
queue = "flarecog-cognitive-queue"

[[queues.consumers]]
queue = "flarecog-cognitive-queue"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
dead_letter_queue = "flarecog-dlq"

[[queues.producers]]
binding = "PRIORITY_QUEUE"
queue = "flarecog-priority-queue"

[[queues.consumers]]
queue = "flarecog-priority-queue"
max_batch_size = 5
max_batch_timeout = 10
max_retries = 3
dead_letter_queue = "flarecog-dlq"

[[queues.producers]]
binding = "INFERENCE_QUEUE"
queue = "flarecog-inference-queue"

[[queues.consumers]]
queue = "flarecog-inference-queue"
max_batch_size = 10
max_batch_timeout = 60
max_retries = 3
dead_letter_queue = "flarecog-dlq"

[[queues.producers]]
binding = "CONSOLIDATION_QUEUE"
queue = "flarecog-consolidation-queue"

[[queues.consumers]]
queue = "flarecog-consolidation-queue"
max_batch_size = 20
max_batch_timeout = 120
max_retries = 2
dead_letter_queue = "flarecog-dlq"

[[queues.producers]]
binding = "COORDINATION_QUEUE"
queue = "flarecog-coordination-queue"

[[queues.consumers]]
queue = "flarecog-coordination-queue"
max_batch_size = 10
max_batch_timeout = 60
max_retries = 3
dead_letter_queue = "flarecog-dlq"

# ==================== Workers AI ====================

[ai]
binding = "AI"

# ==================== Environment Variables ====================

[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
ECAN_DECAY_RATE = "0.1"
ECAN_SPREAD_FRACTION = "0.5"
SYNERGY_CYCLE_TIMEOUT = "30000"
ECHO_AWARENESS_THRESHOLD = "0.7"
MAX_ATOMSPACES_PER_TENANT = "100"
DEFAULT_ATOMSPACE_QUOTA = "10000000"
HOT_TIER_STI_THRESHOLD = "80"
WARM_TIER_STI_THRESHOLD = "40"
COLD_TIER_STI_THRESHOLD = "10"
EVICTION_AGE_DAYS = "7"

# ==================== Limits and Performance ====================

limits = {{ cpu_ms = 50000 }}

[placement]
mode = "smart"

[observability]
enabled = true
head_sampling_rate = 1.0
"""

# Write to file
output_path = '/home/ubuntu/flarecog/flarecog/wrangler.toml'
with open(output_path, 'w') as f:
    f.write(wrangler_config)

print(f"✅ Updated wrangler.toml at: {output_path}")
print()
print("Configuration Summary:")
print(f"  Account ID: {os.environ.get('CLOUDFLARE_ACCOUNT_ID')}")
print(f"  KV Namespaces: {len(resources['kv_namespaces'])}")
print(f"  R2 Buckets: {len(resources['r2_buckets'])}")
print(f"  Queues: {len(resources['queues'])}")
