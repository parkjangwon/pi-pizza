import type { Api, Model } from "@earendil-works/pi-ai";

export type PizzaRole =
	| "plannerModel"
	| "readerModel"
	| "quickModel"
	| "deepModel"
	| "visualModel"
	| "executorModel"
	| "architectModel";

export interface PizzaConfigFile {
	readonly plannerModel: string;
	readonly readerModel: string;
	readonly quickModel: string;
	readonly deepModel: string;
	readonly visualModel: string;
	readonly executorModel: string;
	readonly architectModel: string;
	readonly categoryModels?: Partial<Record<PizzaCategory, readonly string[]>>;
}

export interface PizzaResolvedConfig {
	readonly plannerModel: Model<Api>;
	readonly readerModel: Model<Api>;
	readonly quickModel: Model<Api>;
	readonly deepModel: Model<Api>;
	readonly visualModel: Model<Api>;
	readonly executorModel: Model<Api>;
	readonly architectModel: Model<Api>;
	readonly categoryModels: PizzaCategoryModelChains;
}

export type PizzaCategory =
	| "QUICK"
	| "READER"
	| "VISUAL"
	| "DEEP"
	| "ULTRABRAIN"
	| "WRITING"
	| "ARCHITECT"
	| "EXECUTOR";

export interface PizzaDecision {
	readonly category: PizzaCategory;
	readonly reason: string;
}

export type PizzaCategoryModelChains = {
	readonly [Category in PizzaCategory]: readonly Model<Api>[];
};

export interface RoutedModel {
	readonly model: Model<Api>;
	readonly label: string;
	readonly category: PizzaCategory;
	readonly reason: string;
	readonly auth: PizzaModelAuth;
}

export type PizzaModelAuth =
	| {
			readonly ok: true;
			readonly apiKey?: string;
			readonly headers?: Record<string, string>;
	  }
	| { readonly ok: false; readonly error: string };

export interface ModelLookup {
	getAvailable(): Model<Api>[];
	find(provider: string, modelId: string): Model<Api> | undefined;
	getApiKeyAndHeaders(
		model: Model<Api>,
	): Promise<PizzaModelAuth>;
}
