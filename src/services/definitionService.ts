import path from 'node:path'

import * as vscode from 'vscode'

import type { TraceStep } from '../models/traceStep'

import type { NavigationService } from './navigationService'

const DEFINITION_PROVIDER_COMMAND = 'vscode.executeDefinitionProvider'
const ONE_BASED_INDEX_OFFSET = 1
const MINIMUM_ZERO_BASED_INDEX = 0

type DefinitionTarget = {
  uri: vscode.Uri
  range: vscode.Range
  label: string
  description: string
}

/**
 * Resolves and opens definitions for the currently selected trace step.
 */
export class DefinitionService {
  /**
   * Creates a new definition helper around the shared navigation service.
   */
  public constructor(private readonly navigationService: NavigationService) {}

  /**
   * Finds a definition for the provided trace step and opens it.
   */
  public async goToDefinitionForStep(step: TraceStep): Promise<boolean> {
    const targetUri = this.navigationService.resolveTraceUri(step.file)
    const targetPosition = new vscode.Position(
      Math.max(step.line - ONE_BASED_INDEX_OFFSET, MINIMUM_ZERO_BASED_INDEX),
      Math.max(step.column - ONE_BASED_INDEX_OFFSET, MINIMUM_ZERO_BASED_INDEX),
    )
    const definitionResults =
      (await vscode.commands.executeCommand<
        readonly (vscode.Location | vscode.LocationLink)[] | undefined
      >(DEFINITION_PROVIDER_COMMAND, targetUri, targetPosition)) ?? []
    const definitionTargets = definitionResults.map((result) =>
      this.normalizeDefinitionTarget(result),
    )

    if (definitionTargets.length === 0) {
      void vscode.window.showInformationMessage(
        'No definition was found for the current trace step.',
      )
      return false
    }

    if (definitionTargets.length === 1) {
      const onlyTarget = definitionTargets[0]

      if (!onlyTarget) {
        return false
      }

      await this.navigationService.revealUriRange(
        onlyTarget.uri,
        onlyTarget.range,
      )
      return true
    }

    const selectedTarget = await this.pickDefinitionTarget(definitionTargets)

    if (!selectedTarget) {
      return false
    }

    await this.navigationService.revealUriRange(
      selectedTarget.uri,
      selectedTarget.range,
    )
    return true
  }

  /**
   * Converts a VS Code definition result into a single navigation target.
   */
  private normalizeDefinitionTarget(
    definitionResult: vscode.Location | vscode.LocationLink,
  ): DefinitionTarget {
    if ('targetUri' in definitionResult) {
      return this.buildDefinitionTarget(
        definitionResult.targetUri,
        definitionResult.targetSelectionRange ?? definitionResult.targetRange,
      )
    }

    return this.buildDefinitionTarget(
      definitionResult.uri,
      definitionResult.range,
    )
  }

  /**
   * Builds a quick-pick friendly definition target structure.
   */
  private buildDefinitionTarget(
    targetUri: vscode.Uri,
    targetRange: vscode.Range,
  ): DefinitionTarget {
    const targetLine = targetRange.start.line + ONE_BASED_INDEX_OFFSET

    return {
      uri: targetUri,
      range: targetRange,
      label: `${path.basename(targetUri.fsPath)}:${targetLine}`,
      description: vscode.workspace.asRelativePath(targetUri),
    }
  }

  /**
   * Lets the user choose one definition target when multiple matches exist.
   */
  private async pickDefinitionTarget(
    definitionTargets: DefinitionTarget[],
  ): Promise<DefinitionTarget | undefined> {
    const selectedItem = await vscode.window.showQuickPick(
      definitionTargets.map((definitionTarget) => ({
        label: definitionTarget.label,
        description: definitionTarget.description,
        target: definitionTarget,
      })),
      {
        placeHolder: 'Select the definition to open.',
      },
    )

    return selectedItem?.target
  }
}
