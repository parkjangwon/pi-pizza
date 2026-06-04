import { describe, expect, it } from "vitest";
import { hasExplicitModelSelection } from "./settings.ts";

describe("hasExplicitModelSelection", () => {
	it("detects --model and --provider values passed with equals syntax", () => {
		expect(hasExplicitModelSelection(["pi", "--model=anthropic/claude-sonnet-4-5"])).toBe(true);
		expect(hasExplicitModelSelection(["pi", "--provider=anthropic"])).toBe(true);
	});

	it("does not treat unrelated flags as explicit model selection", () => {
		expect(hasExplicitModelSelection(["pi", "--mode=print"])).toBe(false);
	});
});
