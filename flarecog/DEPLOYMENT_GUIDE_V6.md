# FlareCog v6.0 Deployment Guide

**Date:** December 25, 2025  
**Version:** 6.0.0

This guide provides step-by-step instructions for deploying FlareCog v6.0, including setting up the required Cloudflare resources and configuring the environment.

## 1. Prerequisites

Before you begin, ensure you have the following installed and configured:

*   **Node.js and pnpm:** FlareCog is a TypeScript project and uses pnpm for dependency management.
*   **Wrangler CLI:** The Cloudflare command-line tool for managing Workers projects. Make sure you are logged in to your Cloudflare account (`wrangler login`).
*   **Git:** For cloning the repository.

## 2. Clone the Repository

Clone the FlareCog repository to your local machine:

```bash
git clone https://github.com/o9nn/flarecog.git
cd flarecog/flarecog
```

## 3. Install Dependencies

Install the project dependencies using pnpm:

```bash
pnpm install
```

## 4. Create Cloudflare Resources

FlareCog v6.0 requires a number of new Cloudflare resources, including KV namespaces, R2 buckets, and Queues. A script has been provided to automate the creation of these resources.

Run the setup script:

```bash
./scripts/setup-cloudflare-resources.sh
```

This script will output the IDs for each created resource. **You will need these IDs for the next step.**

## 5. Configure `wrangler.toml`

A template configuration file, `wrangler.v6.toml`, has been created with all the necessary bindings for v6.0. You should rename this file to `wrangler.toml` and replace the placeholder IDs with the actual IDs generated in the previous step.

1.  **Rename the file:**

    ```bash
    mv wrangler.v6.toml wrangler.toml
    ```

2.  **Update the IDs:**

    Open `wrangler.toml` in a text editor and replace all placeholder IDs (e.g., `YOUR_KV_NAMESPACE_ID`, `YOUR_D1_DATABASE_ID`) with the corresponding IDs from the output of the setup script.

    **Example:**

    If the script output for a KV namespace was:

    ```
    [[kv_namespaces]]
    binding = "STORAGE_METADATA"
    id = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
    preview_id = "f1e2d3c4b5a6f7e8d9c0b1a2c3d4e5f6"
    ```

    You would update the corresponding section in `wrangler.toml`.

## 6. Deploy to Cloudflare

Once your `wrangler.toml` is correctly configured, you can deploy FlareCog to your Cloudflare account:

```bash
wrangler deploy
```

This command will build the project, upload the worker, and apply all the configurations defined in `wrangler.toml`.

## 7. Verify the Deployment

After a successful deployment, you can verify that the v6.0 components are operational by accessing the new API endpoints.

**Health Check:**

Access the health check endpoint to confirm that all components are running:

```bash
curl https://<your-worker-url>/api/v6/health
```

You should receive a JSON response indicating a `healthy` status for all v6.0 components.

**Tenant Creation:**

Test the multi-tenancy system by creating a new tenant:

```bash
curl -X POST https://<your-worker-url>/api/v6/tenant/create \
  -H "Content-Type: application/json" \
  -d 
{
  "tenantId": "test-tenant",
  "name": "Test Tenant",
  "tier": "pro",
  "quotas": {
    "maxAtoms": 10000,
    "maxQueries": 1000,
    "maxAgentExecutions": 100,
    "maxStorageMB": 100
  },
  "features": {
    "distributedQuery": true,
    "aiEnhancement": true,
    "customAgents": true,
    "federatedLearning": false,
    "sharedKnowledge": true
  },
  "isolation": "strict"
}
'
```

A successful response will contain the details of the newly created tenant's AtomSpace.

## 8. Troubleshooting

*   **Resource Creation Errors:** If the setup script fails, it may be due to naming conflicts. You can manually create the resources via the Cloudflare dashboard and update `wrangler.toml` accordingly.
*   **Deployment Failures:** Check the output of `wrangler deploy` for specific error messages. Common issues include incorrect `wrangler.toml` configuration or authentication problems.
*   **Endpoint Errors:** If you receive errors when accessing the API endpoints, check the worker logs in the Cloudflare dashboard for more details (`wrangler tail`).
