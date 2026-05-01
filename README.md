# Deep Trace Navigation

Replay [deep-trace](https://github.com/laststance/deep-trace-extension) Markdown tables as native VS Code editor navigation steps.

## Features

- **Load trace from clipboard** — Paste a deep-trace Markdown table and instantly navigate through execution steps.
- **Step-by-step navigation** — Move forward and backward through trace entries with Next / Previous commands.
- **Go to Definition** — Jump directly to the source location of the current trace step.
- **Trace Breakpoints** — Set or clear debugger breakpoints for every trace target line.
- **Activity bar panel** — Dedicated sidebar view showing the full trace as a tree.

## Usage

1. Copy a deep-trace Markdown table to your clipboard.
2. Open the **Deep Trace** panel in the activity bar.
3. Click **Load Trace from Clipboard** (or run the command from the palette).
4. Use **Next Step** / **Previous Step** to walk through the execution path.

## Commands

| Command | Description |
|---------|-------------|
| `Deep Trace: Load Trace from Clipboard` | Parse and load a trace table from the clipboard |
| `Deep Trace: Next Step` | Navigate to the next trace step |
| `Deep Trace: Previous Step` | Navigate to the previous trace step |
| `Deep Trace: Reveal Current Step` | Reveal the current step in the editor |
| `Deep Trace: Go to Definition from Current Step` | Jump to the definition of the current step |
| `Deep Trace: Set Trace Breakpoints` | Add debugger breakpoints to each unique trace line |
| `Deep Trace: Clear Trace Breakpoints` | Remove breakpoints previously added by Deep Trace |

## Requirements

- VS Code 1.74.0 or later

## License

MIT
