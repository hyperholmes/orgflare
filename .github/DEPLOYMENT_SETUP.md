# FlareCog GitHub Actions Deployment Setup

This document explains how to configure GitHub Actions for automated deployments of FlareCog v6.0 to Cloudflare Workers.

## Required Secrets

You need to add the following secrets to your GitHub repository:

### 1. CLOUDFLARE_API_TOKEN

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Add the following permissions:
   - Account > Workers Scripts > Edit
   - Account > Workers KV Storage > Edit
   - Account > Workers R2 Storage > Edit
   - Account > D1 > Edit
5. Copy the generated token
6. Go to your GitHub repository settings → Secrets and variables → Actions
7. Click "New repository secret"
8. Name: `CLOUDFLARE_API_TOKEN`
9. Value: Paste the token
10. Click "Add secret"

### 2. CLOUDFLARE_ACCOUNT_ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your account
3. Copy the Account ID from the right sidebar (or from the URL)
4. Go to your GitHub repository settings → Secrets and variables → Actions
5. Click "New repository secret"
6. Name: `CLOUDFLARE_ACCOUNT_ID`
7. Value: Paste the account ID
8. Click "Add secret"

## Workflow Files

### `deploy.yml` - Main Deployment Workflow

This workflow automatically deploys FlareCog when you push to the `main` branch or manually trigger it.

**Jobs:**

1. **deploy-main-worker**: Deploys the main FlareCog worker
2. **deploy-dispatch-workers**: Deploys tenant workers to the dispatch namespace
3. **notify-completion**: Sends deployment summary

**Triggers:**

- Push to `main` branch (automatic)
- Manual workflow dispatch (Actions tab → Deploy FlareCog → Run workflow)

## Manual Deployment

You can manually trigger a deployment:

1. Go to the "Actions" tab in your GitHub repository
2. Click on "Deploy FlareCog to Cloudflare"
3. Click "Run workflow"
4. Select the branch (usually `main`)
5. Choose the environment (production or staging)
6. Click "Run workflow"

## Deployment Process

When a deployment is triggered:

1. **Checkout**: Repository code is checked out
2. **Setup**: Node.js and pnpm are installed
3. **Install**: Dependencies are installed with `pnpm install`
4. **Deploy Main**: Main worker is deployed to `flarecog.d-d1f.workers.dev`
5. **Deploy Tenants**: Three tenant workers are deployed to the dispatch namespace:
   - `demo-tenant` (ID: demo-001)
   - `research-tenant` (ID: research-001)
   - `production-tenant` (ID: prod-001)
6. **Summary**: Deployment summary is generated

## Monitoring Deployments

- View deployment logs in the "Actions" tab
- Each deployment shows a summary with:
  - Repository and branch information
  - Commit SHA
  - Worker URLs
  - Tenant deployment status

## Troubleshooting

### Deployment Fails with "Authentication error"

- Check that `CLOUDFLARE_API_TOKEN` is correctly set
- Verify the token has the required permissions
- Make sure the token hasn't expired

### Deployment Fails with "Account not found"

- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Check that the API token has access to the account

### Worker Deployment Succeeds but Doesn't Update

- Check that you're pushing to the `main` branch
- Verify the workflow file is in `.github/workflows/deploy.yml`
- Check the Actions tab for workflow run status

## Next Steps

After setting up GitHub Actions:

1. Add the required secrets to your repository
2. Push a commit to `main` to trigger the first automated deployment
3. Verify the deployment in the Cloudflare dashboard
4. Check that the repository metadata is now correct (`o9nn/flarecog`)

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
