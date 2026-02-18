import { TenantService } from "@/lib/services/tenant";
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

	const tenantService = new TenantService(DB);

	// Check for query parameters
	const tier = url.searchParams.get("tier");
	const status = url.searchParams.get("status");

	try {
		let tenants;

		if (tier) {
			tenants = await tenantService.getAllByTier(tier);
		} else if (status) {
			tenants = await tenantService.getAllByStatus(status);
		} else {
			tenants = await tenantService.getAll();
		}

		return jsonResponse({ tenants, count: tenants.length });
	} catch (error) {
		return errorResponse(
			"Failed to fetch tenants",
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

	const tenantService = new TenantService(DB);

	try {
		const body = await request.json();

		// Validate required fields
		if (!body.id || !body.name) {
			return errorResponse("Missing required fields: id, name", 400);
		}

		// Generate API key if not provided
		if (!body.api_key) {
			body.api_key = crypto.randomUUID();
		}

		const result = await tenantService.create(body);

		return jsonResponse(
			{
				message: "Tenant created successfully",
				success: true,
				tenant_id: result.tenantId,
			},
			201,
		);
	} catch (error) {
		return errorResponse(
			"Failed to create tenant",
			500,
			error.message,
		);
	}
}
