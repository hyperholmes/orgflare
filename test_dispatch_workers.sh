#!/bin/bash
# Test FlareCog dispatch workers

echo "🧪 Testing FlareCog Dispatch Workers"
echo "======================================"
echo ""

ACCOUNT_ID="d1fcd8dbbd35aec43e5499200f6baede"
NAMESPACE="flarecog"

# Test each tenant worker
for TENANT in "demo-tenant" "research-tenant" "production-tenant"; do
  echo "Testing $TENANT..."
  
  # Invoke via dispatch namespace
  RESPONSE=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/dispatch/namespaces/${NAMESPACE}/scripts/${TENANT}" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://worker.example.com/", "method": "GET"}')
  
  echo "Response: $RESPONSE" | jq '.'
  echo ""
done

echo "✅ Testing complete!"
