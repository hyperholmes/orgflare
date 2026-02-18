/**
 * FlareCog End-to-End Testing Workflow
 * 
 * Comprehensive testing suite that validates:
 * - Platform deployment
 * - Tenant provisioning
 * - Cognitive operations
 * - MCP integration
 * - WebSocket streaming
 * - Admin dashboard
 * - Python API client
 */

import { execSync } from "child_process";
import * as assert from "assert";

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Test helper function
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  console.log(`\n🧪 Test: ${name}`);
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    console.log(`✅ PASSED (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, duration, error: errorMessage });
    console.log(`❌ FAILED (${duration}ms): ${errorMessage}`);
  }
}

/**
 * Test 1: Platform Deployment
 */
async function test1_PlatformDeployment() {
  await runTest("Platform Deployment", async () => {
    // Check if dispatch Worker is deployed
    const response = await fetch("https://flarecog-dispatch.workers.dev/health");
    assert.strictEqual(response.ok, true, "Dispatch Worker not responding");
    
    const data = await response.json();
    assert.strictEqual(data.status, "healthy", "Dispatch Worker unhealthy");
  });
}

/**
 * Test 2: Tenant Provisioning
 */
async function test2_TenantProvisioning() {
  await runTest("Tenant Provisioning", async () => {
    const response = await fetch("https://platform.flarecog.ai/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: "test-tenant",
        name: "Test Tenant",
        tier: "free",
      }),
    });
    
    assert.strictEqual(response.ok, true, "Tenant creation failed");
    
    const data = await response.json();
    assert.strictEqual(data.tenantId, "test-tenant", "Tenant ID mismatch");
    assert.ok(data.workerUrl, "Worker URL not provided");
  });
}

/**
 * Test 3: Cognitive Operations - Perceive
 */
async function test3_CognitivePerceive() {
  await runTest("Cognitive Operations - Perceive", async () => {
    const response = await fetch("https://test-tenant.flarecog.ai/cognitive/perceive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Artificial intelligence is transforming technology",
      }),
    });
    
    assert.strictEqual(response.ok, true, "Perceive operation failed");
    
    const data = await response.json();
    assert.strictEqual(data.success, true, "Perceive not successful");
    assert.ok(data.concepts, "No concepts extracted");
  });
}

/**
 * Test 4: Cognitive Operations - Reason
 */
async function test4_CognitiveReason() {
  await runTest("Cognitive Operations - Reason", async () => {
    const response = await fetch("https://test-tenant.flarecog.ai/reasoning/infer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        premises: ["ImplicationLink(A, B)", "ImplicationLink(B, C)"],
        rule: "deduction",
      }),
    });
    
    assert.strictEqual(response.ok, true, "Reason operation failed");
    
    const data = await response.json();
    assert.strictEqual(data.success, true, "Reasoning not successful");
    assert.ok(data.inferences, "No inferences generated");
  });
}

/**
 * Test 5: AtomSpace Operations
 */
async function test5_AtomSpaceOperations() {
  await runTest("AtomSpace Operations", async () => {
    // Create atom
    const createResponse = await fetch("https://test-tenant.flarecog.ai/atomspace/atoms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ConceptNode",
        name: "TestConcept",
        truthValue: { strength: 0.9, confidence: 0.8 },
      }),
    });
    
    assert.strictEqual(createResponse.ok, true, "Atom creation failed");
    
    const createData = await createResponse.json();
    const atomId = createData.id;
    
    // Query atom
    const queryResponse = await fetch("https://test-tenant.flarecog.ai/atomspace/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "ConceptNode",
        name: "TestConcept",
      }),
    });
    
    assert.strictEqual(queryResponse.ok, true, "Atom query failed");
    
    const queryData = await queryResponse.json();
    assert.ok(queryData.atoms.length > 0, "Atom not found");
    assert.strictEqual(queryData.atoms[0].id, atomId, "Atom ID mismatch");
  });
}

/**
 * Test 6: MCP Integration
 */
async function test6_MCPIntegration() {
  await runTest("MCP Integration", async () => {
    // Connect to MCP server
    const connectResponse = await fetch("https://test-tenant.flarecog.ai/mcp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverUrl: "https://mcp-demo.example.com",
      }),
    });
    
    assert.strictEqual(connectResponse.ok, true, "MCP connection failed");
    
    const connectData = await connectResponse.json();
    assert.strictEqual(connectData.success, true, "MCP connection not successful");
    
    // List tools
    const toolsResponse = await fetch("https://test-tenant.flarecog.ai/mcp/tools");
    assert.strictEqual(toolsResponse.ok, true, "MCP tools listing failed");
    
    const toolsData = await toolsResponse.json();
    assert.ok(toolsData.tools, "No tools available");
  });
}

/**
 * Test 7: WebSocket Streaming
 */
async function test7_WebSocketStreaming() {
  await runTest("WebSocket Streaming", async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket("wss://test-tenant.flarecog.ai");
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("WebSocket connection timeout"));
      }, 5000);
      
      ws.onopen = () => {
        console.log("  WebSocket connected");
        
        // Send operation
        ws.send(JSON.stringify({
          type: "operation",
          data: { operation: "query", input: { type: "ConceptNode" } },
          timestamp: Date.now(),
        }));
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("  Received message:", message.type);
        
        if (message.type === "result") {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error("WebSocket error"));
      };
    });
  });
}

/**
 * Test 8: Admin Dashboard
 */
async function test8_AdminDashboard() {
  await runTest("Admin Dashboard", async () => {
    const response = await fetch("https://admin.flarecog.ai");
    assert.strictEqual(response.ok, true, "Admin dashboard not accessible");
    
    const html = await response.text();
    assert.ok(html.includes("FlareCog"), "Admin dashboard content invalid");
  });
}

/**
 * Test 9: Playground
 */
async function test9_Playground() {
  await runTest("Playground", async () => {
    const response = await fetch("https://playground.flarecog.ai");
    assert.strictEqual(response.ok, true, "Playground not accessible");
    
    const html = await response.text();
    assert.ok(html.includes("FlareCog"), "Playground content invalid");
  });
}

/**
 * Test 10: Python API Client
 */
async function test10_PythonAPIClient() {
  await runTest("Python API Client", async () => {
    // Run Python test script
    const output = execSync(
      `python3 -c "from flarecog_api import FlareCogAPI; client = FlareCogAPI(); print('OK')"`,
      { encoding: "utf-8" }
    );
    
    assert.ok(output.includes("OK"), "Python API client import failed");
  });
}

/**
 * Test 11: Metrics and Analytics
 */
async function test11_MetricsAndAnalytics() {
  await runTest("Metrics and Analytics", async () => {
    const response = await fetch("https://platform.flarecog.ai/api/metrics?tenantId=test-tenant");
    assert.strictEqual(response.ok, true, "Metrics API failed");
    
    const data = await response.json();
    assert.ok(data.metrics, "No metrics returned");
    assert.ok(typeof data.metrics.totalAtoms === "number", "Invalid metrics format");
  });
}

/**
 * Test 12: Tenant Cleanup
 */
async function test12_TenantCleanup() {
  await runTest("Tenant Cleanup", async () => {
    const response = await fetch("https://platform.flarecog.ai/api/tenants/test-tenant", {
      method: "DELETE",
    });
    
    assert.strictEqual(response.ok, true, "Tenant deletion failed");
  });
}

/**
 * Print test summary
 */
function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));
  
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  
  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.name}: ${r.error}`);
      });
  }
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  console.log(`\n⏱️  Total Duration: ${totalDuration}ms`);
}

/**
 * Main test runner
 */
async function main() {
  console.log("🚀 FlareCog End-to-End Testing");
  console.log("=".repeat(60));
  
  // Run all tests
  await test1_PlatformDeployment();
  await test2_TenantProvisioning();
  await test3_CognitivePerceive();
  await test4_CognitiveReason();
  await test5_AtomSpaceOperations();
  await test6_MCPIntegration();
  await test7_WebSocketStreaming();
  await test8_AdminDashboard();
  await test9_Playground();
  await test10_PythonAPIClient();
  await test11_MetricsAndAnalytics();
  await test12_TenantCleanup();
  
  // Print summary
  printSummary();
  
  // Exit with appropriate code
  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  main();
}

export { runTest, results };
