import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { deleteConfigFile, getConfigPath } from "../src/config.ts";
import { registerMascot } from "../src/mascot.ts";
import { clearCategoryDecisionCache } from "../src/router-decision.ts";
import { PizzaRuntime } from "../src/runtime.ts";
import {
	ensurePizzaDefaultSettings,
	hasExplicitModelSelection,
} from "../src/settings.ts";

export default function (pi: ExtensionAPI): void {
	const runtime = new PizzaRuntime();

	pi.registerProvider("pizza", runtime.createProviderConfig());
	registerMascot(pi);

	pi.on("session_start", (_event, ctx) => {
		clearCategoryDecisionCache();
		runtime.bind(ctx.modelRegistry);
		const appliedDefaults = ensurePizzaDefaultSettings();
		if (
			appliedDefaults &&
			!hasExplicitModelSelection() &&
			ctx.model?.provider !== "pizza"
		) {
			const pizzaAuto = ctx.modelRegistry.find("pizza", "auto");
			if (pizzaAuto) {
				void pi.setModel(pizzaAuto);
			}
		}
	});

	pi.registerCommand("pizza", {
		description: "Show pi-pizza routing configuration",
		handler: async (_args, ctx) => {
			runtime.bind(ctx.modelRegistry);
			ctx.ui.notify(runtime.describe(), "info");
		},
	});

	pi.registerCommand("pizza-route", {
		description: "Show recent routing decisions, or dry-run a prompt when arguments are provided",
		handler: async (args, ctx) => {
			runtime.bind(ctx.modelRegistry);
			const prompt = args.trim();
			try {
				const info = prompt ? await runtime.previewRoute(prompt) : runtime.getLastRoute();
				ctx.ui.notify(info, "info");
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
			}
		},
	});

	pi.registerCommand("pizza-models", {
		description: "Show resolved pi-pizza role models",
		handler: async (_args, ctx) => {
			runtime.bind(ctx.modelRegistry);
			ctx.ui.notify(runtime.describeModels(), "info");
		},
	});

	pi.registerCommand("pizza-reset", {
		description: "Delete ~/.pi/agent/pizza.json after confirmation",
		handler: async (_args, ctx) => {
			const configPath = getConfigPath();
			const confirmed = await ctx.ui.confirm(
				"Delete pi-pizza config?",
				`Delete ${configPath}?`,
			);
			if (!confirmed) {
				ctx.ui.notify("pi-pizza config deletion cancelled", "info");
				return;
			}
			const deleted = deleteConfigFile();
			runtime.bind(ctx.modelRegistry);
			runtime.reloadConfig();
			ctx.ui.notify(
				deleted
					? `Deleted ${configPath} and reloaded pi-pizza config`
					: `No config file found at ${configPath}; pi-pizza config reloaded`,
				"info",
			);
		},
	});
}
