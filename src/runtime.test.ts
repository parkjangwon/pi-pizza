import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Api, Model } from "@earendil-works/pi-ai";
import { clearRoutingAuthCacheForTesting } from "./router-categories.ts";
import { PizzaRuntime } from "./runtime.ts";
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

const quickModel = model("deepseek", "deepseek-chat");
const visualModel = model("anthropic", "claude-sonnet-4-5");

function lookup(authOk = true): ModelLookup {
	const available = [quickModel, visualModel];
	return {
		getAvailable: () => available,
		find: (provider, id) => available.find((candidate) => candidate.provider === provider && candidate.id === id),
		getApiKeyAndHeaders: async () =>
			authOk ? { ok: true, apiKey: "test-key" } : { ok: false, error: "missing test auth" },
	};
}

describe("PizzaRuntime route preview", () => {
	beforeEach(() => {
		clearRoutingAuthCacheForTesting();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("dry-runs a prompt without streaming a provider response", async () => {
		const runtime = new PizzaRuntime();
		runtime.bind(lookup());

		const preview = await runtime.previewRoute("Polish this React layout and CSS.");

		expect(preview).toContain("🍕 VISUAL -> CodeBuilder [Visual]: anthropic/claude-sonnet-4-5");
		expect(preview).toContain("Heuristic frontend keyword match.");
		expect(runtime.getRouteHistory()).toEqual([]);
	});

	it("warns when a dry-run route selects a model that would fail auth", async () => {
		const runtime = new PizzaRuntime();
		runtime.bind(lookup(false));

		const preview = await runtime.previewRoute("Polish this React layout and CSS.");

		expect(preview).toContain("anthropic/claude-sonnet-4-5");
		expect(preview).toContain("would fail auth: missing test auth");
		expect(preview).not.toContain("skipped anthropic/claude-sonnet-4-5");
	});

	it("reloads config after an explicit reset without requiring a new session", () => {
		const runtime = new PizzaRuntime();
		runtime.bind(lookup());

		expect(runtime.reloadConfig()).toBe(true);
		expect(runtime.describeModels()).toContain("Pizza models:");
	});
});
