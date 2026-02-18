import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		include: [
			"test/**/*.test.ts",
			"tests/**/*.test.ts",
			"src/tests/**/*.test.ts",
			"src/**/__tests__/**/*.test.ts"
		],
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.json" },
			},
		},
		globals: true,
	},
});
