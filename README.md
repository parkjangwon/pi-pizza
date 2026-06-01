# pi-pizza

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

From npm:

```bash
pi install npm:pi-pizza
pi
```

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
