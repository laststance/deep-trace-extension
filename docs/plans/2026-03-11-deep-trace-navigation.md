# Deep Trace Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a VS Code/Cursor extension that loads a `deep-trace` Markdown table, shows the steps in a native sidebar, and navigates the editor with next/previous/definition actions.

**Architecture:** Use a small TypeScript VS Code extension with separate modules for parsing, session state, editor navigation, definition lookup, and tree rendering. Keep the first version Markdown-only for input, with a session store that persists the loaded trace and current step in workspace state.

**Tech Stack:** TypeScript, VS Code Extension API, pnpm, Node.js test runner or Vitest-level parser tests, `tsc` build output.

---

## Notes

- This workspace is not a git repository yet, so the worktree guidance from the planning skills does not apply here.
- Commit steps are intentionally omitted until the user explicitly asks for a commit.

### Task 1: Bootstrap the Extension Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.vscode/launch.json`
- Create: `.vscode/tasks.json`
- Create: `src/extension.ts`

**Step 1: Define the extension package metadata**

Write a `package.json` that contributes:
- one activity bar container
- one tree view
- commands for load, next, previous, reveal, and definition
- scripts for `build`, `watch`, `typecheck`, and `test`

**Step 2: Add TypeScript compiler configuration**

Write `tsconfig.json` targeting an extension-friendly CommonJS output in `out/`.

**Step 3: Add debugging helpers**

Create `.vscode/launch.json` and `.vscode/tasks.json` so the extension can run in an Extension Development Host.

**Step 4: Create a minimal activation shell**

Add `src/extension.ts` with activation and deactivation placeholders that will later be filled by the real services.

**Step 5: Run the build once**

Run: `pnpm build`
Expected: TypeScript compiles or fails only because later modules are still missing.

### Task 2: Implement and Test the Markdown Trace Parser

**Files:**
- Create: `src/models/traceStep.ts`
- Create: `src/parser/traceParser.ts`
- Create: `src/test/traceParser.test.ts`
- Modify: `src/extension.ts`

**Step 1: Write the parser tests first**

Cover:
- a normal Markdown table
- a table without a `column` field
- fenced Markdown input
- missing `file` or `line` columns

**Step 2: Run the parser tests to confirm failure**

Run: `pnpm test`
Expected: parser test failures because implementation is still missing.

**Step 3: Implement `TraceStep` and `TraceParser`**

Add normalized column handling, numeric validation, and stable IDs.

**Step 4: Run tests again**

Run: `pnpm test`
Expected: parser tests pass.

### Task 3: Add Session State and Editor Navigation

**Files:**
- Create: `src/state/traceSessionStore.ts`
- Create: `src/services/navigationService.ts`
- Create: `src/services/definitionService.ts`
- Modify: `src/extension.ts`

**Step 1: Implement session state**

Add load, clear, next, previous, set-current, restore, and persist behavior with events.

**Step 2: Implement editor navigation**

Use `showTextDocument` with an explicit selection and `revealRange` with `InCenterIfOutsideViewport`.

**Step 3: Implement definition lookup**

Use `vscode.executeDefinitionProvider` at the current trace position and resolve zero, one, or many locations.

**Step 4: Wire commands into activation**

Register:
- `deepTrace.loadFromClipboard`
- `deepTrace.nextStep`
- `deepTrace.previousStep`
- `deepTrace.revealCurrentStep`
- `deepTrace.goToDefinition`

**Step 5: Run the build**

Run: `pnpm build`
Expected: extension compiles with the new services.

### Task 4: Add the Tree View and Native Navigation UI

**Files:**
- Create: `src/views/traceTreeProvider.ts`
- Modify: `package.json`
- Modify: `src/extension.ts`

**Step 1: Create the tree provider**

Add a `TreeDataProvider` that renders ordered steps and exposes parents so `TreeView.reveal` works.

**Step 2: Contribute the view and title actions**

Add a dedicated view container, view definition, title actions, and welcome content.

**Step 3: Synchronize tree and editor state**

Ensure clicking a tree item reveals the step, and `next` or `previous` updates the selected tree item.

**Step 4: Run manual smoke verification**

Launch the extension host, load a sample Markdown trace, and confirm:
- the tree populates
- next and previous move the editor
- the current step stays visible in the view
- definition lookup works on a resolvable symbol

### Task 5: Final Verification and Cleanup

**Files:**
- Modify: any touched file as needed
- Check: `docs/superpowers/specs/2026-03-11-deep-trace-navigation-design.md`
- Check: `docs/plans/2026-03-11-deep-trace-navigation.md`

**Step 1: Run verification commands**

Run:
- `pnpm build`
- `pnpm test`

Expected: both commands pass.

**Step 2: Check editor diagnostics**

Review diagnostics for recently edited files and fix any newly introduced errors.

**Step 3: Remove throwaway code**

Delete any temporary logging or sample-only code that is not part of the shipped feature.

**Step 4: Summarize the result**

Report the implemented commands, the navigation behavior, and the verification results to the user.
