import { BillingService } from "@/lib/services/billing";
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

	const billingService = new BillingService(DB);

	// Check for query parameters
	const tenantId = url.searchParams.get("tenant_id");
	const startTime = url.searchParams.get("start_time");
	const endTime = url.searchParams.get("end_time");
	const eventType = url.searchParams.get("event_type");
	const limit = url.searchParams.get("limit");
	const summary = url.searchParams.get("summary");
	const revenue = url.searchParams.get("revenue");
	const tiers = url.searchParams.get("tiers");

	try {
		if (tiers === "true") {
			// Get subscription tiers
			const subscriptionTiers =
				await billingService.getSubscriptionTiers();
			return jsonResponse({ tiers: subscriptionTiers });
		}

		if (revenue === "true") {
			// Platform revenue summary
			const days = parseInt(url.searchParams.get("days") || "30");
			const revenueData =
				await billingService.getPlatformRevenue(days);
			return jsonResponse({ revenue: revenueData });
		}

		if (summary === "true" && tenantId) {
			// Tenant billing summary
			const days = parseInt(url.searchParams.get("days") || "30");
			const tenantSummary = await billingService.getTenantSummary(
				tenantId,
				days,
			);
			return jsonResponse({ summary: tenantSummary });
		}

		if (tenantId) {
			// Get billing events for specific tenant
			const options: any = {};
			if (startTime) options.startTime = parseInt(startTime);
			if (endTime) options.endTime = parseInt(endTime);
			if (eventType) options.eventType = eventType;
			if (limit) options.limit = parseInt(limit);

			const events = await billingService.getByTenant(
				tenantId,
				options,
			);
			return jsonResponse({ events, count: events.length });
		}

		return errorResponse("Missing required parameter: tenant_id", 400);
	} catch (error) {
		return errorResponse(
			"Failed to fetch billing data",
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

	const billingService = new BillingService(DB);

	try {
		const body = await request.json();

		// Validate required fields
		if (!body.tenant_id || !body.event_type) {
			return errorResponse(
				"Missing required fields: tenant_id, event_type",
				400,
			);
		}

		const result = await billingService.recordEvent(body);

		return jsonResponse(
			{
				message: "Billing event recorded successfully",
				success: true,
				event_id: result.eventId,
			},
			201,
		);
	} catch (error) {
		return errorResponse(
			"Failed to record billing event",
			500,
			error.message,
		);
	}
}
