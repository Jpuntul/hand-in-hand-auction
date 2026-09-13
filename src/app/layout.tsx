import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
	variable: "--font-sans",
	subsets: ["latin"],
});

const playfair = Playfair_Display({
	variable: "--font-heading",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
	title: "Hand in Hand for Myanmar — Charity Auction",
	description: "Real-time charity auction supporting Myanmar relief efforts.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${inter.variable} ${playfair.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<Providers>{children}</Providers>
				<Toaster richColors closeButton />
			</body>
		</html>
	);
}
