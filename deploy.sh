#!/bin/bash
set -e

echo "Deploying FlareCog from flarecog directory..."
cd flarecog
npx wrangler deploy "$@"
