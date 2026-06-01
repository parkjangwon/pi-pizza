import { completeSimple, type Api, type Context, type Message, type Model } from "@earendil-works/pi-ai";
import type { ModelLookup, PizzaDecision, PizzaResolvedConfig } from "./types.ts";

let lastClassifiedPrompt = "";
let lastDecision: PizzaDecision | undefined;

export async function selectModel(
  config: PizzaResolvedConfig,
  modelLookup: ModelLookup,
  context: Context,
): Promise<{ readonly model: Model<Api>; readonly label: string }> {
  const lastMessage = context.messages[context.messages.length - 1];
  const userPrompt = getLastUserMessageText(context.messages);
  const isExecuting =
    lastMessage?.role === "toolResult" ||
    (lastMessage?.role === "assistant" && lastMessage.content.some((content) => content.type === "toolCall"));

  if (isExecuting) {
    return { model: config.executorModel, label: "CommandExecutor" };
  }
  if (!userPrompt) {
    return { model: config.builderEasyModel, label: "CodeBuilder [Easy / GENERAL]" };
  }

  const decision = await classifyIntent(config.readerModel, modelLookup, userPrompt);
  if (decision.difficulty === "EASY") {
    return { model: config.builderEasyModel, label: `CodeBuilder [Easy / ${decision.domain}]` };
  }
  if (decision.domain === "FRONTEND") {
    return { model: config.builderHardFrontendModel, label: "CodeBuilder [Hard / Frontend]" };
  }
  return { model: config.builderHardBackendModel, label: `CodeBuilder [Hard / ${decision.domain}]` };
}

function getLastUserMessageText(messages: readonly Message[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return "";
  if (typeof lastUser.content === "string") return lastUser.content;
  return lastUser.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n");
}

async function classifyIntent(model: Model<Api>, modelLookup: ModelLookup, userPrompt: string): Promise<PizzaDecision> {
  if (lastClassifiedPrompt === userPrompt && lastDecision) {
    return lastDecision;
  }

	const auth = await modelLookup.getApiKeyAndHeaders(model);
	const message = await completeSimple(
		model,
		{
			messages: [{ role: "user", content: buildClassificationPrompt(userPrompt), timestamp: Date.now() }],
		},
		auth.ok ? buildAuthOptions(auth) : undefined,
	);
  const text = message.content
    .filter((content) => content.type === "text")
    .map((content) => content.text)
    .join("\n");
  const decision = parseDecision(text);

  lastClassifiedPrompt = userPrompt;
  lastDecision = decision;
  return decision;
}

function parseDecision(text: string): PizzaDecision {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) return { difficulty: "EASY", domain: "GENERAL" };
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonMatch[0]);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return { difficulty: "EASY", domain: "GENERAL" };
		}
		throw error;
	}
	if (!isDecisionPayload(parsed)) return { difficulty: "EASY", domain: "GENERAL" };
	return {
		difficulty: parsed.difficulty,
		domain: parsed.domain,
	};
}

function buildAuthOptions(auth: { readonly apiKey?: string; readonly headers?: Record<string, string> }): {
	readonly apiKey?: string;
	readonly headers?: Record<string, string>;
} {
	return {
		...(auth.apiKey ? { apiKey: auth.apiKey } : {}),
		...(auth.headers ? { headers: auth.headers } : {}),
	};
}

function isDecisionPayload(value: unknown): value is PizzaDecision {
  if (!value || typeof value !== "object") return false;
  if (!("difficulty" in value) || !("domain" in value)) return false;
  return (
    (value.difficulty === "EASY" || value.difficulty === "HARD") &&
    (value.domain === "FRONTEND" || value.domain === "BACKEND" || value.domain === "GENERAL")
  );
}

function buildClassificationPrompt(userPrompt: string): string {
  return `You are the TaskPlanner for pi-pizza, a multi-provider coding-agent router.
Classify the user's request.

Difficulty:
- EASY: simple reads, comments, renames, small boilerplate, basic CRUD, simple commands.
- HARD: complex reasoning, large refactors, algorithms, deep type errors, delicate UI/CSS.

Domain:
- FRONTEND: React, HTML, CSS, visual layouts, styling, component design.
- BACKEND: databases, servers, API logic, algorithms, TypeScript config, scripts.
- GENERAL: git, questions, docs, and non-code tasks.

Return strict JSON only:
{"difficulty":"EASY"|"HARD","domain":"FRONTEND"|"BACKEND"|"GENERAL"}

User request:
${userPrompt}`;
}
