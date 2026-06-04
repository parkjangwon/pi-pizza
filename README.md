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
- Routes turns by task category: quick, reader, visual, deep, ultrabrain, writing, architect, and executor.
- Prints routing decisions to stderr, for example:

```text
[pizza] 🍕 VISUAL -> CodeBuilder [Visual]: anthropic/claude-sonnet-4-5 (Heuristic frontend keyword match.)
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
  "quickModel": "",
  "deepModel": "",
  "visualModel": "",
  "executorModel": "",
  "architectModel": ""
}
```

Leave a field blank for auto-detection, or set a concrete `provider/model-id`.

The seven top-level fields are role defaults. `plannerModel` decides the route, and the other roles are used when a turn lands in a matching category.

For more control, add an optional `categoryModels` object. These are category-specific override chains. pi-pizza tries them first, skips unauthenticated entries, then falls back to the matching role default and auto-detected models.

```json
{
  "categoryModels": {
    "VISUAL": [
      "google/gemini-2.5-pro",
      "anthropic/claude-sonnet-4-5"
    ],
    "DEEP": [
      "openai/gpt-5.2-codex",
      "anthropic/claude-sonnet-4-5"
    ],
    "QUICK": [
      "openai/gpt-5-mini",
      "deepseek/deepseek-chat"
    ]
  }
}
```

In short: `visualModel` is the normal default for visual work; `categoryModels.VISUAL` is an optional priority list for visual work.

### Roles

You can leave every role blank and let pi-pizza choose from authenticated models, or pin roles when you want stronger cost/latency/quality control.

| Role | What it does | Good fit |
| --- | --- | --- |
| `plannerModel` | Classifies the current user request into a routing category. Falls back to local heuristics if auth is unavailable. | Fast, cheap, reliable instruction-following model. Use a mini/chat model. |
| `readerModel` | Handles repository analysis, summaries, explanations, and writing-oriented turns. | Cheap long-context model. Gemini Flash-style models are a good fit. |
| `quickModel` | Handles `QUICK`: simple edits, small commands, light explanations, and routine tasks. | Low-cost fast model. Prefer cheap coding-capable chat models. |
| `deepModel` | Handles `DEEP`: complex backend logic, debugging, TypeScript errors, scripts, tests, and system refactors. | Strong coding/reasoning model. Prefer Sonnet/GPT/Codex/DeepSeek-style reasoning models. |
| `visualModel` | Handles `VISUAL`: UI component structure, CSS/layout details, and visual frontend work. | Strong frontend-writing model. Claude Sonnet-style models are a good fit. |
| `executorModel` | Handles `EXECUTOR`: post-tool execution turns and command-output diagnosis. | Very low-latency model. Prefer fast chat models that are good at concise debugging. |
| `architectModel` | Handles `ARCHITECT` and `ULTRABRAIN`: planning, architecture design, algorithms, and high-risk reasoning. Activated directly on `/plan`, `/skill:plan`, `/skill:ralplan`, `/skill:writing-plans`, or `/skill:executing-plans`. | Strongest reasoning model available. Prefer Opus/Sonnet/GPT-5/DeepSeek-Coder — anything with top-tier reasoning for complex design decisions. |

### Routing Categories

| Category | Routed role | Typical use |
| --- | --- | --- |
| `QUICK` | `quickModel` | Typos, simple commands, single-file edits, routine tasks. |
| `READER` | `readerModel` | Codebase analysis, summaries, explanations, "how does this work?" requests. |
| `VISUAL` | `visualModel` | React, HTML, CSS, UI/UX, styling, layout, animation, design. |
| `DEEP` | `deepModel` | Multi-file implementation, debugging, backend logic, refactors, type errors, tests. |
| `ULTRABRAIN` | `architectModel` | Complex architecture, algorithms, migration strategy, cross-system reasoning. |
| `WRITING` | `readerModel` | README, docs, prose, release notes, changelogs. |
| `ARCHITECT` | `architectModel` | Explicit planning/design mode. |
| `EXECUTOR` | `executorModel` | Tool-result follow-up and command-output diagnosis. |

Each category uses an ordered chain. For example, `VISUAL` first tries `categoryModels.VISUAL`, then `visualModel`, then auto-detected frontend/backend-capable fallbacks. If a candidate lacks auth, pi-pizza skips it and includes the skipped model/reason in `/pizza-route` and stderr routing output. If the final selected model still lacks auth, dry-run output marks that route with `would fail auth` before you spend a real turn on it.

Clear routing signals such as CSS/UI, README/docs, typo fixes, analysis requests, and architecture keywords are handled by local heuristics before calling `plannerModel`. Ambiguous requests still use `plannerModel`, and category auth checks are cached briefly to avoid repeated provider probing.

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

The safest starting point is to set only the architect/deep/visual roles and leave the cheap/fast roles blank:

```json
{
  "plannerModel": "",
  "readerModel": "",
  "quickModel": "",
  "deepModel": "anthropic/claude-sonnet-4-5",
  "visualModel": "anthropic/claude-sonnet-4-5",
  "executorModel": "",
  "architectModel": "anthropic/claude-sonnet-4-5"
}
```

Example:

```json
{
  "plannerModel": "deepseek/deepseek-chat",
  "readerModel": "google/gemini-2.0-flash",
  "quickModel": "opencode-go/deepseek-v4-pro",
  "deepModel": "anthropic/claude-sonnet-4-5",
  "visualModel": "anthropic/claude-sonnet-4-5",
  "executorModel": "groq/llama-3.3-70b-versatile",
  "architectModel": "anthropic/claude-sonnet-4-5"
}
```

Only models already known to `pi` and configured with auth can be selected automatically.

## Commands

- `/pizza` shows whether the extension is active and where the config lives.
- `/pizza-route` shows recent routing decisions. Pass text to dry-run routing without streaming a final model response, for example `/pizza-route Polish this React layout`. Ambiguous dry-runs may still call `plannerModel` to classify the request.
- `/pizza-models` shows the resolved concrete model for each Pizza role.
- `/pizza-reset` asks for confirmation, deletes `~/.pi/agent/pizza.json`, and reloads the config in the current session.
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
