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
import type { ModelLookup, PizzaResolvedConfig } from "./types.ts";

export class PizzaRuntime {
  private modelLookup: ModelLookup | undefined;
  private config: PizzaResolvedConfig | undefined;

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
      formatRole("plannerModel", config.plannerModel),
      formatRole("readerModel", config.readerModel),
      formatRole("builderEasyModel", config.builderEasyModel),
      formatRole("builderHardBackendModel", config.builderHardBackendModel),
      formatRole("builderHardFrontendModel", config.builderHardFrontendModel),
      formatRole("executorModel", config.executorModel),
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
      process.stderr.write(`[pizza] 🍕 Routing to ${routed.label}: ${routed.model.provider}/${routed.model.id}\n`);

      const auth = await modelLookup.getApiKeyAndHeaders(routed.model);
      if (!auth.ok) {
        throw new PizzaRuntimeError(auth.error);
      }

      const input = streamSimple(routed.model, context, mergeOptions(options, auth));
      for await (const event of input) {
        output.push(event);
      }
      output.end();
    } catch (error) {
      output.push({ type: "error", reason: "error", error: createErrorMessage(error) });
      output.end();
    }
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

function formatRole(role: string, model: Model<Api>): string {
	return `${role}: ${model.provider}/${model.id}`;
}

function hasConcreteModels(config: PizzaResolvedConfig): boolean {
	return [
		config.plannerModel,
		config.readerModel,
		config.builderEasyModel,
		config.builderHardBackendModel,
		config.builderHardFrontendModel,
		config.executorModel,
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
