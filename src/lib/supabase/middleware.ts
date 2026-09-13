import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({ request });

	const supabase = createServerClient<Database>(
		getEnv("NEXT_PUBLIC_SUPABASE_URL"),
		getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					supabaseResponse = NextResponse.next({ request });
					for (const { name, value, options } of cookiesToSet) {
						supabaseResponse.cookies.set(name, value, options);
					}
				},
			},
		},
	);

	// Refresh expired tokens. Must be called before any auth-dependent logic.
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const pathname = request.nextUrl.pathname;

	// Admin routes: require auth (admin role check happens in AdminGuard server component).
	// /admin/login is exempt so unauthenticated users can reach the sign-in form.
	if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !user) {
		const url = request.nextUrl.clone();
		url.pathname = "/admin/login";
		url.searchParams.set("redirect", pathname);
		return NextResponse.redirect(url);
	}

	return supabaseResponse;
}
