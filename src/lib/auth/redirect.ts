export function safeRedirectPath(p: unknown, fallback = "/admin"): string {
	if (
		typeof p === "string" &&
		p.startsWith("/") &&
		!p.startsWith("//") &&
		!p.startsWith("/\\")
	) {
		return p;
	}
	return fallback;
}
