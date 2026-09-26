import { beforeEach, describe, expect, test, vi } from 'vitest'
import type * as vscode from 'vscode'

import { activate } from '../extension'
import { SESSION_STORAGE_KEY } from '../state/traceSessionStore'

import { Position, fakeHost } from './support/fakeVscode'

vi.mock('vscode', async () => import('./support/fakeVscode.js'))

const NO_TRACE_MESSAGE =
  'Load a deep trace before using trace navigation commands.'

const TWO_LINE_TRACE = [
  '| file | line | column | reason |',
  '|------|------|--------|--------|',
  '| src/app.ts | 2 | 3 | The app boots |',
  '| src/app.ts | 4 | 1 | The router starts |',
].join('\n')

const ONE_LINE_TRACE = [
  '| file | line | column | reason |',
  '|------|------|--------|--------|',
  '| src/app.ts | 2 | 3 | The app boots |',
].join('\n')

type FakeExtensionContext = {
  subscriptions: { dispose(): void }[]
  workspaceState: {
    get<T>(key: string): T | undefined
    update(key: string, value: unknown): Promise<void>
  }
  savedState: Map<string, unknown>
  failStateWrites: boolean
}

/**
 * Creates an extension context whose workspace state lives in memory.
 */
function createContext(
  initialState: Record<string, unknown> = {},
): FakeExtensionContext {
  const context: FakeExtensionContext = {
    subscriptions: [],
    savedState: new Map(Object.entries(initialState)),
    failStateWrites: false,
    workspaceState: {
      get: <T>(key: string): T | undefined =>
        context.savedState.get(key) as T | undefined,
      update: async (key: string, value: unknown): Promise<void> => {
        if (context.failStateWrites) {
          throw new Error('Workspace state is read-only')
        }
        context.savedState.set(key, value)
      },
    },
  }
  return context
}

/**
 * Activates the extension the way VS Code does when a Deep Trace command runs.
 */
async function activateExtension(
  context: FakeExtensionContext = createContext(),
): Promise<FakeExtensionContext> {
  await activate(context as unknown as vscode.ExtensionContext)
  return context
}

/**
 * Invokes a registered command like the Command Palette would.
 */
async function runCommand(commandId: string, ...args: unknown[]) {
  const handler = fakeHost.commandHandlers.get(commandId)
  if (!handler) {
    throw new Error(`Command ${commandId} is not registered`)
  }
  await handler(...args)
}

describe('Deep Trace extension commands', () => {
  beforeEach(() => {
    fakeHost.reset()
    fakeHost.addDocument('/workspace/src/app.ts', [
      "import { router } from './router'",
      'boot()',
      '',
      'router.start()',
    ])
  })

  test('registers every Deep Trace command on activation', async () => {
    // Arrange / Act
    await activateExtension()

    // Assert
    expect([...fakeHost.commandHandlers.keys()]).toEqual([
      'deepTrace.loadFromClipboard',
      'deepTrace.nextStep',
      'deepTrace.previousStep',
      'deepTrace.revealCurrentStep',
      'deepTrace.goToDefinition',
      'deepTrace.setBreakpoints',
      'deepTrace.clearBreakpoints',
      'deepTrace.selectStep',
    ])
  })

  test('unregisters every command when the extension is deactivated', async () => {
    // Arrange
    const context = await activateExtension()

    // Act
    for (const subscription of context.subscriptions) {
      subscription.dispose()
    }

    // Assert
    expect(fakeHost.commandHandlers.size).toBe(0)
  })

  test('restores the saved trace and selects its current step in the Trace Steps view', async () => {
    // Arrange
    const context = createContext({
      [SESSION_STORAGE_KEY]: {
        steps: [
          {
            id: 'trace-step-1',
            index: 0,
            title: 'The app boots',
            file: 'src/app.ts',
            line: 2,
            column: 3,
            reason: 'The app boots',
            raw: {},
          },
          {
            id: 'trace-step-2',
            index: 1,
            title: 'The router starts',
            file: 'src/app.ts',
            line: 4,
            column: 1,
            reason: 'The router starts',
            raw: {},
          },
        ],
        currentStepIndex: 1,
      },
    })

    // Act
    await activateExtension(context)

    // Assert
    expect(fakeHost.revealedTreeItems.map((item) => item.label)).toEqual([
      '2. The router starts',
    ])
  })

  test('opens the first step at its line and column after loading a trace from the clipboard', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE

    // Act
    await runCommand('deepTrace.loadFromClipboard')

    // Assert
    expect(fakeHost.openedEditors).toHaveLength(1)
    expect(fakeHost.openedEditors[0]?.document.uri.fsPath).toBe(
      '/workspace/src/app.ts',
    )
    expect(fakeHost.openedEditors[0]?.selection.start).toEqual(
      new Position(1, 2),
    )
    expect(fakeHost.revealedTreeItems.map((item) => item.label)).toEqual([
      '1. The app boots',
    ])
  })

  test('warns when the clipboard holds no trace table', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = 'just some notes'

    // Act
    await runCommand('deepTrace.loadFromClipboard')

    // Assert
    expect(fakeHost.warningMessages).toEqual([
      'No Markdown trace table was found in the clipboard.',
    ])
    expect(fakeHost.openedEditors).toEqual([])
  })

  test('reports a clipboard read failure instead of throwing', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardError = 'clipboard is locked'

    // Act
    await runCommand('deepTrace.loadFromClipboard')

    // Assert
    expect(fakeHost.errorMessages).toEqual([
      'Unable to load the deep trace: clipboard is locked',
    ])
  })

  test('reports a step whose file cannot be opened', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = [
      '| file | line |',
      '|------|------|',
      '| src/missing.ts | 1 |',
    ].join('\n')

    // Act
    await runCommand('deepTrace.loadFromClipboard')

    // Assert
    expect(fakeHost.errorMessages).toEqual([
      'Unable to reveal the trace step: File not found: /workspace/src/missing.ts',
    ])
  })

  test('moves forward and back through the trace, opening each step', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')

    // Act
    await runCommand('deepTrace.nextStep')
    await runCommand('deepTrace.previousStep')

    // Assert
    expect(
      fakeHost.openedEditors.map((editor) => editor.selection.start),
    ).toEqual([new Position(1, 2), new Position(3, 0), new Position(1, 2)])
  })

  test('asks the user to load a trace before navigating', async () => {
    // Arrange
    await activateExtension()

    // Act
    await runCommand('deepTrace.nextStep')
    await runCommand('deepTrace.previousStep')
    await runCommand('deepTrace.revealCurrentStep')
    await runCommand('deepTrace.goToDefinition')
    await runCommand('deepTrace.setBreakpoints')

    // Assert
    expect(fakeHost.informationMessages).toEqual([
      NO_TRACE_MESSAGE,
      NO_TRACE_MESSAGE,
      NO_TRACE_MESSAGE,
      NO_TRACE_MESSAGE,
      NO_TRACE_MESSAGE,
    ])
  })

  test('reopens the current step on demand', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')

    // Act
    await runCommand('deepTrace.revealCurrentStep')

    // Assert
    expect(fakeHost.openedEditors).toHaveLength(2)
    expect(fakeHost.openedEditors[1]?.selection.start).toEqual(
      new Position(1, 2),
    )
  })

  test('opens the step clicked in the Trace Steps view', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')

    // Act
    await runCommand('deepTrace.selectStep', 1)

    // Assert
    expect(fakeHost.openedEditors[1]?.selection.start).toEqual(
      new Position(3, 0),
    )
    expect(fakeHost.revealedTreeItems.at(-1)?.label).toBe(
      '2. The router starts',
    )
  })

  test('ignores a tree selection when no trace is loaded', async () => {
    // Arrange
    await activateExtension()

    // Act
    await runCommand('deepTrace.selectStep', 0)

    // Assert
    expect(fakeHost.openedEditors).toEqual([])
    expect(fakeHost.informationMessages).toEqual([])
  })

  test('reports a definition lookup failure for the current step', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')
    fakeHost.definitionError = new Error('TypeScript server crashed')

    // Act
    await runCommand('deepTrace.goToDefinition')

    // Assert
    expect(fakeHost.errorMessages).toEqual([
      'Unable to open the definition: TypeScript server crashed',
    ])
  })

  test('announces the plural count when several trace breakpoints are set', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')

    // Act
    await runCommand('deepTrace.setBreakpoints')

    // Assert
    expect(fakeHost.breakpoints).toHaveLength(2)
    expect(fakeHost.informationMessages).toEqual(['Set 2 trace breakpoints.'])
  })

  test('announces the singular count when one trace breakpoint is set', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = ONE_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')

    // Act
    await runCommand('deepTrace.setBreakpoints')

    // Assert
    expect(fakeHost.informationMessages).toEqual(['Set 1 trace breakpoint.'])
  })

  test('does not duplicate breakpoints that are already set', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')
    await runCommand('deepTrace.setBreakpoints')

    // Act
    await runCommand('deepTrace.setBreakpoints')

    // Assert
    expect(fakeHost.breakpoints).toHaveLength(2)
    expect(fakeHost.informationMessages.at(-1)).toBe(
      'All trace breakpoints are already set.',
    )
  })

  test('reports why breakpoints could not be set for relative paths without a workspace folder', async () => {
    // Arrange
    fakeHost.workspaceFolders = undefined
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')

    // Act
    await runCommand('deepTrace.setBreakpoints')

    // Assert
    expect(fakeHost.errorMessages.at(-1)).toBe(
      'Unable to set trace breakpoints: Open a workspace folder before using relative deep trace paths.',
    )
    expect(fakeHost.breakpoints).toEqual([])
  })

  test('clears the trace breakpoints it set and announces the plural count', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')
    await runCommand('deepTrace.setBreakpoints')

    // Act
    await runCommand('deepTrace.clearBreakpoints')

    // Assert
    expect(fakeHost.breakpoints).toEqual([])
    expect(fakeHost.informationMessages.at(-1)).toBe(
      'Cleared 2 trace breakpoints.',
    )
  })

  test('announces the singular count when one trace breakpoint is cleared', async () => {
    // Arrange
    await activateExtension()
    fakeHost.clipboardText = ONE_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')
    await runCommand('deepTrace.setBreakpoints')

    // Act
    await runCommand('deepTrace.clearBreakpoints')

    // Assert
    expect(fakeHost.informationMessages.at(-1)).toBe(
      'Cleared 1 trace breakpoint.',
    )
  })

  test('tells the user when there are no Deep Trace breakpoints to clear', async () => {
    // Arrange
    await activateExtension()

    // Act
    await runCommand('deepTrace.clearBreakpoints')

    // Assert
    expect(fakeHost.informationMessages).toEqual([
      'No Deep Trace breakpoints were found.',
    ])
  })

  test('reports a failure to forget cleared breakpoints', async () => {
    // Arrange
    const context = await activateExtension()
    fakeHost.clipboardText = TWO_LINE_TRACE
    await runCommand('deepTrace.loadFromClipboard')
    await runCommand('deepTrace.setBreakpoints')
    context.failStateWrites = true

    // Act
    await runCommand('deepTrace.clearBreakpoints')

    // Assert
    expect(fakeHost.errorMessages).toEqual([
      'Unable to clear trace breakpoints: Workspace state is read-only',
    ])
  })
})
