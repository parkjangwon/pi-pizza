import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type } from "typebox";
import { Compile } from "typebox/compile";
import type { Api, Model } from "@earendil-works/pi-ai";
import type {
	ModelLookup,
	PizzaConfigFile,
	PizzaResolvedConfig,
} from "./types.ts";

const ConfigSchema = Type.Object({
	plannerModel: Type.String(),
	readerModel: Type.String(),
	builderEasyModel: Type.String(),
	builderHardBackendModel: Type.String(),
	builderHardFrontendModel: Type.String(),
	executorModel: Type.String(),
	architectModel: Type.String(),
});

const validateConfig = Compile(ConfigSchema);

const emptyConfig: PizzaConfigFile = {
	plannerModel: "",
	readerModel: "",
	builderEasyModel: "",
	builderHardBackendModel: "",
	builderHardFrontendModel: "",
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

	const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
	if (!validateConfig.Check(parsed)) {
		return emptyConfig;
	}

	return parsed;
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
	const autoPlanner = findModel(
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
	const autoReader = findModel(
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
	const autoHardBackend = findModel(
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
	const autoHardFrontend = findModel(
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
	const autoExecutor = findModel(
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
	const autoArchitect = findModel(
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
	const file = loadConfigFile();

	return {
		plannerModel: parseModelSpec(modelLookup, file.plannerModel, autoPlanner),
		readerModel: parseModelSpec(modelLookup, file.readerModel, autoReader),
		builderEasyModel: parseModelSpec(
			modelLookup,
			file.builderEasyModel,
			autoReader,
		),
		builderHardBackendModel: parseModelSpec(
			modelLookup,
			file.builderHardBackendModel,
			autoHardBackend,
		),
		builderHardFrontendModel: parseModelSpec(
			modelLookup,
			file.builderHardFrontendModel,
			autoHardFrontend,
		),
		executorModel: parseModelSpec(
			modelLookup,
			file.executorModel,
			autoExecutor,
		),
		architectModel: parseModelSpec(
			modelLookup,
			file.architectModel,
			autoArchitect,
		),
	};
}

function findModel(
	available: readonly Model<Api>[],
	providerPreference: readonly string[],
	idKeywords: readonly string[],
	fallback: Model<Api>,
): Model<Api> {
	for (const provider of providerPreference) {
		const match = available.find(
			(model) =>
				model.provider === provider &&
				idKeywords.some((keyword) => model.id.toLowerCase().includes(keyword)),
		);
		if (match) return match;
	}
	for (const provider of providerPreference) {
		const match = available.find((model) => model.provider === provider);
		if (match) return match;
	}
	return fallback;
}

function parseModelSpec(
	modelLookup: ModelLookup,
	modelSpec: string,
	fallback: Model<Api>,
): Model<Api> {
	const slashIndex = modelSpec.indexOf("/");
	if (slashIndex <= 0 || slashIndex === modelSpec.length - 1) {
		return fallback;
	}
	return (
		modelLookup.find(
			modelSpec.slice(0, slashIndex),
			modelSpec.slice(slashIndex + 1),
		) ?? fallback
	);
}

function createUnavailableModel(): Model<Api> {
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
