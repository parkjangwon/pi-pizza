import {
	completeSimple,
	type Api,
	type Context,
	type Message,
	type Model,
} from "@earendil-works/pi-ai";
import type {
	ModelLookup,
	PizzaCategory,
	PizzaDecision,
	PizzaResolvedConfig,
} from "./types.ts";

let lastClassificationKey = "";
let lastDecision: PizzaDecision | undefined;

export function clearCategoryDecisionCacheForTesting(): void {
	clearCategoryDecisionCache();
}

export function clearCategoryDecisionCache(): void {
	lastClassificationKey = "";
	lastDecision = undefined;
}

export async function selectCategory(
	config: PizzaResolvedConfig,
	modelLookup: ModelLookup,
	context: Context,
): Promise<PizzaDecision> {
	const lastMessage = context.messages[context.messages.length - 1];
	const userPrompt = getLastUserMessageText(context.messages);
	const isExecuting =
		lastMessage?.role === "toolResult" ||
		(lastMessage?.role === "assistant" &&
			lastMessage.content.some((content) => content.type === "toolCall"));

	if (isExecuting) {
		return { category: "EXECUTOR", reason: "Continuing after tool execution." };
	}
	if (!userPrompt) {
		return { category: "QUICK", reason: "No user prompt text was available." };
	}
	if (isPlanningRequest(context, userPrompt)) {
		return { category: "ARCHITECT", reason: "Explicit planning signal." };
	}

	const heuristic = heuristicDecision(userPrompt, { allowDefault: false });
	if (heuristic) return heuristic;

	return classifyIntent(config.plannerModel, modelLookup, userPrompt, context.messages.length);
}

export function isPlanningRequest(
	context: Context,
	userPrompt: string,
): boolean {
	const planSkills = ["plan", "ralplan", "writing-plans", "executing-plans"];

	const hasPlanSkillMarker = (text: string): boolean => {
		const skillText = stripAvailableSkillsBlocks(text);
		return planSkills.some(
			(name) =>
				skillText.includes(`<skill name="${name}"`) ||
				skillText.includes(`<name>${name}</name>`),
		);
	};

	for (const msg of context.messages) {
		const text =
			typeof msg.content === "string"
				? msg.content
				: msg.content
						.filter((c) => c.type === "text")
						.map((c) => c.text)
						.join("\n");
		if (hasPlanSkillMarker(text)) return true;
	}

	if (hasPlanSkillMarker(context.systemPrompt ?? "")) return true;

	const lower = userPrompt.toLowerCase();
	return (
		/^\s*\/plan\b/.test(lower) ||
		/^\s*\/skill:(plan|ralplan|writing-plans|executing-plans)\b/.test(lower)
	);
}

function stripAvailableSkillsBlocks(text: string): string {
	return text.replace(/<available_skills>[\s\S]*?<\/available_skills>/g, "");
}

function getLastUserMessageText(messages: readonly Message[]): string {
	const lastUser = [...messages]
		.reverse()
		.find((message) => message.role === "user");
	if (!lastUser) return "";
	if (typeof lastUser.content === "string") return lastUser.content;
	return lastUser.content
		.filter((content) => content.type === "text")
		.map((content) => content.text)
		.join("\n");
}

async function classifyIntent(
	model: Model<Api>,
	modelLookup: ModelLookup,
	userPrompt: string,
	messageCount: number,
): Promise<PizzaDecision> {
	const classificationKey = `${messageCount}:${userPrompt}`;
	if (lastClassificationKey === classificationKey && lastDecision) {
		return lastDecision;
	}

	const auth = await modelLookup.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		return (
			heuristicDecision(userPrompt, { allowDefault: true }) ?? {
				category: "QUICK",
				reason: "Default heuristic route.",
			}
		);
	}
	const message = await completeSimple(
		model,
		{
			messages: [
				{
					role: "user",
					content: buildClassificationPrompt(userPrompt),
					timestamp: Date.now(),
				},
			],
		},
		buildAuthOptions(auth),
	);
	const text = message.content
		.filter((content) => content.type === "text")
		.map((content) => content.text)
		.join("\n");
	const decision = parseDecision(text);

	lastClassificationKey = classificationKey;
	lastDecision = decision;
	return decision;
}

function parseDecision(text: string): PizzaDecision {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) return { category: "QUICK", reason: "Planner returned no JSON." };
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonMatch[0]);
	} catch (error) {
		if (error instanceof SyntaxError) {
			return { category: "QUICK", reason: "Planner returned invalid JSON." };
		}
		throw error;
	}
	if (!isDecisionPayload(parsed)) {
		return { category: "QUICK", reason: "Planner returned an unknown category." };
	}
	return parsed;
}

function buildAuthOptions(auth: {
	readonly apiKey?: string;
	readonly headers?: Record<string, string>;
}): {
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
	if (!("category" in value) || !("reason" in value)) return false;
	return isPizzaCategory(value.category) && typeof value.reason === "string";
}

function buildClassificationPrompt(userPrompt: string): string {
	return `You are the TaskPlanner for pi-pizza, a multi-provider coding-agent router.
Classify the CURRENT user request only. Ignore conversation momentum.

Categories:
- QUICK: trivial commands, typos, small single-file edits, simple explanations.
- READER: repository analysis, code reading, summaries, "how does this work?", no implementation requested.
- VISUAL: frontend, React, HTML, CSS, UI/UX, styling, layout, animation, design.
- DEEP: multi-file coding, backend logic, debugging, refactors, type errors, scripts, tests.
- ULTRABRAIN: complex architecture, algorithms, high-risk design, cross-system reasoning.
- WRITING: docs, README, prose, release notes, technical writing.
- ARCHITECT: explicit planning/design mode requests.
- EXECUTOR: tool-result diagnosis, command-output follow-up, execution continuation.

Return strict JSON only:
{"category":"QUICK"|"READER"|"VISUAL"|"DEEP"|"ULTRABRAIN"|"WRITING"|"ARCHITECT"|"EXECUTOR","reason":"short reason"}

User request:
${userPrompt}`;
}

function heuristicDecision(
	userPrompt: string,
	options: { readonly allowDefault: boolean },
): PizzaDecision | undefined {
	const lower = userPrompt.toLowerCase();
	if (/\b(typo|rename|format|formatting|small|simple|one[- ]?line)\b|오타|이름\s*변경|간단|작게/.test(lower)) {
		return { category: "QUICK", reason: "Heuristic quick-task keyword match." };
	}
	if (/\b(ui|ux|css|react|html|layout|style|styling|component|animation|design)\b|화면|스타일|레이아웃|디자인|컴포넌트|프론트/.test(lower)) {
		return { category: "VISUAL", reason: "Heuristic frontend keyword match." };
	}
	if (/\b(readme|docs?|documentation|prose|copy|release notes?|changelog)\b|문서|글|릴리즈|체인지로그/.test(lower)) {
		return { category: "WRITING", reason: "Heuristic writing keyword match." };
	}
	if (/\b(analy[sz]e|explain|summari[sz]e|how does|what is|review)\b|분석|설명|요약|리뷰/.test(lower)) {
		return { category: "READER", reason: "Heuristic analysis keyword match." };
	}
	if (/\b(architecture|architect|algorithm|distributed|migration|threat model)\b|아키텍처|알고리즘|마이그레이션|설계/.test(lower)) {
		return { category: "ULTRABRAIN", reason: "Heuristic deep reasoning keyword match." };
	}
	if (/\b(refactor|debug|fix|implement|add|change|test|typescript|backend|api|script)\b|리팩터|디버그|수정|구현|추가|변경|테스트|백엔드|스크립트/.test(lower)) {
		return { category: "DEEP", reason: "Heuristic implementation keyword match." };
	}
	if (options.allowDefault) {
		return { category: "QUICK", reason: "Default heuristic route." };
	}
	return undefined;
}

function isPizzaCategory(value: unknown): value is PizzaCategory {
	return (
		value === "QUICK" ||
		value === "READER" ||
		value === "VISUAL" ||
		value === "DEEP" ||
		value === "ULTRABRAIN" ||
		value === "WRITING" ||
		value === "ARCHITECT" ||
		value === "EXECUTOR"
	);
}
