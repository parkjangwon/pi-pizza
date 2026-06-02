import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  streamSimple,
} from "@earendil-works/pi-ai";
import type { ProviderConfig } from "@earendil-works/pi-coding-agent";
import { resolveConfig } from "./config.ts";
import { PizzaRuntimeError } from "./errors.ts";
import { selectModel } from "./router.ts";
import type { ModelLookup, PizzaCategory, PizzaResolvedConfig } from "./types.ts";

export interface RouteEntry {
	readonly timestamp: number;
	readonly category: PizzaCategory;
	readonly label: string;
	readonly model: string;
	readonly reason: string;
}

export class PizzaRuntime {
  private modelLookup: ModelLookup | undefined;
  private config: PizzaResolvedConfig | undefined;
  private routeHistory: RouteEntry[] = [];

  bind(modelLookup: ModelLookup): void {
    this.modelLookup = modelLookup;
    this.config = resolveConfig(modelLookup);
  }

  createProviderConfig(): ProviderConfig {
    return {
			name: "Pizza",
			baseUrl: "https://pizza.local",
			apiKey: "pizza-router",
      api: "pizza-router",
      streamSimple: (_model, context, options) => this.route(context, options),
      models: [
        {
          id: "auto",
          name: "Pizza Auto Router",
          api: "pizza-router",
          reasoning: true,
          input: ["text", "image"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1000000,
          maxTokens: 64000,
        },
      ],
    };
  }

  describe(): string {
    return `pi-pizza is active. Config: ~/.pi/agent/pizza.json. Select pizza/auto to route turns automatically.`;
  }

  describeModels(): string {
    const config = this.requireConfig();
    return [
      "Pizza models:",
      formatRole("planner", "plannerModel", config.plannerModel),
      formatRole("reader", "readerModel", config.readerModel),
      formatRole("quick", "quickModel", config.quickModel),
      formatRole("deep", "deepModel", config.deepModel),
      formatRole("visual", "visualModel", config.visualModel),
      formatRole("executor", "executorModel", config.executorModel),
      formatRole("architect", "architectModel", config.architectModel),
      "",
      "Routes:",
      "QUICK -> quick",
      "READER -> reader",
      "VISUAL -> visual",
      "DEEP -> deep",
      "ULTRABRAIN -> architect",
      "WRITING -> reader",
      "ARCHITECT -> architect",
      "EXECUTOR -> executor",
    ].join("\n");
  }

  private route(context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream {
    const stream = createAssistantMessageEventStream();
    void this.pipeRoutedStream(stream, context, options);
    return stream;
  }

  private async pipeRoutedStream(
    output: AssistantMessageEventStream,
    context: Context,
    options: SimpleStreamOptions | undefined,
  ): Promise<void> {
    try {
			const modelLookup = this.requireModelLookup();
			const config = this.requireConfig();
			if (!hasConcreteModels(config)) {
				throw new PizzaRuntimeError("No authenticated non-pizza models are available for routing.");
			}

			const routed = await selectModel(config, modelLookup, context);
			const entry: RouteEntry = {
				timestamp: Date.now(),
				category: routed.category,
				label: routed.label,
				model: `${routed.model.provider}/${routed.model.id}`,
				reason: routed.reason,
			};
			this.routeHistory.push(entry);
			if (this.routeHistory.length > 10) this.routeHistory.shift();
			process.stderr.write(
				`[pizza] 🍕 ${entry.category} -> ${entry.label}: ${entry.model} (${entry.reason})\n`,
			);

      if (!routed.auth.ok) {
        throw new PizzaRuntimeError(routed.auth.error);
      }

      const input = streamSimple(routed.model, context, mergeOptions(options, routed.auth));
      for await (const event of input) {
        output.push(event);
      }
      output.end();
    } catch (error) {
      output.push({ type: "error", reason: "error", error: createErrorMessage(error) });
      output.end();
    }
  }

  getLastRoute(): string {
    if (this.routeHistory.length === 0) {
      return "No routing has occurred yet.";
    }
    return this.routeHistory
      .map(
        (r) =>
          `[${new Date(r.timestamp).toLocaleTimeString()}] 🍕 ${r.category} -> ${r.label}: ${r.model} (${r.reason})`,
      )
      .join("\n");
  }

  getRouteHistory(): RouteEntry[] {
    return [...this.routeHistory];
  }

  private requireModelLookup(): ModelLookup {
    if (!this.modelLookup) {
      throw new PizzaRuntimeError("pi-pizza has not been bound to a pi session yet.");
    }
    return this.modelLookup;
  }

  private requireConfig(): PizzaResolvedConfig {
    if (!this.config) {
      throw new PizzaRuntimeError("pi-pizza config is not loaded yet.");
    }
    return this.config;
  }
}

function mergeOptions(
  options: SimpleStreamOptions | undefined,
  auth: { readonly apiKey?: string; readonly headers?: Record<string, string> },
): SimpleStreamOptions {
  return {
    ...options,
    ...(auth.apiKey ? { apiKey: auth.apiKey } : {}),
    ...(auth.headers ? { headers: { ...options?.headers, ...auth.headers } } : {}),
  };
}

function formatRole(label: string, key: string, model: Model<Api>): string {
	return `${label}: ${model.provider}/${model.id} (${key})`;
}

function hasConcreteModels(config: PizzaResolvedConfig): boolean {
	return [
		config.plannerModel,
		config.readerModel,
		config.quickModel,
		config.deepModel,
		config.visualModel,
		config.executorModel,
		config.architectModel,
	].some((model) => model.provider !== "pizza");
}

function createErrorMessage(error: unknown): AssistantMessage {
  const message = error instanceof Error ? error.message : String(error);
  return {
    role: "assistant",
    content: [],
    api: "pizza-router",
    provider: "pizza",
    model: "auto",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "error",
    errorMessage: message,
    timestamp: Date.now(),
  };
}
