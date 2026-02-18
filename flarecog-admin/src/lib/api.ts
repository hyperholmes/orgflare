export async function validateApiTokenResponse(
	request: Request,
	API_TOKEN: string,
) {
	const authHeader = request.headers.get("Authorization");

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return new Response(
			JSON.stringify({
				error: "Missing or invalid Authorization header",
				message: "Please provide a valid Bearer token",
			}),
			{
				status: 401,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const token = authHeader.substring(7);

	if (token !== API_TOKEN) {
		return new Response(
			JSON.stringify({
				error: "Invalid API token",
				message: "The provided token is not valid",
			}),
			{
				status: 401,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	return null; // Valid token
}

export function jsonResponse(data: any, status: number = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export function errorResponse(
	message: string,
	status: number = 500,
	details?: any,
) {
	return jsonResponse(
		{
			error: message,
			...(details && { details }),
		},
		status,
	);
}
