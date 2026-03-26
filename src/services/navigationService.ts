import path from "node:path";

import * as vscode from "vscode";

import type { TraceStep } from "../models/traceStep";

const ONE_BASED_INDEX_OFFSET = 1;
const MINIMUM_ZERO_BASED_INDEX = 0;

/**
 * Handles all editor navigation and highlighting for the active trace step.
 */
export class NavigationService implements vscode.Disposable {
  private readonly activeLineDecoration = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("editor.rangeHighlightBackground")
  });

  /**
   * Reveals the file and position for a trace step in the active editor.
   */
  public async revealStep(step: TraceStep): Promise<vscode.TextEditor> {
    const targetUri = this.resolveTraceUri(step.file);
    const document = await vscode.workspace.openTextDocument(targetUri);
    const targetRange = this.createSelectionRange(document, step.line, step.column);

    return this.revealUriRange(targetUri, targetRange);
  }

  /**
   * Reveals an already resolved URI and range in the editor.
   */
  public async revealUriRange(
    targetUri: vscode.Uri,
    targetRange: vscode.Range
  ): Promise<vscode.TextEditor> {
    const document = await vscode.workspace.openTextDocument(targetUri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      selection: targetRange
    });

    editor.selection = new vscode.Selection(targetRange.start, targetRange.end);
    editor.revealRange(
      targetRange,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
    this.highlightActiveLine(editor, targetRange);

    return editor;
  }

  /**
   * Converts a trace file path into a URI that VS Code can open.
   */
  public resolveTraceUri(filePath: string): vscode.Uri {
    if (path.isAbsolute(filePath)) {
      return vscode.Uri.file(filePath);
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    if (!workspaceFolder) {
      throw new Error(
        "Open a workspace folder before using relative deep trace paths."
      );
    }

    return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
  }

  /**
   * Disposes the active editor decorations when the extension shuts down.
   */
  public dispose(): void {
    this.activeLineDecoration.dispose();
  }

  /**
   * Converts one-based trace coordinates into a valid editor selection range.
   */
  private createSelectionRange(
    document: vscode.TextDocument,
    line: number,
    column: number
  ): vscode.Range {
    const targetLineIndex = Math.max(line - ONE_BASED_INDEX_OFFSET, MINIMUM_ZERO_BASED_INDEX);
    const clampedLineIndex = Math.min(targetLineIndex, document.lineCount - 1);
    const targetLine = document.lineAt(clampedLineIndex);
    const targetCharacterIndex = Math.max(
      column - ONE_BASED_INDEX_OFFSET,
      MINIMUM_ZERO_BASED_INDEX
    );
    const clampedCharacterIndex = Math.min(
      targetCharacterIndex,
      targetLine.text.length
    );
    const targetPosition = new vscode.Position(
      clampedLineIndex,
      clampedCharacterIndex
    );

    return new vscode.Range(targetPosition, targetPosition);
  }

  /**
   * Applies a whole-line highlight so the current step is easy to spot.
   */
  private highlightActiveLine(editor: vscode.TextEditor, targetRange: vscode.Range): void {
    const lineRange = editor.document.lineAt(targetRange.start.line).range;
    editor.setDecorations(this.activeLineDecoration, [lineRange]);
  }
}
