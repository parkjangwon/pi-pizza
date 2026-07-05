import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { loadConfigFile, resolveConfig } from "./config.ts";
import type { ModelLookup } from "./types.ts";

function model(provider: string, id: string): Model<Api> {
	return {
		provider,
		id,
		name: `${provider}/${id}`,
		api: "openai-completions",
		baseUrl: `https://${provider}.example`,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
	};
}

describe("resolveConfig category model chains", () => {
	const tempHomes: string[] = [];

	afterEach(() => {
		vi.unstubAllEnvs();
		for (const tempHome of tempHomes) {
			rmSync(tempHome, { recursive: true, force: true });
		}
		tempHomes.length = 0;
	});

	it("creates first-run pizza config with only role model fields", () => {
		const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
		tempHomes.push(tempHome);
		vi.stubEnv("HOME", tempHome);

		const config = loadConfigFile();
		const written: unknown = JSON.parse(
			readFileSync(join(tempHome, ".pi", "agent", "pizza.json"), "utf8"),
		);

		expect(written).toMatchObject({
			plannerModel: "",
			readerModel: "",
			quickModel: "",
			deepModel: "",
			visualModel: "",
			executorModel: "",
			architectModel: "",
			mascot: true,
		});
		expect(written).not.toHaveProperty("categoryModels");
	});

	it("migrates legacy builder role names to the canonical role names", () => {
		const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
		tempHomes.push(tempHome);
		vi.stubEnv("HOME", tempHome);
		const configPath = join(tempHome, ".pi", "agent", "pizza.json");
		mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify({
				plannerModel: "planner/mini",
				readerModel: "reader/long",
				builderEasyModel: "easy/quick",
				builderHardBackendModel: "backend/deep",
				builderHardFrontendModel: "frontend/visual",
				executorModel: "executor/fast",
				architectModel: "architect/reasoning",
			}),
			"utf8",
		);

		const config = loadConfigFile();
		const written: unknown = JSON.parse(readFileSync(configPath, "utf8"));

		expect(config).toMatchObject({
			quickModel: "easy/quick",
			deepModel: "backend/deep",
			visualModel: "frontend/visual",
		});
		expect(written).toMatchObject({
			quickModel: "easy/quick",
			deepModel: "backend/deep",
			visualModel: "frontend/visual",
			mascot: true,
		});
		expect(written).not.toHaveProperty("builderEasyModel");
		expect(written).not.toHaveProperty("builderHardBackendModel");
		expect(written).not.toHaveProperty("builderHardFrontendModel");
	});

	it("preserves an explicit mascot: false setting", () => {
		const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
		tempHomes.push(tempHome);
		vi.stubEnv("HOME", tempHome);
		const configPath = join(tempHome, ".pi", "agent", "pizza.json");
		mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify({
				plannerModel: "",
				readerModel: "",
				quickModel: "",
				deepModel: "",
				visualModel: "",
				executorModel: "",
				architectModel: "",
				mascot: false,
			}),
			"utf8",
		);

		const config = loadConfigFile();
		const written: unknown = JSON.parse(readFileSync(configPath, "utf8"));

		expect(config.mascot).toBe(false);
		expect(written).toMatchObject({ mascot: false });
	});

	it("puts configured category models before role defaults", () => {
		const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
		tempHomes.push(tempHome);
		vi.stubEnv("HOME", tempHome);
		mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
		writeFileSync(
			join(tempHome, ".pi", "agent", "pizza.json"),
			JSON.stringify({
				plannerModel: "",
				readerModel: "",
				quickModel: "",
				deepModel: "",
				visualModel: "frontend/primary",
				executorModel: "",
				architectModel: "",
				categoryModels: {
					VISUAL: ["visual/first", "visual/second"],
				},
			}),
			"utf8",
		);

		const available = [
			model("planner", "mini"),
			model("frontend", "primary"),
			model("visual", "first"),
			model("visual", "second"),
		];
		const lookup: ModelLookup = {
			getAvailable: () => available,
			find: (provider, id) =>
				available.find(
					(candidate) => candidate.provider === provider && candidate.id === id,
				),
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test-key" }),
		};

		const config = resolveConfig(lookup);

		expect(
			config.categoryModels.VISUAL.map(
				(candidate) => `${candidate.provider}/${candidate.id}`,
			).slice(0, 3),
		).toEqual(["visual/first", "visual/second", "frontend/primary"]);
	});

	it("prefers deepseek-v4-flash for quickModel auto-detection over reader-style models", () => {
		const available = [
			model("google", "gemini-3.5-flash"),
			model("deepseek", "deepseek-v4-flash"),
			model("deepseek", "deepseek-v4-pro"),
		];
		const lookup: ModelLookup = {
			getAvailable: () => available,
			find: (provider, id) =>
				available.find(
					(candidate) => candidate.provider === provider && candidate.id === id,
				),
			getApiKeyAndHeaders: async () => ({ ok: true, apiKey: "test-key" }),
		};

		const config = resolveConfig(lookup);

		expect(`${config.quickModel.provider}/${config.quickModel.id}`).toBe(
			"deepseek/deepseek-v4-flash",
		);
		expect(`${config.readerModel.provider}/${config.readerModel.id}`).toBe(
			"google/gemini-3.5-flash",
		);
	});
});
