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
		const stats = await tenantService.getStats(id);

		return jsonResponse({ stats });
	} catch (error) {
		return errorResponse(
			"Failed to fetch tenant stats",
			500,
			error.message,
		);
	}
}
