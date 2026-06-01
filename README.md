# pi-pizza

Pizza adds a startup mascot and a `pizza/auto` model provider to stock `pi`.

## Install

```bash
pi install npm:pi-pizza
```

For local development:

```bash
pi install /Users/pjw/dev/project/pi-pizza
pi
```

After the extension first loads, it sets the global default model to `pizza/auto`.

## Configuration

On first load, pi-pizza creates `~/.pi/agent/pizza.json`:

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

Leave fields blank for auto-detection, or set a specific `provider/model-id`.

## Commands

- `/pizza` shows the current routing config.
- `/pizza-models` lists the concrete models selected for each role.
- `/pizza-reset` asks for `y/n` confirmation, then deletes `~/.pi/agent/pizza.json` when confirmed.
