import type { Context } from "@earendil-works/pi-ai";
import { routeForCategory } from "./router-categories.ts";
import {
	isPlanningRequest,
	selectCategory,
} from "./router-decision.ts";
import type { ModelLookup, PizzaResolvedConfig, RoutedModel } from "./types.ts";

export { isPlanningRequest };

export async function selectModel(
	config: PizzaResolvedConfig,
	modelLookup: ModelLookup,
	context: Context,
): Promise<RoutedModel> {
	const decision = await selectCategory(config, modelLookup, context);
	return routeForCategory(
		config,
		modelLookup,
		decision.category,
		decision.reason,
	);
}
