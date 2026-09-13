import { describe, expect, it } from "vitest";
import { formatUsd, isExpired, minNextBid } from "./auction";

describe("formatUsd", () => {
	it("formats whole dollars without decimal places", () => {
		expect(formatUsd(100)).toBe("$100");
		expect(formatUsd("250")).toBe("$250");
		expect(formatUsd(0)).toBe("$0");
	});

	it("formats values with cents using two decimal places", () => {
		expect(formatUsd(100.5)).toBe("$100.50");
		expect(formatUsd("49.99")).toBe("$49.99");
	});

	it("returns a dash for null, undefined, or NaN", () => {
		expect(formatUsd(null)).toBe("—");
		expect(formatUsd(undefined)).toBe("—");
		expect(formatUsd("invalid")).toBe("—");
		expect(formatUsd(Number.NaN)).toBe("—");
	});
});

describe("minNextBid", () => {
	it("returns starting_bid when current_bid is null or undefined", () => {
		expect(
			minNextBid({
				current_bid: null,
				bid_increment: 10,
				starting_bid: 50,
			}),
		).toBe(50);
	});

	it("returns current_bid + bid_increment when current_bid exists", () => {
		expect(
			minNextBid({
				current_bid: 100,
				bid_increment: 15,
				starting_bid: 50,
			}),
		).toBe(115);
	});
});

describe("isExpired", () => {
	it("returns false if end_time is null", () => {
		expect(isExpired({ end_time: null }, Date.now())).toBe(false);
	});

	it("returns true if end_time has elapsed relative to now", () => {
		const endTime = new Date("2026-09-13T12:00:00Z").toISOString();
		const nowAfter = new Date("2026-09-13T12:00:01Z").getTime();
		expect(isExpired({ end_time: endTime }, nowAfter)).toBe(true);
	});

	it("returns true if end_time equals now", () => {
		const endTime = new Date("2026-09-13T12:00:00Z").toISOString();
		const nowExact = new Date("2026-09-13T12:00:00Z").getTime();
		expect(isExpired({ end_time: endTime }, nowExact)).toBe(true);
	});

	it("returns false if end_time is in the future relative to now", () => {
		const endTime = new Date("2026-09-13T12:00:00Z").toISOString();
		const nowBefore = new Date("2026-09-13T11:59:59Z").getTime();
		expect(isExpired({ end_time: endTime }, nowBefore)).toBe(false);
	});
});
