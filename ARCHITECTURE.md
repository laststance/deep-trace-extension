# Architecture

Deep Trace Navigation turns a Markdown trace table into a list of editor steps and keeps every view of that list in sync.

## Flow

1. **Load Trace from Clipboard** reads the clipboard and calls {@link parseTraceMarkdown}. The parser accepts a bare table or one inside a fenced block, maps header aliases (`file`/`path`, `column`/`col`/`character`, `reason`/`why`/`summary`/`title`) and returns ordered {@link TraceStep} values.
2. {@link TraceSessionStore} owns the steps and the current index. It clamps movement, persists a snapshot to workspace state so the session survives a reload, and notifies subscribers on every change.
3. Subscribers react to the store:
   - {@link TraceTreeProvider} renders the steps in the **Deep Trace** activity bar view.
   - {@link NavigationService} opens the step's file, selects its position and highlights the line.
   - {@link StepAnnotationProvider} renders the current step's description as CodeLenses above its line.

`DeepTraceExtensionController` in `src/extension.ts` constructs these objects in {@link activate}, registers the commands, and disposes everything with the extension.

## Inline annotation and Tab navigation

{@link buildStepAnnotationLenses} is editor-independent: it returns the description lens (`n/total  reason`) and the `prev` / `next` action lenses for a step. {@link StepAnnotationProvider} places them on the current step's line when the document matches the step's resolved URI.

The provider also maintains the `deepTrace.canGoNextFromCursor` and `deepTrace.canGoPreviousFromCursor` context keys on every selection, editor and session change. The `Tab` / `Shift+Tab` keybindings require those keys plus the usual editor guards (no selection, suggestion, inline edit or snippet), so `Tab` keeps indenting everywhere else. `deepTrace.tabNavigation` turns the keybindings off.

## Breakpoints and definitions

{@link BreakpointService} adds one source breakpoint per unique file and line, skipping lines that already have one, and records the IDs it created in workspace state. Clearing removes only those IDs, so manual breakpoints survive.

{@link DefinitionService} runs `vscode.executeDefinitionProvider` at the current step and opens the single result directly or offers a quick pick for several.

## Bundled skill

`skills/deep-trace/SKILL.md` is contributed through `chatSkills`, so chat agents can produce a trace table that this extension loads. The skill resolves its helper script relative to the installed `SKILL.md`.

## Boundaries

The extension has no runtime dependencies and makes no network requests. It needs a file-system workspace for relative paths. CodeLens rendering depends on `editor.codeLens`, and its colors follow the active theme.
