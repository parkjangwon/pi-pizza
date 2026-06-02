import type { Api, Model } from "@earendil-works/pi-ai";
import { mergeModelSpecs } from "./model-selection.ts";
import type {
	ModelLookup,
	PizzaCategoryModelChains,
	PizzaConfigFile,
} from "./types.ts";

export interface ResolvedRoleModels {
	readonly readerModel: Model<Api>;
	readonly quickModel: Model<Api>;
	readonly deepModel: Model<Api>;
	readonly visualModel: Model<Api>;
	readonly executorModel: Model<Api>;
	readonly architectModel: Model<Api>;
}

export interface AutoModelChains {
	readonly autoReaderChain: readonly Model<Api>[];
	readonly autoHardBackendChain: readonly Model<Api>[];
	readonly autoHardFrontendChain: readonly Model<Api>[];
	readonly autoExecutorChain: readonly Model<Api>[];
	readonly autoArchitectChain: readonly Model<Api>[];
}

export function buildCategoryModelChains(
	modelLookup: ModelLookup,
	file: PizzaConfigFile,
	roles: ResolvedRoleModels,
	auto: AutoModelChains,
): PizzaCategoryModelChains {
	return {
		QUICK: mergeModelSpecs(modelLookup, file.categoryModels?.QUICK, [
			roles.quickModel,
			...auto.autoReaderChain,
		]),
		READER: mergeModelSpecs(modelLookup, file.categoryModels?.READER, [
			roles.readerModel,
			...auto.autoReaderChain,
		]),
		VISUAL: mergeModelSpecs(modelLookup, file.categoryModels?.VISUAL, [
			roles.visualModel,
			...auto.autoHardFrontendChain,
			...auto.autoHardBackendChain,
		]),
		DEEP: mergeModelSpecs(modelLookup, file.categoryModels?.DEEP, [
			roles.deepModel,
			...auto.autoHardBackendChain,
		]),
		ULTRABRAIN: mergeModelSpecs(modelLookup, file.categoryModels?.ULTRABRAIN, [
			roles.architectModel,
			...auto.autoArchitectChain,
			...auto.autoHardBackendChain,
		]),
		WRITING: mergeModelSpecs(modelLookup, file.categoryModels?.WRITING, [
			roles.readerModel,
			...auto.autoReaderChain,
		]),
		ARCHITECT: mergeModelSpecs(modelLookup, file.categoryModels?.ARCHITECT, [
			roles.architectModel,
			...auto.autoArchitectChain,
		]),
		EXECUTOR: mergeModelSpecs(modelLookup, file.categoryModels?.EXECUTOR, [
			roles.executorModel,
			...auto.autoExecutorChain,
		]),
	};
}
