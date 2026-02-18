#!/usr/bin/env python3
"""
FlareCog v6.0 Cloudflare Resource Creation Script
Creates all required KV namespaces, R2 buckets, and Queues via Cloudflare API
"""

import os
import json
import requests
import sys

# Configuration
API_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN')
ACCOUNT_ID = os.environ.get('CLOUDFLARE_ACCOUNT_ID')
BASE_URL = 'https://api.cloudflare.com/client/v4'

if not API_TOKEN or not ACCOUNT_ID:
    print("❌ Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set")
    sys.exit(1)

HEADERS = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json'
}

# Resource definitions
KV_NAMESPACES = [
    'flarecog-storage-metadata',
    'flarecog-task-results',
    'flarecog-tenant-registry',
    'flarecog-usage-tracker',
    'flarecog-shared-knowledge',
    'flarecog-warm-storage'
]

R2_BUCKETS = [
    'flarecog-cold-storage'
]

QUEUES = [
    'flarecog-cognitive-queue',
    'flarecog-priority-queue',
    'flarecog-inference-queue',
    'flarecog-consolidation-queue',
    'flarecog-coordination-queue',
    'flarecog-dlq'
]

# Results storage
results = {
    'kv_namespaces': {},
    'r2_buckets': {},
    'queues': {}
}

def create_kv_namespace(title):
    """Create a KV namespace"""
    url = f'{BASE_URL}/accounts/{ACCOUNT_ID}/storage/kv/namespaces'
    data = {'title': title}
    
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            namespace_id = result['result']['id']
            print(f"✅ Created KV namespace: {title} (ID: {namespace_id})")
            return namespace_id
    
    print(f"❌ Failed to create KV namespace: {title}")
    print(f"   Response: {response.text}")
    return None

def create_r2_bucket(name):
    """Create an R2 bucket"""
    url = f'{BASE_URL}/accounts/{ACCOUNT_ID}/r2/buckets'
    data = {'name': name}
    
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            print(f"✅ Created R2 bucket: {name}")
            return name
    
    print(f"❌ Failed to create R2 bucket: {name}")
    print(f"   Response: {response.text}")
    return None

def create_queue(name):
    """Create a Queue"""
    url = f'{BASE_URL}/accounts/{ACCOUNT_ID}/queues'
    data = {'queue_name': name}
    
    response = requests.post(url, headers=HEADERS, json=data)
    
    if response.status_code == 200:
        result = response.json()
        if result.get('success'):
            queue_id = result['result']['queue_id']
            print(f"✅ Created Queue: {name} (ID: {queue_id})")
            return queue_id
    
    print(f"❌ Failed to create Queue: {name}")
    print(f"   Response: {response.text}")
    return None

def main():
    print("🚀 FlareCog v6.0 Resource Creation")
    print("=" * 50)
    print()
    
    # Create KV namespaces
    print("📦 Creating KV Namespaces...")
    print("-" * 50)
    for namespace in KV_NAMESPACES:
        namespace_id = create_kv_namespace(namespace)
        if namespace_id:
            results['kv_namespaces'][namespace] = namespace_id
    print()
    
    # Create R2 buckets
    print("🪣 Creating R2 Buckets...")
    print("-" * 50)
    for bucket in R2_BUCKETS:
        bucket_name = create_r2_bucket(bucket)
        if bucket_name:
            results['r2_buckets'][bucket] = bucket_name
    print()
    
    # Create Queues
    print("📬 Creating Queues...")
    print("-" * 50)
    for queue in QUEUES:
        queue_id = create_queue(queue)
        if queue_id:
            results['queues'][queue] = queue_id
    print()
    
    # Save results to file
    results_file = '/home/ubuntu/flarecog/resource_ids.json'
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print("=" * 50)
    print(f"✅ Resource creation complete!")
    print(f"📄 Results saved to: {results_file}")
    print()
    print("Summary:")
    print(f"  KV Namespaces: {len(results['kv_namespaces'])}/{len(KV_NAMESPACES)}")
    print(f"  R2 Buckets: {len(results['r2_buckets'])}/{len(R2_BUCKETS)}")
    print(f"  Queues: {len(results['queues'])}/{len(QUEUES)}")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
