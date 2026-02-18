#!/usr/bin/env python3
"""
Deploy FlareCog dispatch workers to Workers for Platforms namespace.

This script creates tenant-specific workers in the dispatch namespace
for multi-tenant AGI-as-a-Service functionality.
"""

import os
import json
import requests
from typing import List, Dict

# Cloudflare API configuration
API_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN')
ACCOUNT_ID = os.environ.get('CLOUDFLARE_ACCOUNT_ID', 'd1fcd8dbbd35aec43e5499200f6baede')
BASE_URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}'

HEADERS = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json'
}

DISPATCH_NAMESPACE = 'flarecog'

def create_dispatch_worker(worker_name: str, tenant_id: str, script_content: str) -> Dict:
    """
    Create a dispatch worker in the Workers for Platforms namespace.
    
    Args:
        worker_name: Name of the worker (e.g., 'tenant-demo')
        tenant_id: Tenant ID for isolation
        script_content: Worker script content
    
    Returns:
        API response data
    """
    url = f'{BASE_URL}/workers/dispatch/namespaces/{DISPATCH_NAMESPACE}/scripts/{worker_name}'
    
    # Prepare multipart form data
    files = {
        'metadata': (None, json.dumps({
            'main_module': 'dispatch-worker.js',
            'bindings': [
                {
                    'type': 'plain_text',
                    'name': 'TENANT_ID',
                    'text': tenant_id
                }
            ]
        }), 'application/json'),
        'dispatch-worker.js': (None, script_content, 'application/javascript+module')
    }
    
    headers = {
        'Authorization': f'Bearer {API_TOKEN}'
    }
    
    response = requests.put(url, headers=headers, files=files)
    
    if response.status_code in [200, 201]:
        print(f'✅ Created dispatch worker: {worker_name} (tenant: {tenant_id})')
        return response.json()
    else:
        print(f'❌ Failed to create worker {worker_name}: {response.text}')
        return None

def list_dispatch_workers() -> List[Dict]:
    """List all dispatch workers in the namespace."""
    url = f'{BASE_URL}/workers/dispatch/namespaces/{DISPATCH_NAMESPACE}/scripts'
    
    response = requests.get(url, headers=HEADERS)
    
    if response.status_code == 200:
        data = response.json()
        workers = data.get('result', [])
        print(f'\n📋 Found {len(workers)} dispatch workers:')
        for worker in workers:
            print(f'  - {worker.get("id")}')
        return workers
    else:
        print(f'❌ Failed to list workers: {response.text}')
        return []

def main():
    """Main deployment function."""
    print('🚀 FlareCog Dispatch Workers Deployment')
    print('=' * 50)
    
    # Read the compiled dispatch worker script
    script_path = '/home/ubuntu/flarecog/flarecog/dist/dispatch-worker.js'
    
    if not os.path.exists(script_path):
        print(f'❌ Compiled script not found at {script_path}')
        print('   Please run: npx wrangler deploy --config wrangler.dispatch.toml --dry-run --outdir=dist')
        return
    
    with open(script_path, 'r') as f:
        script_content = f.read()
    
    # Create demo tenant workers
    tenants = [
        {'name': 'demo-tenant', 'id': 'demo-001'},
        {'name': 'research-tenant', 'id': 'research-001'},
        {'name': 'production-tenant', 'id': 'prod-001'}
    ]
    
    print(f'\n📦 Creating {len(tenants)} tenant workers...\n')
    
    for tenant in tenants:
        create_dispatch_worker(
            worker_name=tenant['name'],
            tenant_id=tenant['id'],
            script_content=script_content
        )
    
    # List all dispatch workers
    list_dispatch_workers()
    
    print('\n✅ Deployment complete!')
    print(f'\n🌐 Dispatch namespace: {DISPATCH_NAMESPACE}')
    print('   Workers can be accessed via the Workers for Platforms API')

if __name__ == '__main__':
    main()
