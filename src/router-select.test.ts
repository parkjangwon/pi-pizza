import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Message, Model } from "@earendil-works/pi-ai";
import type { Api } from "@earendil-works/pi-ai";
import { selectModel } from "./router.ts";
import { clearRoutingAuthCacheForTesting } from "./router-categories.ts";
import { clearCategoryDecisionCacheForTesting } from "./router-decision.ts";
import type { ModelLookup, PizzaResolvedConfig } from "./types.ts";

const completeSimpleMock = vi.hoisted(() => vi.fn());

vi.mock("@earendil-works/pi-ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@earendil-works/pi-ai")>();
	return {
		...actual,
		completeSimple: completeSimpleMock,
	};
});

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

const plannerModel = model("planner", "planner-mini");
const readerModel = model("reader", "reader-long");
const quickModel = model("easy", "quick");
const deepModel = model("backend", "deep");
const visualModel = model("frontend", "visual");
const executorModel = model("executor", "fast");
const architectModel = model("architect", "reasoning");
const roleModels = [
	plannerModel,
	readerModel,
	quickModel,
	deepModel,
	visualModel,
	executorModel,
	architectModel,
];

const config: PizzaResolvedConfig = {
	plannerModel,
	readerModel,
	quickModel,
	deepModel,
	visualModel,
	executorModel,
	architectModel,
	categoryModels: {
		QUICK: [quickModel],
		READER: [readerModel],
		VISUAL: [visualModel],
		DEEP: [deepModel],
		ULTRABRAIN: [architectModel],
		WRITING: [readerModel],
		ARCHITECT: [architectModel],
		EXECUTOR: [executorModel],
	},
};

function contextFromUserPrompt(content: string): Context {
	return {
		messages: [{ role: "user", content, timestamp: 0 } as Message],
	} as Context;
}

function lookup(authOk: boolean | ((candidate: Model<Api>) => boolean) = true): ModelLookup {
	return {
		getAvailable: () => roleModels,
		find: (provider, id) =>
			roleModels.find(
				(candidate) => candidate.provider === provider && candidate.id === id,
			),
		getApiKeyAndHeaders: async (candidate) =>
			(typeof authOk === "function" ? authOk(candidate) : authOk)
				? { ok: true, apiKey: "test-key" }
				: { ok: false, error: "planner auth failed" },
	};
}

function mockPlannerDecision(category: string): void {
	completeSimpleMock.mockResolvedValue({
		content: [
			{
				type: "text",
				text: JSON.stringify({ category, reason: "test" }),
			},
		],
	});
}

describe("selectModel category routing", () => {
	beforeEach(() => {
		completeSimpleMock.mockReset();
		clearCategoryDecisionCacheForTesting();
		clearRoutingAuthCacheForTesting();
	});

	it("routes obvious visual work without calling the planner model", async () => {
		const routed = await selectModel(
			config,
			lookup(),
			contextFromUserPrompt("Polish this React layout and CSS."),
		);

		expect(routed.model).toBe(config.visualModel);
		expect(routed.label).toBe("CodeBuilder [Visual]");
		expect(routed.category).toBe("VISUAL");
		expect(routed.reason).toBe("Heuristic frontend keyword match.");
		expect(routed.auth.ok).toBe(true);
		expect(completeSimpleMock).not.toHaveBeenCalled();
	});

	it("routes obvious writing work without calling the planner model", async () => {
		const routed = await selectModel(
			config,
			lookup(),
			contextFromUserPrompt("Rewrite this README section more clearly."),
		);

		expect(routed.model).toBe(config.readerModel);
		expect(routed.label).toBe("Writer [Docs]");
		expect(routed.category).toBe("WRITING");
		expect(completeSimpleMock).not.toHaveBeenCalled();
	});

	it("uses the planner model for ambiguous requests", async () => {
		mockPlannerDecision("DEEP");

		const routed = await selectModel(
			config,
			lookup(),
			contextFromUserPrompt("Make the routing better."),
		);

		expect(routed.model).toBe(config.deepModel);
		expect(routed.category).toBe("DEEP");
		expect(routed.reason).toBe("test");
		expect(completeSimpleMock).toHaveBeenCalledOnce();
	});

	it("routes explicit plan requests without calling the planner model", async () => {
		const routed = await selectModel(
			config,
			lookup(),
			contextFromUserPrompt("/plan design the migration"),
		);

		expect(routed.model).toBe(config.architectModel);
		expect(completeSimpleMock).not.toHaveBeenCalled();
	});

	it("uses heuristic quick routing when planner auth is unavailable", async () => {
		const routed = await selectModel(
			config,
			lookup(false),
			contextFromUserPrompt("Fix the typo in README."),
		);

		expect(routed.model).toBe(config.quickModel);
		expect(routed.label).toBe("CodeBuilder [Quick]");
		expect(completeSimpleMock).not.toHaveBeenCalled();
	});

	it("falls through a category model chain when the first model lacks auth and records the skipped candidate", async () => {
		mockPlannerDecision("VISUAL");
		const fallbackVisual = model("fallback", "visual");
		const chainedConfig: PizzaResolvedConfig = {
			...config,
			categoryModels: {
				...config.categoryModels,
				VISUAL: [config.visualModel, fallbackVisual],
			},
		};

		const routed = await selectModel(
			chainedConfig,
			lookup((candidate) => candidate.provider !== "frontend"),
			contextFromUserPrompt("Improve the CSS layout."),
		);

		expect(routed.model).toBe(fallbackVisual);
		expect(routed.label).toBe("CodeBuilder [Visual]");
		expect(routed.skippedModels).toEqual([
			{
				model: "frontend/visual",
				reason: "planner auth failed",
			},
		]);
	});

	it("caches category auth checks across repeated routes", async () => {
		mockPlannerDecision("DEEP");
		let authCalls = 0;
		const countingLookup: ModelLookup = {
			...lookup(),
			getApiKeyAndHeaders: async () => {
				authCalls += 1;
				return { ok: true, apiKey: "test-key" };
			},
		};

		await selectModel(
			config,
			countingLookup,
			contextFromUserPrompt("Make the routing better."),
		);
		await selectModel(
			config,
			countingLookup,
			contextFromUserPrompt("Make the routing better."),
		);

		expect(authCalls).toBe(2);
	});
});
