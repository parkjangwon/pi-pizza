import type { Api, Model } from "@earendil-works/pi-ai";
import type {
	ModelLookup,
	PizzaCategory,
	PizzaModelAuth,
	PizzaResolvedConfig,
	RoutedModel,
	PizzaSkippedModel,
} from "./types.ts";

const AUTH_CACHE_TTL_MS = 30_000;
const authCache = new Map<
	string,
	{ readonly checkedAt: number; readonly auth: PizzaModelAuth }
>();

export function clearRoutingAuthCacheForTesting(): void {
	authCache.clear();
}

export async function routeForCategory(
	config: PizzaResolvedConfig,
	modelLookup: ModelLookup,
	category: PizzaCategory,
	reason: string,
): Promise<RoutedModel> {
	const candidates = config.categoryModels[category];
	const fallback = fallbackModelForCategory(config, category);
	const routed = await firstAuthenticatedModel(modelLookup, candidates, fallback);

	return {
		model: routed.model,
		label: labelForCategory(category),
		category,
		reason,
		auth: routed.auth,
		skippedModels: routed.skippedModels,
	};
}

function labelForCategory(category: PizzaCategory): string {
	switch (category) {
		case "EXECUTOR":
			return "CommandExecutor";
		case "ARCHITECT":
			return "Architect [Plan / Design]";
		case "QUICK":
			return "CodeBuilder [Quick]";
		case "READER":
			return "Reader [Analysis]";
		case "VISUAL":
			return "CodeBuilder [Visual]";
		case "DEEP":
			return "CodeBuilder [Deep]";
		case "ULTRABRAIN":
			return "Architect [UltraBrain]";
		case "WRITING":
			return "Writer [Docs]";
		default:
			return assertNever(category);
	}
}

function fallbackModelForCategory(
	config: PizzaResolvedConfig,
	category: PizzaCategory,
): Model<Api> {
	switch (category) {
		case "EXECUTOR":
			return config.executorModel;
		case "ARCHITECT":
		case "ULTRABRAIN":
			return config.architectModel;
		case "QUICK":
			return config.quickModel;
		case "READER":
		case "WRITING":
			return config.readerModel;
		case "VISUAL":
			return config.visualModel;
		case "DEEP":
			return config.deepModel;
		default:
			return assertNever(category);
	}
}

async function firstAuthenticatedModel(
	modelLookup: ModelLookup,
	candidates: readonly Model<Api>[],
	fallback: Model<Api>,
): Promise<{
	readonly model: Model<Api>;
	readonly auth: PizzaModelAuth;
	readonly skippedModels: readonly PizzaSkippedModel[];
}> {
	let firstFailure:
		| { readonly model: Model<Api>; readonly auth: PizzaModelAuth }
		| undefined;
	const skippedModels: PizzaSkippedModel[] = [];
	for (const candidate of candidates) {
		const auth = await getCachedAuth(modelLookup, candidate);
		if (auth.ok) return { model: candidate, auth, skippedModels };
		skippedModels.push({
			model: `${candidate.provider}/${candidate.id}`,
			reason: auth.error,
		});
		firstFailure ??= { model: candidate, auth };
	}
	if (firstFailure) return { ...firstFailure, skippedModels };
	return {
		model: fallback,
		auth: await getCachedAuth(modelLookup, fallback),
		skippedModels,
	};
}

async function getCachedAuth(
	modelLookup: ModelLookup,
	model: Model<Api>,
): Promise<PizzaModelAuth> {
	const key = `${model.provider}/${model.id}`;
	const cached = authCache.get(key);
	if (cached && Date.now() - cached.checkedAt < AUTH_CACHE_TTL_MS) {
		return cached.auth;
	}
	const auth = await modelLookup.getApiKeyAndHeaders(model);
	authCache.set(key, { checkedAt: Date.now(), auth });
	return auth;
}

function assertNever(value: never): never {
	throw new Error(`Unhandled pizza category: ${String(value)}`);
}
