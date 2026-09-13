import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const supabaseHostname = new URL(
	process.env.NEXT_PUBLIC_SUPABASE_URL ??
		"https://raxaicqhlbmyzngcubye.supabase.co",
).hostname;

const nextConfig: NextConfig = {
	reactCompiler: true,
	images: {
		remotePatterns: [
			// Supabase Storage public URLs
			{
				protocol: "https",
				hostname: supabaseHostname,
				pathname: "/storage/v1/object/public/**",
			},
		],
	},
};

export default withSentryConfig(nextConfig, {
	silent: true,
});
