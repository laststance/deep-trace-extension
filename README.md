# Deep Trace Navigation

Replay deep-trace Markdown tables as native VS Code editor navigation steps.

## Features

- **Load trace from clipboard** — Paste a deep-trace Markdown table and instantly navigate through execution steps.
- **Step-by-step navigation** — Move forward and backward through trace entries with Next / Previous commands.
- **Inline step annotation** — The current step's description is shown right above its line, with `prev` / `next` actions.
- **Tab navigation** — While the cursor is on the current step line, `Tab` / `Shift+Tab` moves to the next / previous step.
- **Go to Definition** — Jump directly to the source location of the current trace step.
- **Trace Breakpoints** — Set or clear debugger breakpoints for every trace target line.
- **Bundled `deep-trace` agent skill** — Ask the chat agent to `/deep-trace` a PR or file and it produces a trace table you can load straight into this extension.
- **Activity bar panel** — Dedicated sidebar view showing the full trace as a tree.

## Usage

1. Copy a deep-trace Markdown table to your clipboard.
2. Open the **Deep Trace** panel in the activity bar.
3. Click **Load Trace from Clipboard** (or run the command from the palette).
4. Use **Next Step** / **Previous Step** to walk through the execution path.

## Bundled agent skill

This extension contributes the [`deep-trace`](https://github.com/laststance/skills/tree/main/skills/deep-trace) skill through the `chatSkills` contribution point, so it is available in VS Code chat (agent mode) without a separate install.

1. In chat, run `/deep-trace <pr-number-or-file-path>`.
2. The skill outputs a trace plus an extension-ready table and, when possible, copies that table to the clipboard.
3. Run **Deep Trace: Load Trace from Clipboard** to step through it.

The skill files live in `skills/deep-trace/` and are copied from [laststance/skills](https://github.com/laststance/skills) (commit `9c14dc1`), with the helper script path in Step 6.5 adjusted to resolve relative to the bundled `SKILL.md`.

## Supported trace format

Deep Trace Navigation reads Markdown tables from your clipboard. At minimum, the table needs a file/path column and a line column.

```markdown
| file | line | column | reason |
|------|------|--------|--------|
| src/extension.ts | 322 | 1 | VS Code activates the extension |
| src/parser/traceParser.ts | 23 | 1 | The clipboard table is parsed |
```

Accepted header aliases include:

- `file` or `path`
- `line`
- `column`, `col`, or `character`
- `reason`, `why`, `summary`, or `title`

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

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `deepTrace.tabNavigation` | `true` | Use `Tab` / `Shift+Tab` to move between steps while the cursor is on the current step line. Elsewhere `Tab` indents as usual. |

The inline annotation is rendered as a CodeLens, so it requires `editor.codeLens` to be enabled.

Its color and size follow your color theme's CodeLens style. If the annotation is hard to read, override it in your `settings.json` (this also affects other CodeLenses such as reference counts):

```jsonc
"workbench.colorCustomizations": {
  "editorCodeLens.foreground": "#e5c07b"
},
"editor.codeLensFontSize": 13
```

## Requirements

- VS Code 1.138.0 or later

## Privacy

Deep Trace Navigation does not send trace data anywhere. Clipboard contents are parsed locally inside VS Code, and the active trace session is stored only in VS Code workspace state so it can be restored in the same workspace.

## License

MIT
