import type { Api, Model } from "@earendil-works/pi-ai";

export type PizzaRole =
	| "plannerModel"
	| "readerModel"
	| "builderEasyModel"
	| "builderHardBackendModel"
	| "builderHardFrontendModel"
	| "executorModel"
	| "architectModel";

export interface PizzaConfigFile {
	readonly plannerModel: string;
	readonly readerModel: string;
	readonly builderEasyModel: string;
	readonly builderHardBackendModel: string;
	readonly builderHardFrontendModel: string;
	readonly executorModel: string;
	readonly architectModel: string;
}

export interface PizzaResolvedConfig {
	readonly plannerModel: Model<Api>;
	readonly readerModel: Model<Api>;
	readonly builderEasyModel: Model<Api>;
	readonly builderHardBackendModel: Model<Api>;
	readonly builderHardFrontendModel: Model<Api>;
	readonly executorModel: Model<Api>;
	readonly architectModel: Model<Api>;
}

export type PizzaDifficulty = "EASY" | "HARD";
export type PizzaDomain = "FRONTEND" | "BACKEND" | "GENERAL";

export interface PizzaDecision {
	readonly difficulty: PizzaDifficulty;
	readonly domain: PizzaDomain;
}

export interface ModelLookup {
	getAvailable(): Model<Api>[];
	find(provider: string, modelId: string): Model<Api> | undefined;
	getApiKeyAndHeaders(
		model: Model<Api>,
	): Promise<
		| {
				readonly ok: true;
				readonly apiKey?: string;
				readonly headers?: Record<string, string>;
		  }
		| { readonly ok: false; readonly error: string }
	>;
}
