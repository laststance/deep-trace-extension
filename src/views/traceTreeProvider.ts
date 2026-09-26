import * as vscode from 'vscode'

import type { TraceStep } from '../models/traceStep'
import type { TraceSessionStore } from '../state/traceSessionStore'

const TRACE_STEP_CONTEXT = 'traceStep'
const FIRST_VISIBLE_LEVEL = 1

/**
 * Represents one visible node in the deep trace tree.
 */
export class TraceTreeItem extends vscode.TreeItem {
  /**
   * Creates a tree item for a trace step and its current-selection state.
   */
  public constructor(
    public readonly step: TraceStep,
    isCurrentStep: boolean,
  ) {
    super(
      `${step.index + FIRST_VISIBLE_LEVEL}. ${step.title}`,
      vscode.TreeItemCollapsibleState.None,
    )
    this.description = `${step.file}:${step.line}`
    this.tooltip = new vscode.MarkdownString(
      [
        `**${step.title}**`,
        `${step.file}:${step.line}:${step.column}`,
        step.reason,
      ]
        .filter((segment) => segment.length > 0)
        .join('\n\n'),
    )
    this.command = {
      command: 'deepTrace.selectStep',
      title: 'Reveal Trace Step',
      arguments: [step.index],
    }
    this.contextValue = TRACE_STEP_CONTEXT
    this.iconPath = new vscode.ThemeIcon(
      isCurrentStep ? 'debug-step-over' : 'circle-outline',
    )
  }
}

/**
 * Feeds the trace session into a native VS Code tree view.
 */
export class TraceTreeProvider
  implements vscode.TreeDataProvider<TraceTreeItem>, vscode.Disposable
{
  private readonly treeDataEmitter = new vscode.EventEmitter<
    TraceTreeItem | undefined | void
  >()
  private readonly disposeStoreSubscription: () => void
  private items: TraceTreeItem[] = []

  public readonly onDidChangeTreeData = this.treeDataEmitter.event

  /**
   * Creates a tree provider that always mirrors the session store.
   */
  public constructor(private readonly sessionStore: TraceSessionStore) {
    this.rebuildItems()
    this.disposeStoreSubscription = this.sessionStore.onDidChange(() => {
      this.rebuildItems()
      this.treeDataEmitter.fire()
    })
  }

  /**
   * Returns the tree item representation for one element.
   */
  public getTreeItem(element: TraceTreeItem): vscode.TreeItem {
    return element
  }

  /**
   * Returns either the root trace items or no children for a leaf item.
   */
  public getChildren(element?: TraceTreeItem): TraceTreeItem[] {
    if (element) {
      return []
    }

    return this.items
  }

  /**
   * Returns the parent for tree reveal support.
   */
  public getParent(_element: TraceTreeItem): TraceTreeItem | undefined {
    return undefined
  }

  /**
   * Looks up the rendered tree item for a step index.
   */
  public getItemForStepIndex(stepIndex: number): TraceTreeItem | undefined {
    return this.items.find((item) => item.step.index === stepIndex)
  }

  /**
   * Releases tree events and store subscriptions.
   */
  public dispose(): void {
    this.disposeStoreSubscription()
    this.treeDataEmitter.dispose()
  }

  /**
   * Rebuilds the visible tree items from the latest session state.
   */
  private rebuildItems(): void {
    const currentStepIndex = this.sessionStore.getCurrentStepIndex()

    this.items = this.sessionStore
      .getSteps()
      .map((step) => new TraceTreeItem(step, step.index === currentStepIndex))
  }
}
