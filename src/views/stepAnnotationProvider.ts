import * as vscode from 'vscode'

import type { TraceStep } from '../models/traceStep'
import type { NavigationService } from '../services/navigationService'
import type { TraceSessionStore } from '../state/traceSessionStore'

import { buildStepAnnotationLenses } from './stepAnnotation'

const CAN_GO_NEXT_CONTEXT = 'deepTrace.canGoNextFromCursor'
const CAN_GO_PREVIOUS_CONTEXT = 'deepTrace.canGoPreviousFromCursor'
const CONFIGURATION_SECTION = 'deepTrace'
const TAB_NAVIGATION_SETTING = 'tabNavigation'
const ONE_BASED_INDEX_OFFSET = 1

/**
 * Shows the current trace step's description as a CodeLens right above its line,
 * and keeps the Tab/Shift+Tab keybinding context keys in sync with the cursor.
 *
 * Why: the tree view alone forces users to look away from the code to read each step.
 * Triggers: session changes (load/next/prev/select), cursor moves, and active editor switches.
 * Created by `DeepTraceExtensionController` in `extension.ts`.
 */
export class StepAnnotationProvider
  implements vscode.CodeLensProvider, vscode.Disposable
{
  private readonly codeLensEmitter = new vscode.EventEmitter<void>()
  private readonly disposables: vscode.Disposable[] = []
  private readonly disposeStoreSubscription: () => void

  public readonly onDidChangeCodeLenses = this.codeLensEmitter.event

  /**
   * Subscribes to every event that can move the annotation or change Tab behavior.
   */
  public constructor(
    private readonly sessionStore: TraceSessionStore,
    private readonly navigationService: NavigationService,
  ) {
    this.disposeStoreSubscription = this.sessionStore.onDidChange(() => {
      this.codeLensEmitter.fire()
      void this.updateCursorContext(vscode.window.activeTextEditor)
    })
    this.disposables.push(
      this.codeLensEmitter,
      vscode.languages.registerCodeLensProvider({ scheme: 'file' }, this),
      vscode.window.onDidChangeTextEditorSelection(async (event) =>
        this.updateCursorContext(event.textEditor),
      ),
      vscode.window.onDidChangeActiveTextEditor(async (editor) =>
        this.updateCursorContext(editor),
      ),
      vscode.workspace.onDidChangeConfiguration((event) => {
        // Tooltip wording depends on whether Tab navigation is enabled
        if (event.affectsConfiguration(CONFIGURATION_SECTION)) {
          this.codeLensEmitter.fire()
        }
      }),
    )
  }

  /**
   * Returns the description + prev/next lenses when the document contains the current step.
   */
  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const currentStep = this.sessionStore.getCurrentStep()

    if (!currentStep || !this.isStepDocument(currentStep, document)) {
      return []
    }

    const lineRange = document.lineAt(
      this.getStepLineIndex(currentStep, document),
    ).range
    const annotationLenses = buildStepAnnotationLenses(
      currentStep,
      this.sessionStore.getSteps().length,
      this.isTabNavigationEnabled(),
    )

    return annotationLenses.map(
      (lens) =>
        new vscode.CodeLens(lineRange, {
          title: lens.title,
          tooltip: lens.tooltip,
          command: lens.commandId,
        }),
    )
  }

  /**
   * Releases the CodeLens registration, editor listeners, and store subscription.
   */
  public dispose(): void {
    this.disposeStoreSubscription()

    for (const disposable of this.disposables) {
      disposable.dispose()
    }
  }

  /**
   * Enables Tab/Shift+Tab only while the cursor sits on the current step line,
   * so Tab keeps indenting everywhere else.
   */
  private async updateCursorContext(
    editor: vscode.TextEditor | undefined,
  ): Promise<void> {
    const currentStep = this.sessionStore.getCurrentStep()
    const isCursorOnStep =
      editor !== undefined &&
      currentStep !== undefined &&
      this.isStepDocument(currentStep, editor.document) &&
      editor.selection.active.line ===
        this.getStepLineIndex(currentStep, editor.document)
    const lastStepIndex =
      this.sessionStore.getSteps().length - ONE_BASED_INDEX_OFFSET

    await Promise.all([
      vscode.commands.executeCommand(
        'setContext',
        CAN_GO_NEXT_CONTEXT,
        isCursorOnStep && currentStep.index < lastStepIndex,
      ),
      vscode.commands.executeCommand(
        'setContext',
        CAN_GO_PREVIOUS_CONTEXT,
        isCursorOnStep && currentStep.index > 0,
      ),
    ])
  }

  /**
   * Checks whether the step points at this document; unresolvable paths never match.
   */
  private isStepDocument(
    step: TraceStep,
    document: vscode.TextDocument,
  ): boolean {
    try {
      return (
        this.navigationService.resolveTraceUri(step.file).toString() ===
        document.uri.toString()
      )
    } catch {
      // Relative path without an open workspace folder
      return false
    }
  }

  /**
   * Converts the one-based trace line into a zero-based line clamped to the document.
   */
  private getStepLineIndex(
    step: TraceStep,
    document: vscode.TextDocument,
  ): number {
    const zeroBasedLine = Math.max(step.line - ONE_BASED_INDEX_OFFSET, 0)
    return Math.min(zeroBasedLine, document.lineCount - ONE_BASED_INDEX_OFFSET)
  }

  /**
   * Reads the `deepTrace.tabNavigation` setting.
   */
  private isTabNavigationEnabled(): boolean {
    return vscode.workspace
      .getConfiguration(CONFIGURATION_SECTION)
      .get<boolean>(TAB_NAVIGATION_SETTING, true)
  }
}
