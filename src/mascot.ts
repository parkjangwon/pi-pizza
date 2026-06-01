import chalk from "chalk";
import { VERSION, type ExtensionAPI, type Theme } from "@earendil-works/pi-coding-agent";

export function registerMascot(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setHeader((_tui, theme) => ({
      render: () => renderPizzaStartupLogo(VERSION, theme).split("\n"),
      invalidate: () => {},
    }));
  });

  pi.registerCommand("pizza-header-reset", {
    description: "Restore the built-in pi startup header",
    handler: async (_args, ctx) => {
      ctx.ui.setHeader(undefined);
      ctx.ui.notify("Built-in header restored", "info");
    },
  });
}

function renderPizzaStartupLogo(version: string, theme: Theme): string {
  const mascotLines = [
    chalk.white("  ▄███▄  "),
    chalk.white("   ███   "),
    chalk.hex("#D2B48C")(" ▐▛███▜▌ "),
    chalk.hex("#D2B48C")("▝▜█████▛▘"),
    chalk.hex("#D2B48C")("  ▘▘ ▝▝  "),
  ];

  const titleLine = `${theme.bold(theme.fg("accent", "pi"))}${theme.fg("dim", ` v${version}`)}`;
  const compactInstructions = theme.fg(
    "muted",
    "escape interrupt · ctrl+c/ctrl+d clear/exit · / commands · ! bash · ctrl+o more",
  );
  const compactOnboarding = theme.fg("dim", "Press ctrl+o to show full startup help and loaded resources.");
  const onboarding = theme.fg(
    "dim",
    "Pi can explain its own features and look up its docs. Ask it how to use or extend Pi.",
  );

  return [
    `${mascotLines[0]}  ${titleLine}`,
    `${mascotLines[1]}  ${compactInstructions}`,
    `${mascotLines[2]}  ${compactOnboarding}`,
    `${mascotLines[3]}`,
    `${mascotLines[4]}  ${onboarding}`,
  ].join("\n");
}
