/**
 * Automated FlareCog Platform Deployment Script
 * 
 * Uses CloudFlare MCP to deploy the entire FlareCog platform:
 * - Dispatch namespace
 * - Dispatch Worker
 * - Platform API
 * - Admin dashboard
 * - Demo tenant
 * 
 * Prerequisites:
 * - CloudFlare API token (CLOUDFLARE_API_TOKEN)
 * - CloudFlare account ID (CLOUDFLARE_ACCOUNT_ID)
 * - MCP CLI configured
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface DeploymentConfig {
  accountId: string;
  dispatchNamespace: string;
  platformDomain: string;
  adminDomain: string;
  playgroundDomain: string;
}

const config: DeploymentConfig = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID || "",
  dispatchNamespace: "flarecog",
  platformDomain: "platform.flarecog.ai",
  adminDomain: "admin.flarecog.ai",
  playgroundDomain: "playground.flarecog.ai",
};

/**
 * Execute MCP tool via CLI
 */
function executeMCPTool(toolName: string, args: any): any {
  console.log(`\n🔧 Executing MCP tool: ${toolName}`);
  
  const argsJson = JSON.stringify(args);
  const command = `manus-mcp-cli tool call ${toolName} --server cloudflare --input '${argsJson}'`;
  
  try {
    const output = execSync(command, { encoding: "utf-8" });
    console.log(`✅ ${toolName} completed`);
    
    // Parse JSON output
    const lines = output.split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("{")) {
        return JSON.parse(line);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`❌ ${toolName} failed:`, error);
    throw error;
  }
}

/**
 * Step 1: Create dispatch namespace
 */
async function createDispatchNamespace() {
  console.log("\n📦 Step 1: Creating dispatch namespace...");
  
  try {
    const result = executeMCPTool("dispatch_namespace_create", {
      name: config.dispatchNamespace,
    });
    
    console.log(`✅ Dispatch namespace '${config.dispatchNamespace}' created`);
    return result;
  } catch (error) {
    console.log(`ℹ️  Dispatch namespace may already exist, continuing...`);
  }
}

/**
 * Step 2: Create D1 database for platform
 */
async function createPlatformDatabase() {
  console.log("\n💾 Step 2: Creating platform database...");
  
  const result = executeMCPTool("d1_database_create", {
    name: "flarecog_platform",
  });
  
  const dbId = result.result?.uuid || result.uuid;
  console.log(`✅ Platform database created: ${dbId}`);
  
  return dbId;
}

/**
 * Step 3: Create KV namespace for platform
 */
async function createPlatformKV() {
  console.log("\n🗄️  Step 3: Creating platform KV namespace...");
  
  const result = executeMCPTool("kv_namespace_create", {
    title: "flarecog_platform_cache",
  });
  
  const kvId = result.result?.id || result.id;
  console.log(`✅ Platform KV namespace created: ${kvId}`);
  
  return kvId;
}

/**
 * Step 4: Deploy dispatch Worker
 */
async function deployDispatchWorker(dbId: string, kvId: string) {
  console.log("\n🚀 Step 4: Deploying dispatch Worker...");
  
  // Read dispatch Worker code
  const workerPath = path.join(__dirname, "../flarecog-platform/dispatch-worker/src/index.ts");
  const workerCode = fs.readFileSync(workerPath, "utf-8");
  
  const result = executeMCPTool("worker_script_upload", {
    scriptName: "flarecog-dispatch",
    content: workerCode,
    bindings: [
      {
        type: "dispatch_namespace",
        name: "FLARECOG_NAMESPACE",
        namespace: config.dispatchNamespace,
      },
      {
        type: "d1_database",
        name: "DB",
        id: dbId,
      },
      {
        type: "kv_namespace",
        name: "CACHE",
        id: kvId,
      },
    ],
  });
  
  console.log(`✅ Dispatch Worker deployed`);
  return result;
}

/**
 * Step 5: Deploy platform API
 */
async function deployPlatformAPI(dbId: string, kvId: string) {
  console.log("\n🔌 Step 5: Deploying platform API...");
  
  const workerPath = path.join(__dirname, "../flarecog-platform/platform-api/src/index.ts");
  const workerCode = fs.readFileSync(workerPath, "utf-8");
  
  const result = executeMCPTool("worker_script_upload", {
    scriptName: "flarecog-platform-api",
    content: workerCode,
    bindings: [
      {
        type: "dispatch_namespace",
        name: "FLARECOG_NAMESPACE",
        namespace: config.dispatchNamespace,
      },
      {
        type: "d1_database",
        name: "DB",
        id: dbId,
      },
      {
        type: "kv_namespace",
        name: "CACHE",
        id: kvId,
      },
    ],
  });
  
  console.log(`✅ Platform API deployed`);
  return result;
}

/**
 * Step 6: Run database migrations
 */
async function runDatabaseMigrations(dbId: string) {
  console.log("\n📊 Step 6: Running database migrations...");
  
  const migrationsDir = path.join(__dirname, "../flarecog-admin/migrations");
  const migrations = fs.readdirSync(migrationsDir).sort();
  
  for (const migration of migrations) {
    if (!migration.endsWith(".sql")) continue;
    
    console.log(`  Running migration: ${migration}`);
    const sql = fs.readFileSync(path.join(migrationsDir, migration), "utf-8");
    
    executeMCPTool("d1_database_query", {
      databaseId: dbId,
      sql: sql,
    });
  }
  
  console.log(`✅ Database migrations completed`);
}

/**
 * Step 7: Deploy admin dashboard
 */
async function deployAdminDashboard() {
  console.log("\n🎨 Step 7: Deploying admin dashboard...");
  
  // Build admin dashboard
  const adminDir = path.join(__dirname, "../flarecog-admin");
  console.log("  Building admin dashboard...");
  execSync("npm run build", { cwd: adminDir, stdio: "inherit" });
  
  // Deploy to CloudFlare Pages
  console.log("  Deploying to CloudFlare Pages...");
  execSync(
    `npx wrangler pages deploy dist --project-name flarecog-admin`,
    { cwd: adminDir, stdio: "inherit" }
  );
  
  console.log(`✅ Admin dashboard deployed to ${config.adminDomain}`);
}

/**
 * Step 8: Deploy playground
 */
async function deployPlayground() {
  console.log("\n🎮 Step 8: Deploying playground...");
  
  // Build playground
  const playgroundDir = path.join(__dirname, "../flarecog-playground");
  console.log("  Building playground...");
  execSync("npm run build", { cwd: playgroundDir, stdio: "inherit" });
  
  // Deploy to CloudFlare Pages
  console.log("  Deploying to CloudFlare Pages...");
  execSync(
    `npx wrangler pages deploy dist --project-name flarecog-playground`,
    { cwd: playgroundDir, stdio: "inherit" }
  );
  
  console.log(`✅ Playground deployed to ${config.playgroundDomain}`);
}

/**
 * Step 9: Create demo tenant
 */
async function createDemoTenant() {
  console.log("\n👤 Step 9: Creating demo tenant...");
  
  // Create tenant using platform API
  const response = await fetch(`https://${config.platformDomain}/api/tenants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tenantId: "demo",
      name: "Demo Tenant",
      tier: "pro",
    }),
  });
  
  const result = await response.json();
  console.log(`✅ Demo tenant created: ${result.workerUrl}`);
  
  return result;
}

/**
 * Main deployment function
 */
async function main() {
  console.log("🚀 FlareCog Platform Deployment");
  console.log("================================\n");
  
  if (!config.accountId) {
    console.error("❌ CLOUDFLARE_ACCOUNT_ID environment variable is required");
    process.exit(1);
  }
  
  try {
    // Set active CloudFlare account
    console.log(`📋 Using CloudFlare account: ${config.accountId}`);
    executeMCPTool("set_active_account", { accountId: config.accountId });
    
    // Deploy infrastructure
    await createDispatchNamespace();
    const dbId = await createPlatformDatabase();
    const kvId = await createPlatformKV();
    
    // Deploy Workers
    await deployDispatchWorker(dbId, kvId);
    await deployPlatformAPI(dbId, kvId);
    
    // Setup database
    await runDatabaseMigrations(dbId);
    
    // Deploy UIs
    await deployAdminDashboard();
    await deployPlayground();
    
    // Create demo tenant
    await createDemoTenant();
    
    console.log("\n✅ FlareCog Platform Deployment Complete!");
    console.log("\n📍 Access Points:");
    console.log(`   Platform API: https://${config.platformDomain}`);
    console.log(`   Admin Dashboard: https://${config.adminDomain}`);
    console.log(`   Playground: https://${config.playgroundDomain}`);
    console.log(`   Demo Tenant: https://demo.flarecog.ai`);
    
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Run deployment
main();
