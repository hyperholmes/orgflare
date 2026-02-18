import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";

describe("FlareCog OpenCog Platform", () => {
	beforeAll(async () => {
		// Any setup needed
	});

	it("should respond to health check", async () => {
		const response = await SELF.fetch("http://example.com/health");
		expect(response.status).toBe(200);

		const result = await response.json();
		expect(result.status).toBe("healthy");
		expect(result.platform).toBe("FlareCog OpenCog Platform");
	});

	it("should serve the main page", async () => {
		const response = await SELF.fetch("http://example.com/");
		expect(response.status).toBe(200);

		const html = await response.text();
		expect(html).toContain("FlareCog");
		expect(html).toContain("AtomSpace");
		expect(html).toContain("MindAgents");
	});

	it("should provide dashboard API", async () => {
		const response = await SELF.fetch("http://example.com/api/dashboard");
		expect(response.status).toBe(200);

		const dashboard = await response.json();
		expect(dashboard).toHaveProperty("atomSpace");
		expect(dashboard).toHaveProperty("mindAgents");
		expect(dashboard).toHaveProperty("goals");
		expect(dashboard).toHaveProperty("performance");
	});

	it("should handle cognitive perception", async () => {
		const response = await SELF.fetch(
			"http://example.com/api/cognitive/perceive",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: "test perception", inputType: "text" }),
			},
		);

		expect(response.status).toBe(200);
		const result = await response.json();
		expect(result.success).toBe(true);
		expect(result.message).toContain("perceived");
	});

	it("should handle AI reasoning (or gracefully fail without AI binding)", async () => {
		const response = await SELF.fetch(
			"http://example.com/api/cognitive/reason",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query: "What is cognition?",
					context: "test context",
				}),
			},
		);

		const result = await response.json();

		// AI reasoning may fail without AI binding in test environment
		if (response.status === 200) {
			expect(result.success).toBe(true);
			expect(result).toHaveProperty("reasoning");
		} else {
			// Accept 500 with error message when AI is unavailable
			expect(response.status).toBe(500);
			expect(result).toHaveProperty("success", false);
		}
	});
});
