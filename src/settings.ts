import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const PIZZA_PROVIDER = "pizza";
const PIZZA_MODEL = "auto";

export function hasExplicitModelSelection(argv: readonly string[] = process.argv): boolean {
  return argv.includes("--model") || argv.includes("--provider");
}

export function ensurePizzaDefaultSettings(): boolean {
  const settingsPath = join(homedir(), ".pi", "agent", "settings.json");
  const current = readSettings(settingsPath);
  if (current["defaultProvider"] === PIZZA_PROVIDER && current["defaultModel"] === PIZZA_MODEL) {
    return false;
  }

  const next = {
    ...current,
    defaultProvider: PIZZA_PROVIDER,
    defaultModel: PIZZA_MODEL,
  };
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return true;
}

function readSettings(settingsPath: string): Record<string, unknown> {
  if (!existsSync(settingsPath)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return Object.fromEntries(Object.entries(parsed));
}
