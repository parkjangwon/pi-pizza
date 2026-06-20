import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensurePizzaDefaultSettings, hasExplicitModelSelection } from "./settings.ts";

describe("hasExplicitModelSelection", () => {
	it("detects --model and --provider values passed with equals syntax", () => {
		expect(hasExplicitModelSelection(["pi", "--model=anthropic/claude-sonnet-4-6"])).toBe(true);
		expect(hasExplicitModelSelection(["pi", "--provider=anthropic"])).toBe(true);
	});

	it("does not treat unrelated flags as explicit model selection", () => {
		expect(hasExplicitModelSelection(["pi", "--mode=print"])).toBe(false);
	});
});

describe("ensurePizzaDefaultSettings", () => {
	const tempHomes: string[] = [];

	afterEach(() => {
		vi.unstubAllEnvs();
		for (const tempHome of tempHomes) {
			rmSync(tempHome, { recursive: true, force: true });
		}
		tempHomes.length = 0;
	});

	it("writes pizza/auto defaults when settings.json has no default model selection", () => {
		const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
		tempHomes.push(tempHome);
		vi.stubEnv("HOME", tempHome);

		const changed = ensurePizzaDefaultSettings();
		const written: unknown = JSON.parse(
			readFileSync(join(tempHome, ".pi", "agent", "settings.json"), "utf8"),
		);

		expect(changed).toBe(true);
		expect(written).toMatchObject({
			defaultProvider: "pizza",
			defaultModel: "auto",
		});
	});

	it("does not overwrite an existing default provider/model", () => {
		const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
		tempHomes.push(tempHome);
		vi.stubEnv("HOME", tempHome);
		const settingsPath = join(tempHome, ".pi", "agent", "settings.json");
		mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
		writeFileSync(
			settingsPath,
			`${JSON.stringify(
				{
					defaultProvider: "anthropic",
					defaultModel: "claude-sonnet-4-6",
				},
				null,
				2,
			)}\n`,
			"utf8",
		);

		const changed = ensurePizzaDefaultSettings();
		const written: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));

		expect(changed).toBe(false);
		expect(written).toMatchObject({
			defaultProvider: "anthropic",
			defaultModel: "claude-sonnet-4-6",
		});
	});
});
