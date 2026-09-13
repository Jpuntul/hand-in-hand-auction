import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
	it("allows valid relative paths starting with /", () => {
		expect(safeRedirectPath("/x")).toBe("/x");
		expect(safeRedirectPath("/admin/items")).toBe("/admin/items");
	});

	it("rejects protocol-relative URLs starting with //", () => {
		expect(safeRedirectPath("//evil.com")).toBe("/admin");
		expect(safeRedirectPath("//evil.com", "/fallback")).toBe("/fallback");
	});

	it("rejects absolute URLs starting with http:// or https://", () => {
		expect(safeRedirectPath("https://evil.com")).toBe("/admin");
		expect(safeRedirectPath("http://evil.com")).toBe("/admin");
	});

	it("rejects backslash-prefixed paths like /\\evil", () => {
		expect(safeRedirectPath("/\\evil.com")).toBe("/admin");
	});

	it("returns fallback for undefined, null, non-strings, or empty string", () => {
		expect(safeRedirectPath(undefined)).toBe("/admin");
		expect(safeRedirectPath(null)).toBe("/admin");
		expect(safeRedirectPath("")).toBe("/admin");
		expect(safeRedirectPath(123)).toBe("/admin");
		expect(safeRedirectPath({}, "/home")).toBe("/home");
	});
});
