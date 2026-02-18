#!/bin/bash

# FlareCog v6.0 Cloudflare Resource Setup Script
# This script creates all necessary Cloudflare resources for FlareCog v6.0

set -e

echo "🚀 FlareCog v6.0 Resource Setup"
echo "================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Cloudflare. Please run:"
    echo "   wrangler login"
    exit 1
fi

echo "✅ Wrangler CLI found and authenticated"
echo ""

# Function to create KV namespace
create_kv_namespace() {
    local binding=$1
    local name=$2
    
    echo "📦 Creating KV namespace: $name"
    
    # Create production namespace
    PROD_ID=$(wrangler kv:namespace create "$name" --preview false 2>&1 | grep -oP 'id = "\K[^"]+')
    
    # Create preview namespace
    PREVIEW_ID=$(wrangler kv:namespace create "$name" --preview true 2>&1 | grep -oP 'id = "\K[^"]+')
    
    echo "   Production ID: $PROD_ID"
    echo "   Preview ID: $PREVIEW_ID"
    echo "   Add to wrangler.toml:"
    echo "   [[kv_namespaces]]"
    echo "   binding = \"$binding\""
    echo "   id = \"$PROD_ID\""
    echo "   preview_id = \"$PREVIEW_ID\""
    echo ""
}

# Function to create R2 bucket
create_r2_bucket() {
    local binding=$1
    local name=$2
    
    echo "🪣 Creating R2 bucket: $name"
    
    wrangler r2 bucket create "$name" || echo "   (Bucket may already exist)"
    wrangler r2 bucket create "${name}-preview" || echo "   (Preview bucket may already exist)"
    
    echo "   Add to wrangler.toml:"
    echo "   [[r2_buckets]]"
    echo "   binding = \"$binding\""
    echo "   bucket_name = \"$name\""
    echo "   preview_bucket_name = \"${name}-preview\""
    echo ""
}

# Function to create D1 database
create_d1_database() {
    local binding=$1
    local name=$2
    
    echo "🗄️  Creating D1 database: $name"
    
    DB_OUTPUT=$(wrangler d1 create "$name" 2>&1)
    DB_ID=$(echo "$DB_OUTPUT" | grep -oP 'database_id = "\K[^"]+')
    
    echo "   Database ID: $DB_ID"
    echo "   Add to wrangler.toml:"
    echo "   [[d1_databases]]"
    echo "   binding = \"$binding\""
    echo "   database_name = \"$name\""
    echo "   database_id = \"$DB_ID\""
    echo ""
}

# Function to create Queue
create_queue() {
    local name=$1
    
    echo "📬 Creating Queue: $name"
    
    wrangler queues create "$name" || echo "   (Queue may already exist)"
    
    echo ""
}

echo "Creating v6.0 Resources..."
echo "=========================="
echo ""

# Create new v6.0 KV namespaces
echo "📦 KV Namespaces"
echo "----------------"
create_kv_namespace "STORAGE_METADATA" "flarecog-storage-metadata"
create_kv_namespace "TASK_RESULTS" "flarecog-task-results"
create_kv_namespace "TENANT_REGISTRY" "flarecog-tenant-registry"
create_kv_namespace "USAGE_TRACKER" "flarecog-usage-tracker"
create_kv_namespace "SHARED_KNOWLEDGE" "flarecog-shared-knowledge"
create_kv_namespace "KV_WARM_STORAGE" "flarecog-warm-storage"

# Create R2 buckets
echo "🪣 R2 Buckets"
echo "-------------"
create_r2_bucket "R2_COLD_STORAGE" "flarecog-cold-storage"

# Create Queues
echo "📬 Queues"
echo "---------"
create_queue "flarecog-cognitive-queue"
create_queue "flarecog-priority-queue"
create_queue "flarecog-inference-queue"
create_queue "flarecog-consolidation-queue"
create_queue "flarecog-coordination-queue"
create_queue "flarecog-dlq"

echo ""
echo "✅ Resource creation complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Copy the IDs from above into your wrangler.toml"
echo "2. Or use the generated wrangler.v6.toml as a template"
echo "3. Run 'wrangler deploy' to deploy FlareCog v6.0"
echo ""
echo "🔍 To verify resources:"
echo "   wrangler kv:namespace list"
echo "   wrangler r2 bucket list"
echo "   wrangler d1 list"
echo "   wrangler queues list"
echo ""
