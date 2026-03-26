# Deep Trace Navigation Design

**Date:** 2026-03-11

## Goal

Build a VS Code/Cursor extension that replays a `deep-trace` Markdown table as a native editor navigation flow. The extension must let the user load trace steps, move forward and backward across steps, reveal each location in the editor, and optionally jump to the symbol definition for the current step.

## Why This Design

- A native `TreeView` matches VS Code interaction patterns better than a custom webview.
- Markdown input keeps the first version aligned with how `deep-trace` output is already shared in chat.
- A small set of services keeps parsing, state, editor navigation, and UI concerns separated so future JSON or ACP integrations can be added without rewriting the core flow.

## In Scope

- Load a `deep-trace` Markdown table from the clipboard.
- Parse the table into internal `TraceStep` objects.
- Show the steps in a sidebar `TreeView`.
- Add `Next`, `Previous`, `Reveal Current Step`, and `Go to Definition from Current Step` commands.
- Open files with `showTextDocument`, apply a focused selection, and center the current step with `revealRange`.
- Highlight the active step in the editor with a temporary line decoration.
- Persist the loaded trace and current index in workspace state.

## Out of Scope

- ACP integration.
- Automatic extraction from live Cursor chat messages.
- Rich webview rendering.
- Multi-workspace trace merging.
- Deep symbol graph reconstruction beyond the current step's definition lookup.

## User Experience

### Entry Point

The user runs `Deep Trace: Load Trace from Clipboard` from the Command Palette or the trace view title bar.

### Trace View

The extension contributes a dedicated activity bar container with a single `TreeView` that lists trace steps in order. Each item shows a stable index, a short title, and a secondary description derived from the file path and line number.

### Navigation

- Clicking a trace step reveals it in the editor.
- `Next` and `Previous` move across the sequence and keep the tree selection synchronized.
- `Reveal Current Step` re-opens the current step if the user has moved elsewhere.
- `Go to Definition from Current Step` resolves symbol definitions from the current cursor anchor. When multiple definitions exist, the extension presents a quick pick.

### Empty and Error States

- If no trace is loaded, the view shows welcome content with a command link.
- If parsing fails, the extension shows a specific error message describing the missing or malformed columns.
- If a file cannot be resolved, the tree item stays available but navigation shows an error and keeps the current session intact.

## Data Model

```ts
type TraceStep = {
  id: string;
  index: number;
  title: string;
  file: string;
  line: number;
  column: number;
  reason: string;
  raw: Record<string, string>;
};
```

### Parsing Strategy

- Accept Markdown tables with flexible column names such as `file`, `path`, `line`, `col`, `column`, `reason`, `why`, or `summary`.
- Normalize whitespace and remove code fences if the user pastes a fenced Markdown block.
- Default the column to `1` when not provided.
- Use explicit validation errors when the file or line column is missing.

## Architecture

### `src/extension.ts`

Registers commands, initializes services, wires the tree view, and restores the last session.

### `src/models/traceStep.ts`

Contains the `TraceStep` type and small related helpers.

### `src/parser/traceParser.ts`

Converts Markdown table content into validated `TraceStep[]`.

### `src/state/traceSessionStore.ts`

Owns the active trace session, current index, persistence, and event emission for UI refreshes.

### `src/services/navigationService.ts`

Resolves file URIs, opens documents, applies selections, reveals ranges, and updates line decorations.

### `src/services/definitionService.ts`

Calls `vscode.commands.executeCommand('vscode.executeDefinitionProvider', ...)` for the current step and handles zero, one, or many definition results.

### `src/views/traceTreeProvider.ts`

Implements `TreeDataProvider`, generates `TreeItem`s, and exposes parent relationships so `TreeView.reveal` can keep the current item visible.

## Technical Decisions

### UI Choice

Use `TreeView` instead of `QuickPick` or `Webview`.

- Reason: native, persistent, keyboard-friendly, and low maintenance.
- Trade-off: slightly more scaffolding than a command-only flow.
- Impact: requires view contributions and a dedicated provider.

### State Persistence

Use `ExtensionContext.workspaceState`.

- Reason: enough for one workspace and survives reloads.
- Trade-off: state stays local and is not intended for cross-machine sync.
- Impact: small serialization layer for the active session.

### Navigation Focus

Use `showTextDocument(uri, { selection, preview: false })` followed by `editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport)`.

- Reason: this is the simplest native path for deterministic navigation.
- Trade-off: navigation takes editor focus by default.
- Impact: predictable editor behavior and no custom editor logic needed.

## Verification Plan

- Add parser unit tests that cover valid input, missing columns, optional column defaults, and fenced Markdown input.
- Run TypeScript build successfully.
- Run tests successfully.
- Check editor diagnostics after substantive edits.

## Future Extensions

- Add `Load Trace from File`.
- Add JSON input alongside Markdown.
- Add richer labels from trace metadata such as URL, screen, or symbol.
- Add per-step secondary actions like `Open Definition`, `Copy Location`, and `Open Beside`.
