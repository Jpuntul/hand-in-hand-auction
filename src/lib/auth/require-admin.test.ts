import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentProfile } from "@/lib/auth/queries";
import { requireAdmin } from "./require-admin";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/queries", () => ({
	getCurrentProfile: vi.fn(),
}));

describe("requireAdmin", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("throws Forbidden if current profile is null", async () => {
		vi.mocked(getCurrentProfile).mockResolvedValue(null);

		await expect(requireAdmin()).rejects.toThrow("Forbidden");
	});

	it("throws Forbidden if current profile is not an admin", async () => {
		vi.mocked(getCurrentProfile).mockResolvedValue({
			id: "user-1",
			email: "bidder@example.com",
			display_name: "Bidder",
			phone: null,
			is_admin: false,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		await expect(requireAdmin()).rejects.toThrow("Forbidden");
	});

	it("returns profile if user is an admin", async () => {
		const adminProfile = {
			id: "admin-1",
			email: "admin@example.com",
			display_name: "Admin",
			phone: "1234567890",
			is_admin: true,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};
		vi.mocked(getCurrentProfile).mockResolvedValue(adminProfile);

		const result = await requireAdmin();
		expect(result).toEqual(adminProfile);
	});
});
