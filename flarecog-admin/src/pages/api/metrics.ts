import { MetricsService } from "@/lib/services/metrics";
import {
	validateApiTokenResponse,
	jsonResponse,
	errorResponse,
} from "@/lib/api";

export async function GET({ locals, request, url }) {
	const { API_TOKEN, DB } = locals.runtime.env;

	const invalidTokenResponse = await validateApiTokenResponse(
		request,
		API_TOKEN,
	);
	if (invalidTokenResponse) return invalidTokenResponse;

	const metricsService = new MetricsService(DB);

	// Check for query parameters
	const tenantId = url.searchParams.get("tenant_id");
	const startTime = url.searchParams.get("start_time");
	const endTime = url.searchParams.get("end_time");
	const limit = url.searchParams.get("limit");
	const summary = url.searchParams.get("summary");
	const platform = url.searchParams.get("platform");

	try {
		if (platform === "true") {
			// Platform-wide summary
			const days = parseInt(url.searchParams.get("days") || "30");
			const platformSummary =
				await metricsService.getPlatformSummary(days);
			return jsonResponse({ summary: platformSummary });
		}

		if (summary === "true" && tenantId) {
			// Tenant summary
			const days = parseInt(url.searchParams.get("days") || "30");
			const tenantSummary = await metricsService.getTenantSummary(
				tenantId,
				days,
			);
			return jsonResponse({ summary: tenantSummary });
		}

		if (tenantId) {
			// Get metrics for specific tenant
			const options: any = {};
			if (startTime) options.startTime = parseInt(startTime);
			if (endTime) options.endTime = parseInt(endTime);
			if (limit) options.limit = parseInt(limit);

			const metrics = await metricsService.getByTenant(
				tenantId,
				options,
			);
			return jsonResponse({ metrics, count: metrics.length });
		}

		return errorResponse("Missing required parameter: tenant_id", 400);
	} catch (error) {
		return errorResponse(
			"Failed to fetch metrics",
			500,
			error.message,
		);
	}
}

export async function POST({ locals, request }) {
	const { API_TOKEN, DB } = locals.runtime.env;

	const invalidTokenResponse = await validateApiTokenResponse(
		request,
		API_TOKEN,
	);
	if (invalidTokenResponse) return invalidTokenResponse;

	const metricsService = new MetricsService(DB);

	try {
		const body = await request.json();

		// Validate required fields
		if (!body.tenant_id) {
			return errorResponse("Missing required field: tenant_id", 400);
		}

		// Set timestamp if not provided
		if (!body.timestamp) {
			body.timestamp = Date.now();
		}

		const result = await metricsService.record(body);

		return jsonResponse(
			{
				message: "Metrics recorded successfully",
				success: true,
				metric_id: result.metricId,
			},
			201,
		);
	} catch (error) {
		return errorResponse(
			"Failed to record metrics",
			500,
			error.message,
		);
	}
}
