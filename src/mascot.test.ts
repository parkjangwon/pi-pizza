import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerMascot } from "./mascot.ts";

type SessionStartHandler = (event: unknown, ctx: unknown) => void;

function createPiHarness(): { pi: ExtensionAPI; sessionStart: SessionStartHandler | undefined } {
  let sessionStart: SessionStartHandler | undefined;
  const pi = {
    on: vi.fn((event: string, handler: SessionStartHandler) => {
      if (event === "session_start") sessionStart = handler;
    }),
    registerCommand: vi.fn(),
  } as unknown as ExtensionAPI;
  registerMascot(pi);
  return { pi, sessionStart };
}

describe("registerMascot", () => {
  const tempHomes: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const tempHome of tempHomes) {
      rmSync(tempHome, { recursive: true, force: true });
    }
    tempHomes.length = 0;
  });

  function writePizzaConfig(home: string, mascot: unknown): void {
    mkdirSync(join(home, ".pi", "agent"), { recursive: true });
    writeFileSync(
      join(home, ".pi", "agent", "pizza.json"),
      JSON.stringify({
        plannerModel: "",
        readerModel: "",
        quickModel: "",
        deepModel: "",
        visualModel: "",
        executorModel: "",
        architectModel: "",
        mascot,
      }),
      "utf8",
    );
  }

  it("registers the session_start header listener when mascot is true", () => {
    const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
    tempHomes.push(tempHome);
    vi.stubEnv("HOME", tempHome);
    writePizzaConfig(tempHome, true);

    const { pi, sessionStart } = createPiHarness();

    expect(pi.on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(sessionStart).toBeDefined();
    expect(pi.registerCommand).toHaveBeenCalledWith("pizza-header-reset", expect.any(Object));
  });

  it("skips the session_start listener when mascot is false", () => {
    const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
    tempHomes.push(tempHome);
    vi.stubEnv("HOME", tempHome);
    writePizzaConfig(tempHome, false);

    const { pi, sessionStart } = createPiHarness();

    expect(pi.on).not.toHaveBeenCalled();
    expect(sessionStart).toBeUndefined();
    // header-reset stays available even with the mascot off
    expect(pi.registerCommand).toHaveBeenCalledWith("pizza-header-reset", expect.any(Object));
  });

  it("skips the session_start listener when a real-world config has mascot:false", () => {
    const tempHome = join(tmpdir(), `pi-pizza-${randomUUID()}`);
    tempHomes.push(tempHome);
    vi.stubEnv("HOME", tempHome);
    mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
    // Mirrors an actual user config with concrete role models + mascot disabled.
    writeFileSync(
      join(tempHome, ".pi", "agent", "pizza.json"),
      JSON.stringify({
        plannerModel: "opencode-go/deepseek-v4-flash",
        readerModel: "opencode-go/kimi-k2.6",
        quickModel: "zai/glm-4.5-air",
        deepModel: "opencode-go/deepseek-v4-flash",
        visualModel: "opencode-go/deepseek-v4-pro",
        executorModel: "zai/glm-4.5-air",
        architectModel: "openai-codex/gpt-5.5",
        mascot: false,
      }),
      "utf8",
    );

    const { pi, sessionStart } = createPiHarness();

    expect(pi.on).not.toHaveBeenCalled();
    expect(sessionStart).toBeUndefined();
  });
});
