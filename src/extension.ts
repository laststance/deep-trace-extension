import * as vscode from "vscode";

import type { TraceStep } from "./models/traceStep";
import { parseTraceMarkdown } from "./parser/traceParser";
import { DefinitionService } from "./services/definitionService";
import { NavigationService } from "./services/navigationService";
import { TraceSessionStore } from "./state/traceSessionStore";
import { TraceTreeItem, TraceTreeProvider } from "./views/traceTreeProvider";

const LOAD_TRACE_COMMAND = "deepTrace.loadFromClipboard";
const NEXT_STEP_COMMAND = "deepTrace.nextStep";
const PREVIOUS_STEP_COMMAND = "deepTrace.previousStep";
const REVEAL_CURRENT_STEP_COMMAND = "deepTrace.revealCurrentStep";
const GO_TO_DEFINITION_COMMAND = "deepTrace.goToDefinition";
const SELECT_STEP_COMMAND = "deepTrace.selectStep";
const TRACE_VIEW_ID = "deepTrace.traceView";
const NO_TRACE_MESSAGE = "Load a deep trace before using trace navigation commands.";

/**
 * Coordinates the parser, session store, editor navigation, and tree view.
 */
class DeepTraceExtensionController implements vscode.Disposable {
  private readonly sessionStore: TraceSessionStore;
  private readonly navigationService = new NavigationService();
  private readonly definitionService = new DefinitionService(this.navigationService);
  private readonly treeProvider: TraceTreeProvider;
  private readonly treeView: vscode.TreeView<TraceTreeItem>;
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * Creates a new extension controller for one VS Code window.
   */
  public constructor(private readonly context: vscode.ExtensionContext) {
    this.sessionStore = new TraceSessionStore({
      get: <T>(key: string): T | undefined => this.context.workspaceState.get<T>(key),
      update: (key: string, value: unknown): Promise<void> =>
        Promise.resolve(this.context.workspaceState.update(key, value))
    });
    this.treeProvider = new TraceTreeProvider(this.sessionStore);
    this.treeView = vscode.window.createTreeView(TRACE_VIEW_ID, {
      treeDataProvider: this.treeProvider,
      showCollapseAll: false
    });

    this.disposables.push(this.navigationService, this.treeProvider, this.treeView);
    this.registerCommands();
  }

  /**
   * Restores any saved session after the extension activates.
   */
  public async initialize(): Promise<void> {
    const restoredSession = await this.sessionStore.restore();

    if (restoredSession) {
      await this.revealCurrentTreeItem();
    }
  }

  /**
   * Disposes all resources owned by the extension controller.
   */
  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  /**
   * Registers all commands used by the extension UI.
   */
  private registerCommands(): void {
    this.registerCommand(LOAD_TRACE_COMMAND, () => this.loadTraceFromClipboard());
    this.registerCommand(NEXT_STEP_COMMAND, () => this.moveToNextStep());
    this.registerCommand(PREVIOUS_STEP_COMMAND, () => this.moveToPreviousStep());
    this.registerCommand(REVEAL_CURRENT_STEP_COMMAND, () => this.revealCurrentStep());
    this.registerCommand(GO_TO_DEFINITION_COMMAND, () =>
      this.goToDefinitionFromCurrentStep()
    );
    this.registerCommand(SELECT_STEP_COMMAND, (stepIndex: unknown) =>
      this.selectStep(Number(stepIndex))
    );
  }

  /**
   * Adds one disposable command registration to the controller.
   */
  private registerCommand(
    commandId: string,
    commandHandler: (...argumentsList: unknown[]) => unknown
  ): void {
    this.disposables.push(vscode.commands.registerCommand(commandId, commandHandler));
  }

  /**
   * Loads a Markdown trace from the clipboard and starts navigation from step one.
   */
  private async loadTraceFromClipboard(): Promise<void> {
    try {
      const clipboardText = await vscode.env.clipboard.readText();
      const parsedSteps = parseTraceMarkdown(clipboardText);

      if (parsedSteps.length === 0) {
        void vscode.window.showWarningMessage(
          "No Markdown trace table was found in the clipboard."
        );
        return;
      }

      await this.sessionStore.load(parsedSteps);
      await this.revealCurrentStep();
    } catch (error: unknown) {
      void vscode.window.showErrorMessage(
        `Unable to load the deep trace: ${this.getErrorMessage(error)}`
      );
    }
  }

  /**
   * Moves the session to the next step and reveals it in the editor.
   */
  private async moveToNextStep(): Promise<void> {
    const nextStep = await this.sessionStore.goToNext();

    if (!nextStep) {
      void vscode.window.showInformationMessage(NO_TRACE_MESSAGE);
      return;
    }

    await this.revealStep(nextStep);
  }

  /**
   * Moves the session to the previous step and reveals it in the editor.
   */
  private async moveToPreviousStep(): Promise<void> {
    const previousStep = await this.sessionStore.goToPrevious();

    if (!previousStep) {
      void vscode.window.showInformationMessage(NO_TRACE_MESSAGE);
      return;
    }

    await this.revealStep(previousStep);
  }

  /**
   * Re-opens the current step in the editor.
   */
  private async revealCurrentStep(): Promise<void> {
    const currentStep = this.sessionStore.getCurrentStep();

    if (!currentStep) {
      void vscode.window.showInformationMessage(NO_TRACE_MESSAGE);
      return;
    }

    await this.revealStep(currentStep);
  }

  /**
   * Moves the session to a specific step selected from the tree.
   */
  private async selectStep(stepIndex: number): Promise<void> {
    const selectedStep = await this.sessionStore.setCurrentStepIndex(stepIndex);

    if (!selectedStep) {
      return;
    }

    await this.revealStep(selectedStep);
  }

  /**
   * Opens the definition for the current trace step when available.
   */
  private async goToDefinitionFromCurrentStep(): Promise<void> {
    const currentStep = this.sessionStore.getCurrentStep();

    if (!currentStep) {
      void vscode.window.showInformationMessage(NO_TRACE_MESSAGE);
      return;
    }

    try {
      await this.definitionService.goToDefinitionForStep(currentStep);
    } catch (error: unknown) {
      void vscode.window.showErrorMessage(
        `Unable to open the definition: ${this.getErrorMessage(error)}`
      );
    }
  }

  /**
   * Reveals one step in the editor and keeps the tree selection synchronized.
   */
  private async revealStep(step: TraceStep): Promise<void> {
    try {
      await this.navigationService.revealStep(step);
      await this.revealCurrentTreeItem();
    } catch (error: unknown) {
      void vscode.window.showErrorMessage(
        `Unable to reveal the trace step: ${this.getErrorMessage(error)}`
      );
    }
  }

  /**
   * Makes the current tree item visible and selected in the trace view.
   */
  private async revealCurrentTreeItem(): Promise<void> {
    const currentStepIndex = this.sessionStore.getCurrentStepIndex();

    if (currentStepIndex < 0) {
      return;
    }

    const currentTreeItem = this.treeProvider.getItemForStepIndex(currentStepIndex);

    if (!currentTreeItem) {
      return;
    }

    await this.treeView.reveal(currentTreeItem, {
      expand: false,
      focus: false,
      select: true
    });
  }

  /**
   * Normalizes any thrown value into a readable message for the user.
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

/**
 * Activates the deep trace extension for the current window.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const controller = new DeepTraceExtensionController(context);
  context.subscriptions.push(controller);
  await controller.initialize();
}

/**
 * Runs when VS Code deactivates the extension.
 */
export function deactivate(): void {}
