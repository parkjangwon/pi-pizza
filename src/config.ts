import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";
import { buildCategoryModelChains } from "./config-categories.ts";
import {
	createUnavailableModel,
	findModels,
	mergeModelSpecs,
} from "./model-selection.ts";
import type {
	ModelLookup,
	PizzaConfigFile,
	PizzaResolvedConfig,
} from "./types.ts";

const categoryModelsSchema = Type.Optional(
	Type.Partial(
		Type.Object({
			QUICK: Type.Array(Type.String()),
			READER: Type.Array(Type.String()),
			VISUAL: Type.Array(Type.String()),
			DEEP: Type.Array(Type.String()),
			ULTRABRAIN: Type.Array(Type.String()),
			WRITING: Type.Array(Type.String()),
			ARCHITECT: Type.Array(Type.String()),
			EXECUTOR: Type.Array(Type.String()),
		}),
	),
);
const ConfigSchema = Type.Object({
	plannerModel: Type.Optional(Type.String()),
	readerModel: Type.Optional(Type.String()),
	quickModel: Type.Optional(Type.String()),
	deepModel: Type.Optional(Type.String()),
	visualModel: Type.Optional(Type.String()),
	executorModel: Type.Optional(Type.String()),
	architectModel: Type.Optional(Type.String()),
	builderEasyModel: Type.Optional(Type.String()),
	builderHardBackendModel: Type.Optional(Type.String()),
	builderHardFrontendModel: Type.Optional(Type.String()),
	categoryModels: categoryModelsSchema,
});

const validateConfig = Compile(ConfigSchema);
type RawConfigFile = Static<typeof ConfigSchema>;

const emptyConfig: PizzaConfigFile = {
	plannerModel: "",
	readerModel: "",
	quickModel: "",
	deepModel: "",
	visualModel: "",
	executorModel: "",
	architectModel: "",
};

export function getConfigPath(): string {
	return join(homedir(), ".pi", "agent", "pizza.json");
}

export function loadConfigFile(): PizzaConfigFile {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		mkdirSync(join(homedir(), ".pi", "agent"), { recursive: true });
		writeFileSync(
			configPath,
			`${JSON.stringify(emptyConfig, null, 2)}\n`,
			"utf8",
		);
		return emptyConfig;
	}

	const configText = readFileSync(configPath, "utf8");
	const parsed: unknown = JSON.parse(configText);
	if (!validateConfig.Check(parsed)) {
		return emptyConfig;
	}

	const config = canonicalizeConfigFile(parsed);
	const canonicalText = `${JSON.stringify(config, null, 2)}\n`;
	if (configText !== canonicalText) {
		writeFileSync(configPath, canonicalText, "utf8");
	}
	return config;
}

export function deleteConfigFile(): boolean {
	const configPath = getConfigPath();
	if (!existsSync(configPath)) {
		return false;
	}
	unlinkSync(configPath);
	return true;
}

export function resolveConfig(modelLookup: ModelLookup): PizzaResolvedConfig {
	const available = modelLookup
		.getAvailable()
		.filter((model) => model.provider !== "pizza");
	const fallback = available[0] ?? createUnavailableModel();
	const autoPlannerChain = findModels(
		available,
		[
			"deepseek",
			"openai",
			"openrouter",
			"groq",
			"minimax",
			"minimax-cn",
			"zai",
			"google",
		],
		["gpt-4o-mini", "llama", "flash", "deepseek-chat", "chat", "spark", "mini"],
		fallback,
	);
	const autoPlanner = autoPlannerChain[0] ?? fallback;
	const autoReaderChain = findModels(
		available,
		[
			"deepseek",
			"opencode-go",
			"opencode",
			"zai",
			"minimax",
			"minimax-cn",
			"groq",
			"openai",
			"openrouter",
			"google",
		],
		[
			"gpt-4o-mini",
			"llama",
			"flash",
			"deepseek-chat",
			"chat",
			"lite",
			"spark",
			"mini",
			"gemini-2.0-flash",
		],
		autoPlanner,
	);
	const autoReader = autoReaderChain[0] ?? autoPlanner;
	const autoHardBackendChain = findModels(
		available,
		[
			"deepseek",
			"anthropic",
			"openai",
			"openrouter",
			"groq",
			"zai",
			"minimax",
			"minimax-cn",
			"google",
		],
		[
			"deepseek-coder",
			"coder",
			"r1",
			"reasoning",
			"sonnet",
			"claude-3-5",
			"grok-4",
			"grok-2",
			"gpt-4o",
		],
		autoPlanner,
	);
	const autoHardBackend = autoHardBackendChain[0] ?? autoPlanner;
	const autoHardFrontendChain = findModels(
		available,
		["anthropic", "openai", "openrouter", "deepseek", "google"],
		[
			"sonnet",
			"claude-3-5",
			"gpt-4o",
			"deepseek-coder",
			"coder",
			"pro",
			"gemini-2.0-pro",
		],
		autoHardBackend,
	);
	const autoHardFrontend = autoHardFrontendChain[0] ?? autoHardBackend;
	const autoExecutorChain = findModels(
		available,
		[
			"groq",
			"deepseek",
			"openai",
			"openrouter",
			"zai",
			"minimax",
			"minimax-cn",
			"google",
		],
		["fast", "gpt-4o-mini", "llama", "deepseek-chat", "chat", "flash"],
		autoPlanner,
	);
	const autoExecutor = autoExecutorChain[0] ?? autoPlanner;
	const autoArchitectChain = findModels(
		available,
		["anthropic", "openai", "deepseek", "openrouter", "google", "groq", "zai"],
		[
			"sonnet",
			"opus",
			"claude-3-5",
			"gpt-4o",
			"gpt-5",
			"deepseek-coder",
			"coder",
			"r1",
			"reasoning",
			"grok-4",
		],
		autoHardBackend,
	);
	const autoArchitect = autoArchitectChain[0] ?? autoHardBackend;
	const file = loadConfigFile();
	const plannerModel =
		mergeModelSpecs(modelLookup, [file.plannerModel], [autoPlanner])[0] ??
		autoPlanner;
	const readerModel =
		mergeModelSpecs(modelLookup, [file.readerModel], [autoReader])[0] ??
		autoReader;
	const quickModel =
		mergeModelSpecs(modelLookup, [file.quickModel], [autoReader])[0] ?? autoReader;
	const deepModel =
		mergeModelSpecs(modelLookup, [file.deepModel], [autoHardBackend])[0] ?? autoHardBackend;
	const visualModel =
		mergeModelSpecs(modelLookup, [file.visualModel], [autoHardFrontend])[0] ?? autoHardFrontend;
	const executorModel =
		mergeModelSpecs(modelLookup, [file.executorModel], [autoExecutor])[0] ?? autoExecutor;
	const architectModel =
		mergeModelSpecs(modelLookup, [file.architectModel], [autoArchitect])[0] ?? autoArchitect;

	return {
		plannerModel,
		readerModel,
		quickModel,
		deepModel,
		visualModel,
		executorModel,
		architectModel,
		categoryModels: buildCategoryModelChains(
			modelLookup,
			file,
			{
				readerModel,
				quickModel,
				deepModel,
				visualModel,
				executorModel,
				architectModel,
			},
			{
				autoReaderChain,
				autoHardBackendChain,
				autoHardFrontendChain,
				autoExecutorChain,
				autoArchitectChain,
			},
		),
	};
}

function canonicalizeConfigFile(raw: RawConfigFile): PizzaConfigFile {
	return {
		plannerModel: raw.plannerModel ?? "",
		readerModel: raw.readerModel ?? "",
		quickModel: raw.quickModel ?? raw.builderEasyModel ?? "",
		deepModel: raw.deepModel ?? raw.builderHardBackendModel ?? "",
		visualModel: raw.visualModel ?? raw.builderHardFrontendModel ?? "",
		executorModel: raw.executorModel ?? "",
		architectModel: raw.architectModel ?? "",
		...(raw.categoryModels ? { categoryModels: raw.categoryModels } : {}),
	};
}
