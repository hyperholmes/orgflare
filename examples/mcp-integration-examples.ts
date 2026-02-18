/**
 * FlareCog MCP Integration Examples
 * 
 * Demonstrates how to integrate FlareCog with various MCP servers:
 * - CloudFlare MCP (infrastructure management)
 * - Notion MCP (knowledge management)
 * - Sentry MCP (error tracking)
 * - Neon MCP (database management)
 * - Prisma Postgres MCP (database operations)
 * - Hugging Face MCP (AI model access)
 */

import { MCPClient } from "../flarecog-platform/user-worker-template/src/mcp-client";

// ========== Example 1: CloudFlare Infrastructure Management ==========

async function example1_CloudFlareInfrastructure() {
  console.log("\n📦 Example 1: CloudFlare Infrastructure Management");
  console.log("=".repeat(60));
  
  const mcpClient = new MCPClient();
  
  // Connect to CloudFlare MCP
  await mcpClient.connect("cloudflare://local", {
    type: "bearer",
    token: process.env.CLOUDFLARE_API_TOKEN!,
  });
  
  // List KV namespaces
  console.log("\n1. Listing KV namespaces...");
  const kvNamespaces = await mcpClient.executeTool(
    "cloudflare://local",
    "kv_namespaces_list",
    {}
  );
  console.log(`Found ${kvNamespaces.length} KV namespaces`);
  
  // Create a new KV namespace for cognitive cache
  console.log("\n2. Creating cognitive cache KV namespace...");
  const newKv = await mcpClient.executeTool(
    "cloudflare://local",
    "kv_namespace_create",
    { title: "flarecog_cognitive_cache" }
  );
  console.log(`Created KV namespace: ${newKv.id}`);
  
  // List D1 databases
  console.log("\n3. Listing D1 databases...");
  const databases = await mcpClient.executeTool(
    "cloudflare://local",
    "d1_databases_list",
    {}
  );
  console.log(`Found ${databases.length} D1 databases`);
}

// ========== Example 2: Notion Knowledge Management ==========

async function example2_NotionKnowledgeManagement() {
  console.log("\n📚 Example 2: Notion Knowledge Management");
  console.log("=".repeat(60));
  
  const mcpClient = new MCPClient();
  
  // Connect to Notion MCP
  await mcpClient.connect("notion://local");
  
  // Search for cognitive computing pages
  console.log("\n1. Searching for 'cognitive computing' in Notion...");
  const searchResults = await mcpClient.executeTool(
    "notion://local",
    "notion-search",
    { query: "cognitive computing" }
  );
  console.log(`Found ${searchResults.length} pages`);
  
  // Create a new page for FlareCog documentation
  console.log("\n2. Creating FlareCog documentation page...");
  const newPage = await mcpClient.executeTool(
    "notion://local",
    "notion-create-page",
    {
      title: "FlareCog Platform Documentation",
      content: "# FlareCog\n\nCognitive computing platform on CloudFlare Workers.",
    }
  );
  console.log(`Created page: ${newPage.id}`);
  
  // Fetch page content
  console.log("\n3. Fetching page content...");
  const pageContent = await mcpClient.executeTool(
    "notion://local",
    "notion-fetch",
    { pageId: newPage.id }
  );
  console.log(`Page title: ${pageContent.title}`);
}

// ========== Example 3: Sentry Error Tracking ==========

async function example3_SentryErrorTracking() {
  console.log("\n🐛 Example 3: Sentry Error Tracking");
  console.log("=".repeat(60));
  
  const mcpClient = new MCPClient();
  
  // Connect to Sentry MCP
  await mcpClient.connect("sentry://local");
  
  // List projects
  console.log("\n1. Listing Sentry projects...");
  const projects = await mcpClient.executeTool(
    "sentry://local",
    "sentry-list-projects",
    {}
  );
  console.log(`Found ${projects.length} projects`);
  
  // Get recent issues for FlareCog project
  if (projects.length > 0) {
    console.log("\n2. Getting recent issues...");
    const issues = await mcpClient.executeTool(
      "sentry://local",
      "sentry-get-issues",
      { projectId: projects[0].id, limit: 10 }
    );
    console.log(`Found ${issues.length} recent issues`);
    
    // Analyze error patterns
    console.log("\n3. Analyzing error patterns...");
    const errorTypes = issues.map((issue: any) => issue.type);
    const uniqueErrors = [...new Set(errorTypes)];
    console.log(`Unique error types: ${uniqueErrors.join(", ")}`);
  }
}

// ========== Example 4: Neon Database Management ==========

async function example4_NeonDatabaseManagement() {
  console.log("\n🐘 Example 4: Neon Database Management");
  console.log("=".repeat(60));
  
  const mcpClient = new MCPClient();
  
  // Connect to Neon MCP
  await mcpClient.connect("neon://local");
  
  // List projects
  console.log("\n1. Listing Neon projects...");
  const projects = await mcpClient.executeTool(
    "neon://local",
    "neon-list-projects",
    {}
  );
  console.log(`Found ${projects.length} projects`);
  
  // Create a new branch for development
  if (projects.length > 0) {
    console.log("\n2. Creating development branch...");
    const branch = await mcpClient.executeTool(
      "neon://local",
      "neon-create-branch",
      {
        projectId: projects[0].id,
        name: "flarecog-dev",
      }
    );
    console.log(`Created branch: ${branch.id}`);
    
    // Execute SQL query
    console.log("\n3. Executing SQL query...");
    const result = await mcpClient.executeTool(
      "neon://local",
      "neon-execute-sql",
      {
        projectId: projects[0].id,
        branchId: branch.id,
        sql: "SELECT version();",
      }
    );
    console.log(`PostgreSQL version: ${result.rows[0].version}`);
  }
}

// ========== Example 5: Hugging Face AI Models ==========

async function example5_HuggingFaceAIModels() {
  console.log("\n🤗 Example 5: Hugging Face AI Models");
  console.log("=".repeat(60));
  
  const mcpClient = new MCPClient();
  
  // Connect to Hugging Face MCP
  await mcpClient.connect("hugging-face://local");
  
  // Search for cognitive models
  console.log("\n1. Searching for cognitive models...");
  const models = await mcpClient.executeTool(
    "hugging-face://local",
    "hf-search-models",
    { query: "cognitive", limit: 5 }
  );
  console.log(`Found ${models.length} models`);
  
  // Get model details
  if (models.length > 0) {
    console.log("\n2. Getting model details...");
    const modelDetails = await mcpClient.executeTool(
      "hugging-face://local",
      "hf-get-model",
      { modelId: models[0].id }
    );
    console.log(`Model: ${modelDetails.name}`);
    console.log(`Downloads: ${modelDetails.downloads}`);
    console.log(`Likes: ${modelDetails.likes}`);
  }
  
  // Search for datasets
  console.log("\n3. Searching for cognitive datasets...");
  const datasets = await mcpClient.executeTool(
    "hugging-face://local",
    "hf-search-datasets",
    { query: "reasoning", limit: 5 }
  );
  console.log(`Found ${datasets.length} datasets`);
}

// ========== Example 6: Integrated Cognitive Workflow ==========

async function example6_IntegratedCognitiveWorkflow() {
  console.log("\n🧠 Example 6: Integrated Cognitive Workflow");
  console.log("=".repeat(60));
  
  const mcpClient = new MCPClient();
  
  // Connect to multiple MCP servers
  console.log("\n1. Connecting to MCP servers...");
  await mcpClient.connect("cloudflare://local");
  await mcpClient.connect("notion://local");
  await mcpClient.connect("sentry://local");
  
  console.log(`Connected to ${mcpClient.getConnections().length} MCP servers`);
  
  // Get all available tools
  const allTools = mcpClient.getAllTools();
  console.log(`\n2. Available tools: ${allTools.length}`);
  
  // Cognitive workflow: Learn from errors and document insights
  console.log("\n3. Executing cognitive workflow...");
  
  // Step 1: Get recent errors from Sentry
  console.log("   - Fetching errors from Sentry...");
  const errors = await mcpClient.executeTool(
    "sentry://local",
    "sentry-get-issues",
    { limit: 5 }
  );
  
  // Step 2: Analyze error patterns (cognitive processing)
  console.log("   - Analyzing error patterns...");
  const errorSummary = {
    totalErrors: errors.length,
    errorTypes: [...new Set(errors.map((e: any) => e.type))],
    affectedUsers: errors.reduce((sum: number, e: any) => sum + e.userCount, 0),
  };
  
  // Step 3: Document insights in Notion
  console.log("   - Documenting insights in Notion...");
  await mcpClient.executeTool(
    "notion://local",
    "notion-create-page",
    {
      title: `Error Analysis - ${new Date().toISOString().split("T")[0]}`,
      content: `# Error Analysis\n\n**Total Errors:** ${errorSummary.totalErrors}\n**Error Types:** ${errorSummary.errorTypes.join(", ")}\n**Affected Users:** ${errorSummary.affectedUsers}`,
    }
  );
  
  // Step 4: Store metrics in CloudFlare KV
  console.log("   - Storing metrics in CloudFlare KV...");
  // (This would use KV write operations)
  
  console.log("\n✅ Cognitive workflow completed!");
}

// ========== Main Function ==========

async function main() {
  console.log("\n🚀 FlareCog MCP Integration Examples");
  console.log("=".repeat(60));
  
  try {
    // Run examples
    await example1_CloudFlareInfrastructure();
    await example2_NotionKnowledgeManagement();
    await example3_SentryErrorTracking();
    await example4_NeonDatabaseManagement();
    await example5_HuggingFaceAIModels();
    await example6_IntegratedCognitiveWorkflow();
    
    console.log("\n✅ All examples completed successfully!");
  } catch (error) {
    console.error("\n❌ Example failed:", error);
    process.exit(1);
  }
}

// Run examples
if (require.main === module) {
  main();
}

export {
  example1_CloudFlareInfrastructure,
  example2_NotionKnowledgeManagement,
  example3_SentryErrorTracking,
  example4_NeonDatabaseManagement,
  example5_HuggingFaceAIModels,
  example6_IntegratedCognitiveWorkflow,
};
