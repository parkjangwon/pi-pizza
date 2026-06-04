import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const runtimeMocks = vi.hoisted(() => ({
	bind: vi.fn(),
	createProviderConfig: vi.fn(() => ({ name: "Pizza", api: "pizza-router", models: [] })),
	describe: vi.fn(() => "pizza active"),
	describeModels: vi.fn(() => "Pizza models"),
	getLastRoute: vi.fn(() => "No routing has occurred yet."),
	previewRoute: vi.fn(async () => "preview result"),
	reloadConfig: vi.fn(() => true),
}));

const configMocks = vi.hoisted(() => ({
	deleteConfigFile: vi.fn(() => true),
	getConfigPath: vi.fn(() => "/tmp/pizza.json"),
}));

const settingsMocks = vi.hoisted(() => ({
	ensurePizzaDefaultSettings: vi.fn(() => true),
	hasExplicitModelSelection: vi.fn(() => false),
}));

vi.mock("../src/runtime.ts", () => ({
	PizzaRuntime: vi.fn(function PizzaRuntimeMock() {
		return runtimeMocks;
	}),
}));

vi.mock("../src/config.ts", () => configMocks);
vi.mock("../src/settings.ts", () => settingsMocks);
vi.mock("../src/mascot.ts", () => ({ registerMascot: vi.fn() }));

const extensionModule = await import("./index.ts");
const registerPizzaExtension = extensionModule.default;

type CommandHandler = (args: string, ctx: any) => Promise<void>;

function createPiHarness() {
	const commands = new Map<string, CommandHandler>();
	const pi = {
		registerProvider: vi.fn(),
		registerCommand: vi.fn((name: string, command: { readonly handler: CommandHandler }) => {
			commands.set(name, command.handler);
		}),
		on: vi.fn(),
		setModel: vi.fn(),
	} as unknown as ExtensionAPI;
	registerPizzaExtension(pi);
	return { pi, commands };
}

function createContext() {
	return {
		modelRegistry: { find: vi.fn() },
		ui: {
			notify: vi.fn(),
			confirm: vi.fn(async () => true),
		},
	};
}

describe("pi-pizza extension commands", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		runtimeMocks.previewRoute.mockResolvedValue("preview result");
		runtimeMocks.getLastRoute.mockReturnValue("No routing has occurred yet.");
		configMocks.deleteConfigFile.mockReturnValue(true);
	});

	it("uses route preview when /pizza-route receives prompt text", async () => {
		const { commands } = createPiHarness();
		const ctx = createContext();

		await commands.get("pizza-route")?.("  Polish this React layout  ", ctx);

		expect(runtimeMocks.bind).toHaveBeenCalledWith(ctx.modelRegistry);
		expect(runtimeMocks.previewRoute).toHaveBeenCalledWith("Polish this React layout");
		expect(runtimeMocks.getLastRoute).not.toHaveBeenCalled();
		expect(ctx.ui.notify).toHaveBeenCalledWith("preview result", "info");
	});

	it("shows route history when /pizza-route has no prompt text", async () => {
		const { commands } = createPiHarness();
		const ctx = createContext();

		await commands.get("pizza-route")?.("   ", ctx);

		expect(runtimeMocks.previewRoute).not.toHaveBeenCalled();
		expect(runtimeMocks.getLastRoute).toHaveBeenCalled();
		expect(ctx.ui.notify).toHaveBeenCalledWith("No routing has occurred yet.", "info");
	});

	it("reports /pizza-route dry-run errors without throwing", async () => {
		const { commands } = createPiHarness();
		const ctx = createContext();
		runtimeMocks.previewRoute.mockRejectedValueOnce(new Error("planner auth failed"));

		await expect(commands.get("pizza-route")?.("ambiguous request", ctx)).resolves.toBeUndefined();

		expect(ctx.ui.notify).toHaveBeenCalledWith("planner auth failed", "error");
	});

	it("reloads current-session config after confirmed /pizza-reset", async () => {
		const { commands } = createPiHarness();
		const ctx = createContext();

		await commands.get("pizza-reset")?.("", ctx);

		expect(ctx.ui.confirm).toHaveBeenCalledWith("Delete pi-pizza config?", "Delete /tmp/pizza.json?");
		expect(configMocks.deleteConfigFile).toHaveBeenCalled();
		expect(runtimeMocks.bind).toHaveBeenCalledWith(ctx.modelRegistry);
		expect(runtimeMocks.reloadConfig).toHaveBeenCalled();
		expect(ctx.ui.notify).toHaveBeenCalledWith("Deleted /tmp/pizza.json and reloaded pi-pizza config", "info");
	});
});
