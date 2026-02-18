import { TenantService } from "@/lib/services/tenant";
import {
	validateApiTokenResponse,
	jsonResponse,
	errorResponse,
} from "@/lib/api";

type Params = {
	id: string;
};

export async function GET({
	locals,
	request,
	params,
}: {
	locals: App.Locals;
	request: Request;
	params: Params;
}) {
	const { API_TOKEN, DB } = locals.runtime.env;

	const invalidTokenResponse = await validateApiTokenResponse(
		request,
		API_TOKEN,
	);
	if (invalidTokenResponse) return invalidTokenResponse;

	const tenantService = new TenantService(DB);
	const { id } = params;

	try {
		const tenant = await tenantService.getById(id);

		if (!tenant) {
			return errorResponse("Tenant not found", 404);
		}

		return jsonResponse({ tenant });
	} catch (error) {
		return errorResponse("Failed to fetch tenant", 500, error.message);
	}
}

export async function PUT({
	locals,
	request,
	params,
}: {
	locals: App.Locals;
	request: Request;
	params: Params;
}) {
	const { API_TOKEN, DB } = locals.runtime.env;

	const invalidTokenResponse = await validateApiTokenResponse(
		request,
		API_TOKEN,
	);
	if (invalidTokenResponse) return invalidTokenResponse;

	const tenantService = new TenantService(DB);
	const { id } = params;

	try {
		const body = await request.json();

		const result = await tenantService.update(id, body);

		return jsonResponse({
			message: "Tenant updated successfully",
			success: result.success,
		});
	} catch (error) {
		return errorResponse("Failed to update tenant", 500, error.message);
	}
}

export async function DELETE({
	locals,
	request,
	params,
}: {
	locals: App.Locals;
	request: Request;
	params: Params;
}) {
	const { API_TOKEN, DB } = locals.runtime.env;

	const invalidTokenResponse = await validateApiTokenResponse(
		request,
		API_TOKEN,
	);
	if (invalidTokenResponse) return invalidTokenResponse;

	const tenantService = new TenantService(DB);
	const { id } = params;

	try {
		const result = await tenantService.delete(id);

		return jsonResponse({
			message: "Tenant deleted successfully",
			success: result.success,
		});
	} catch (error) {
		return errorResponse("Failed to delete tenant", 500, error.message);
	}
}
