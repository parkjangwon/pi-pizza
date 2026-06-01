# 🍕 pi-pizza

<img width="866" height="524" alt="Screenshot 2026-06-01 at 15-20-01 —" src="https://github.com/user-attachments/assets/3a90ac9f-2dc9-48a7-ba92-25ab3588361e" />

`pi-pizza` is a stock `pi` package that adds the Pizza startup mascot and a `pizza/auto` model provider.

The package keeps `pi` itself unmodified. Install it as an extension package, then use the `pizza/auto` model to route each turn to a task-appropriate provider/model.

## Features

- Registers a `pizza/auto` model provider.
- Sets `pizza/auto` as the global default model after the extension first loads.
- Keeps explicit CLI choices intact: `pi --model ...` or `pi --provider ...` are not overwritten.
- Shows the Pizza mascot in the startup header while keeping the stock `pi` help text.
- Creates `~/.pi/agent/pizza.json` on first load.
- Routes turns across six roles: planner, reader, easy builder, hard backend builder, hard frontend builder, and executor.
- Prints routing decisions to stderr, for example:

```text
[pizza] 🍕 Routing to CodeBuilder [Easy / GENERAL]: opencode-go/deepseek-v4-pro
```

## Install

Install the published npm package:

```bash
pi install npm:pi-pizza
pi
```

After the first run, plain `pi` uses `pizza/auto` by default.

From a local checkout:

```bash
git clone https://github.com/parkjangwon/pi-pizza.git
cd pi-pizza
npm install --ignore-scripts
pi install .
pi
```

For one-off local testing without installing:

```bash
pi -e .
```

## Default Model Behavior

After the extension first loads, it writes these global defaults to `~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "pizza",
  "defaultModel": "auto"
}
```

That means plain `pi` will use `pizza/auto` on later runs.

To bypass Pizza for a single run, pass a model explicitly:

```bash
pi --model anthropic/claude-sonnet-4-5
```

## Configuration

On first load, `pi-pizza` creates `~/.pi/agent/pizza.json`:

```json
{
  "plannerModel": "",
  "readerModel": "",
  "builderEasyModel": "",
  "builderHardBackendModel": "",
  "builderHardFrontendModel": "",
  "executorModel": ""
}
```

Leave a field blank for auto-detection, or set a concrete `provider/model-id`.

### Roles

`pi-pizza` uses six model roles. You can leave all roles blank and let the extension choose from authenticated models, or pin individual roles when you want stronger cost/latency/quality control.

| Role | What it does | Good fit |
| --- | --- | --- |
| `plannerModel` | Classifies the user request by difficulty and domain before routing. | Fast, cheap, reliable instruction-following model. Use a mini/chat model. |
| `readerModel` | Reads high-context prompts and also performs the routing classification call. | Cheap long-context model. Gemini Flash-style models are a good fit. |
| `builderEasyModel` | Handles simple edits, small commands, light explanations, and routine tasks. | Low-cost fast model. Prefer cheap coding-capable chat models. |
| `builderHardBackendModel` | Handles complex backend logic, algorithms, TypeScript errors, and system refactors. | Strong coding/reasoning model. Prefer Sonnet/GPT/Codex/DeepSeek-style reasoning models. |
| `builderHardFrontendModel` | Handles UI component structure, CSS/layout details, and visual frontend work. | Strong frontend-writing model. Claude Sonnet-style models are a good fit. |
| `executorModel` | Handles post-tool execution turns and command-output diagnosis. | Very low-latency model. Prefer fast chat models that are good at concise debugging. |

### Model Suggestions

Use model IDs that appear in your own `pi --list-models` output. Exact model IDs change over time, so treat these as examples:

| Goal | Example choices |
| --- | --- |
| Best quality | `anthropic/claude-sonnet-4-5`, `openai/gpt-5.2`, `openai/gpt-5.2-codex` |
| Cost-effective general routing | `deepseek/deepseek-chat`, `openai/gpt-5-mini`, `google/gemini-2.5-flash` |
| Long-context reading | `google/gemini-2.5-flash`, `google/gemini-2.5-pro` |
| Backend-heavy coding | `anthropic/claude-sonnet-4-5`, `openai/gpt-5.2-codex`, `deepseek/deepseek-coder` |
| Frontend-heavy coding | `anthropic/claude-sonnet-4-5`, `google/gemini-2.5-pro`, `openai/gpt-5.2` |
| Fast execution diagnosis | `groq/*`, `deepseek/deepseek-chat`, `openai/gpt-5-nano` |

The safest starting point is to set only the hard builder roles and leave the cheap/fast roles blank:

```json
{
  "plannerModel": "",
  "readerModel": "",
  "builderEasyModel": "",
  "builderHardBackendModel": "anthropic/claude-sonnet-4-5",
  "builderHardFrontendModel": "anthropic/claude-sonnet-4-5",
  "executorModel": ""
}
```

Example:

```json
{
  "plannerModel": "deepseek/deepseek-chat",
  "readerModel": "google/gemini-2.0-flash",
  "builderEasyModel": "opencode-go/deepseek-v4-pro",
  "builderHardBackendModel": "anthropic/claude-sonnet-4-5",
  "builderHardFrontendModel": "anthropic/claude-sonnet-4-5",
  "executorModel": "groq/llama-3.3-70b-versatile"
}
```

Only models already known to `pi` and configured with auth can be selected automatically.

## Commands

- `/pizza` shows whether the extension is active and where the config lives.
- `/pizza-models` shows the resolved concrete model for each Pizza role.
- `/pizza-reset` asks for confirmation, then deletes `~/.pi/agent/pizza.json`.
- `/pizza-header-reset` restores the built-in `pi` startup header for the current session.

## Development

```bash
npm install --ignore-scripts
npm run check
```

The package is loaded by the `pi` manifest in `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions/index.ts"]
  }
}
```
