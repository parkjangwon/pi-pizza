import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelLookup } from "./types.ts";

export function findModel(
	available: readonly Model<Api>[],
	providerPreference: readonly string[],
	idKeywords: readonly string[],
	fallback: Model<Api>,
): Model<Api> {
	return findModels(available, providerPreference, idKeywords, fallback)[0] ?? fallback;
}

export function findModels(
	available: readonly Model<Api>[],
	providerPreference: readonly string[],
	idKeywords: readonly string[],
	fallback: Model<Api>,
): readonly Model<Api>[] {
	const keywordMatches = providerPreference.flatMap((provider) =>
		available.filter(
			(model) =>
				model.provider === provider &&
				idKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)),
		),
	);
	const providerMatches = providerPreference.flatMap((provider) =>
		available.filter((model) => model.provider === provider),
	);
	return uniqueModels([...keywordMatches, ...providerMatches, fallback]);
}

export function mergeModelSpecs(
	modelLookup: ModelLookup,
	modelSpecs: readonly string[] | undefined,
	fallbackModels: readonly Model<Api>[],
): readonly Model<Api>[] {
	const parsed = (modelSpecs ?? [])
		.map((spec) => parseModelSpec(modelLookup, spec))
		.filter((model) => model !== undefined);
	return uniqueModels([...parsed, ...fallbackModels]);
}

export function parseModelSpec(
	modelLookup: ModelLookup,
	modelSpec: string,
): Model<Api> | undefined {
	const slashIndex = modelSpec.indexOf("/");
	if (slashIndex <= 0 || slashIndex === modelSpec.length - 1) {
		return undefined;
	}
	return modelLookup.find(
		modelSpec.slice(0, slashIndex),
		modelSpec.slice(slashIndex + 1),
	);
}

export function createUnavailableModel(): Model<Api> {
	return {
		id: "unavailable",
		name: "Unavailable",
		api: "openai-completions",
		provider: "pizza",
		baseUrl: "https://invalid.local",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 4096,
	};
}

function uniqueModels(models: readonly Model<Api>[]): readonly Model<Api>[] {
	const seen = new Set<string>();
	const result: Model<Api>[] = [];
	for (const model of models) {
		const key = `${model.provider}/${model.id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(model);
	}
	return result;
}
