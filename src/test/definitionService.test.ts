import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { TraceStep } from '../models/traceStep'
import { DefinitionService } from '../services/definitionService'
import { NavigationService } from '../services/navigationService'

import { Location, Position, Range, Uri, fakeHost } from './support/fakeVscode'

vi.mock('vscode', async () => import('./support/fakeVscode.js'))

const TRACE_STEP: TraceStep = {
  id: 'trace-step-1',
  index: 0,
  title: 'Keybinds client renders',
  file: 'src/app.ts',
  line: 3,
  column: 7,
  reason: 'The page renders the client component',
  raw: {},
}

describe('DefinitionService', () => {
  beforeEach(() => {
    fakeHost.reset()
    fakeHost.addDocument('/workspace/src/app.ts', ['a', 'b', 'const x = y'])
    fakeHost.addDocument('/workspace/src/keybinds.ts', [
      'line 1',
      'line 2',
      'line 3',
      'export function KeybindsClient() {}',
    ])
    fakeHost.addDocument('/workspace/src/legacy.ts', ['one', 'two'])
  })

  test('asks the definition provider about the trace step position using zero-based coordinates', async () => {
    // Arrange
    const service = new DefinitionService(new NavigationService())

    // Act
    await service.goToDefinitionForStep(TRACE_STEP)

    // Assert
    expect(fakeHost.definitionRequests).toEqual([
      { uri: Uri.file('/workspace/src/app.ts'), position: new Position(2, 6) },
    ])
  })

  test('tells the user when no definition exists for the current step', async () => {
    // Arrange
    fakeHost.definitionResults = []
    const service = new DefinitionService(new NavigationService())

    // Act
    const didOpenDefinition = await service.goToDefinitionForStep(TRACE_STEP)

    // Assert
    expect(didOpenDefinition).toBe(false)
    expect(fakeHost.informationMessages).toEqual([
      'No definition was found for the current trace step.',
    ])
    expect(fakeHost.openedEditors).toEqual([])
  })

  test('opens the only definition directly without asking the user to pick', async () => {
    // Arrange
    const definitionRange = new Range(new Position(3, 16), new Position(3, 30))
    fakeHost.definitionResults = [
      new Location(Uri.file('/workspace/src/keybinds.ts'), definitionRange),
    ]
    const service = new DefinitionService(new NavigationService())

    // Act
    const didOpenDefinition = await service.goToDefinitionForStep(TRACE_STEP)

    // Assert
    expect(didOpenDefinition).toBe(true)
    expect(fakeHost.quickPickItems).toEqual([])
    expect(fakeHost.openedEditors).toHaveLength(1)
    expect(fakeHost.openedEditors[0]?.document.uri.fsPath).toBe(
      '/workspace/src/keybinds.ts',
    )
    expect(fakeHost.openedEditors[0]?.selection.start).toEqual(
      new Position(3, 16),
    )
  })

  test('jumps to the identifier of a LocationLink definition instead of its whole declaration', async () => {
    // Arrange
    fakeHost.definitionResults = [
      {
        targetUri: Uri.file('/workspace/src/keybinds.ts'),
        targetRange: new Range(new Position(3, 0), new Position(3, 35)),
        targetSelectionRange: new Range(
          new Position(3, 16),
          new Position(3, 30),
        ),
      },
    ]
    const service = new DefinitionService(new NavigationService())

    // Act
    await service.goToDefinitionForStep(TRACE_STEP)

    // Assert
    expect(fakeHost.openedEditors[0]?.selection.start).toEqual(
      new Position(3, 16),
    )
  })

  test('falls back to the declaration range when a LocationLink has no identifier range', async () => {
    // Arrange
    fakeHost.definitionResults = [
      {
        targetUri: Uri.file('/workspace/src/keybinds.ts'),
        targetRange: new Range(new Position(3, 0), new Position(3, 35)),
      },
    ]
    const service = new DefinitionService(new NavigationService())

    // Act
    await service.goToDefinitionForStep(TRACE_STEP)

    // Assert
    expect(fakeHost.openedEditors[0]?.selection.start).toEqual(
      new Position(3, 0),
    )
  })

  test('lets the user pick between several definitions labelled by file name and one-based line', async () => {
    // Arrange
    fakeHost.definitionResults = [
      new Location(Uri.file('/workspace/src/keybinds.ts'), new Position(3, 16)),
      new Location(Uri.file('/workspace/src/legacy.ts'), new Position(1, 0)),
    ]
    fakeHost.pickQuickPickItem = (items) => items[1]
    const service = new DefinitionService(new NavigationService())

    // Act
    const didOpenDefinition = await service.goToDefinitionForStep(TRACE_STEP)

    // Assert
    expect(fakeHost.quickPickItems).toEqual([
      { label: 'keybinds.ts:4', description: 'src/keybinds.ts' },
      { label: 'legacy.ts:2', description: 'src/legacy.ts' },
    ])
    expect(didOpenDefinition).toBe(true)
    expect(fakeHost.openedEditors[0]?.document.uri.fsPath).toBe(
      '/workspace/src/legacy.ts',
    )
  })

  test('opens nothing when the user dismisses the definition picker', async () => {
    // Arrange
    fakeHost.definitionResults = [
      new Location(Uri.file('/workspace/src/keybinds.ts'), new Position(3, 16)),
      new Location(Uri.file('/workspace/src/legacy.ts'), new Position(1, 0)),
    ]
    fakeHost.pickQuickPickItem = () => undefined
    const service = new DefinitionService(new NavigationService())

    // Act
    const didOpenDefinition = await service.goToDefinitionForStep(TRACE_STEP)

    // Assert
    expect(didOpenDefinition).toBe(false)
    expect(fakeHost.openedEditors).toEqual([])
  })
})
