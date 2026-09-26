import { beforeEach, describe, expect, test, vi } from 'vitest'
import type * as vscode from 'vscode'

import type { TraceStep } from '../models/traceStep'
import { NavigationService } from '../services/navigationService'
import {
  TraceSessionStore,
  type SessionStorage,
} from '../state/traceSessionStore'
import { StepAnnotationProvider } from '../views/stepAnnotationProvider'

import { Position, Range, fakeHost } from './support/fakeVscode'
import type { FakeTextDocument } from './support/fakeVscode'

vi.mock('vscode', async () => import('./support/fakeVscode.js'))

const NEXT_CONTEXT = 'deepTrace.canGoNextFromCursor'
const PREVIOUS_CONTEXT = 'deepTrace.canGoPreviousFromCursor'

const TRACE_STEPS: TraceStep[] = [
  {
    id: 'trace-step-1',
    index: 0,
    title: 'Page metadata is exported',
    file: 'app/page.tsx',
    line: 2,
    column: 1,
    reason: 'Next.js reads metadata first',
    raw: {},
  },
  {
    id: 'trace-step-2',
    index: 1,
    title: 'Client component renders',
    file: 'app/page.tsx',
    line: 4,
    column: 1,
    reason: 'The page renders the client',
    raw: {},
  },
  {
    id: 'trace-step-3',
    index: 2,
    title: 'Keybinds are registered',
    file: 'app/keybinds.tsx',
    line: 1,
    column: 1,
    reason: 'The client registers keybinds',
    raw: {},
  },
]

/**
 * Creates a session store that keeps its snapshot in memory.
 */
function createSessionStore(): TraceSessionStore {
  const values = new Map<string, unknown>()
  const storage: SessionStorage = {
    get: <T>(key: string): T | undefined => values.get(key) as T | undefined,
    update: async (key: string, value: unknown): Promise<void> => {
      values.set(key, value)
    },
  }
  return new TraceSessionStore(storage)
}

/**
 * Lets the fire-and-forget context updates triggered by events settle.
 */
async function flushContextUpdates(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve))
}

/**
 * Asks the provider for lenses the way VS Code does for an open document.
 */
function provideLenses(
  provider: StepAnnotationProvider,
  document: FakeTextDocument,
): vscode.CodeLens[] {
  return provider.provideCodeLenses(document as unknown as vscode.TextDocument)
}

describe('StepAnnotationProvider', () => {
  let pageDocument: FakeTextDocument
  let keybindsDocument: FakeTextDocument

  beforeEach(() => {
    fakeHost.reset()
    pageDocument = fakeHost.addDocument('/workspace/app/page.tsx', [
      "import Client from './client'",
      'export const metadata = {}',
      'export default function Page() {',
      '  return <Client />',
      '}',
    ])
    keybindsDocument = fakeHost.addDocument('/workspace/app/keybinds.tsx', [
      'registerKeybinds()',
    ])
  })

  test('shows no annotation before any trace is loaded', () => {
    // Arrange
    const provider = new StepAnnotationProvider(
      createSessionStore(),
      new NavigationService(),
    )

    // Act
    const lenses = provideLenses(provider, pageDocument)

    // Assert
    expect(lenses).toEqual([])
  })

  test('annotates the current step line with its description and a next action', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    const provider = new StepAnnotationProvider(
      sessionStore,
      new NavigationService(),
    )
    await sessionStore.load(TRACE_STEPS)

    // Act
    const lenses = provideLenses(provider, pageDocument)

    // Assert
    expect(lenses.map((lens) => lens.range)).toEqual([
      new Range(new Position(1, 0), new Position(1, 26)),
      new Range(new Position(1, 0), new Position(1, 26)),
    ])
    expect(lenses.map((lens) => lens.command)).toEqual([
      {
        title: '1/3  Page metadata is exported',
        tooltip: 'Next.js reads metadata first',
        command: '',
      },
      {
        title: '$(arrow-right) next',
        tooltip: 'Tab/Shift+Tab to navigate between steps',
        command: 'deepTrace.nextStep',
      },
    ])
  })

  test('keeps other files free of annotations', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    const provider = new StepAnnotationProvider(
      sessionStore,
      new NavigationService(),
    )
    await sessionStore.load(TRACE_STEPS)

    // Act
    const lenses = provideLenses(provider, keybindsDocument)

    // Assert
    expect(lenses).toEqual([])
  })

  test('pins the annotation to the last line when the trace points past the end of the file', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    const provider = new StepAnnotationProvider(
      sessionStore,
      new NavigationService(),
    )
    await sessionStore.load([{ ...TRACE_STEPS[0]!, line: 99 }])

    // Act
    const lenses = provideLenses(provider, pageDocument)

    // Assert
    expect(lenses[0]?.range).toEqual(
      new Range(new Position(4, 0), new Position(4, 1)),
    )
  })

  test('drops the Tab hint from action tooltips when Tab navigation is turned off', async () => {
    // Arrange
    fakeHost.configuration.set('deepTrace.tabNavigation', false)
    const sessionStore = createSessionStore()
    const provider = new StepAnnotationProvider(
      sessionStore,
      new NavigationService(),
    )
    await sessionStore.load(TRACE_STEPS)

    // Act
    const lenses = provideLenses(provider, pageDocument)

    // Assert
    expect(lenses[1]?.command?.tooltip).toBe('')
  })

  test('shows no annotation for a relative trace path when no workspace folder is open', async () => {
    // Arrange
    fakeHost.workspaceFolders = undefined
    const sessionStore = createSessionStore()
    const provider = new StepAnnotationProvider(
      sessionStore,
      new NavigationService(),
    )
    await sessionStore.load(TRACE_STEPS)

    // Act
    const lenses = provideLenses(provider, pageDocument)

    // Assert
    expect(lenses).toEqual([])
  })

  test('enables only Tab on the first step when the cursor is on its line', async () => {
    // Arrange
    fakeHost.activeTextEditor = fakeHost.createEditor(pageDocument, 1)
    const sessionStore = createSessionStore()
    new StepAnnotationProvider(sessionStore, new NavigationService())

    // Act
    await sessionStore.load(TRACE_STEPS)
    await flushContextUpdates()

    // Assert
    expect(fakeHost.contextKeys.get(NEXT_CONTEXT)).toBe(true)
    expect(fakeHost.contextKeys.get(PREVIOUS_CONTEXT)).toBe(false)
  })

  test('enables both Tab and Shift+Tab on a middle step when the cursor is on its line', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    new StepAnnotationProvider(sessionStore, new NavigationService())
    await sessionStore.load(TRACE_STEPS)
    await sessionStore.goToNext()

    // Act
    fakeHost.fireSelectionChange(fakeHost.createEditor(pageDocument, 3))
    await flushContextUpdates()

    // Assert
    expect(fakeHost.contextKeys.get(NEXT_CONTEXT)).toBe(true)
    expect(fakeHost.contextKeys.get(PREVIOUS_CONTEXT)).toBe(true)
  })

  test('enables only Shift+Tab on the last step when the cursor is on its line', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    new StepAnnotationProvider(sessionStore, new NavigationService())
    await sessionStore.load(TRACE_STEPS)
    await sessionStore.setCurrentStepIndex(2)

    // Act
    fakeHost.fireActiveEditorChange(fakeHost.createEditor(keybindsDocument, 0))
    await flushContextUpdates()

    // Assert
    expect(fakeHost.contextKeys.get(NEXT_CONTEXT)).toBe(false)
    expect(fakeHost.contextKeys.get(PREVIOUS_CONTEXT)).toBe(true)
  })

  test('gives Tab back to indentation when the cursor leaves the step line', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    new StepAnnotationProvider(sessionStore, new NavigationService())
    await sessionStore.load(TRACE_STEPS)
    await sessionStore.goToNext()

    // Act
    fakeHost.fireSelectionChange(fakeHost.createEditor(pageDocument, 0))
    await flushContextUpdates()

    // Assert
    expect(fakeHost.contextKeys.get(NEXT_CONTEXT)).toBe(false)
    expect(fakeHost.contextKeys.get(PREVIOUS_CONTEXT)).toBe(false)
  })

  test('gives Tab back to indentation when no editor is active', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    new StepAnnotationProvider(sessionStore, new NavigationService())
    await sessionStore.load(TRACE_STEPS)
    fakeHost.fireActiveEditorChange(fakeHost.createEditor(pageDocument, 1))
    await flushContextUpdates()

    // Act
    fakeHost.fireActiveEditorChange(undefined)
    await flushContextUpdates()

    // Assert
    expect(fakeHost.contextKeys.get(NEXT_CONTEXT)).toBe(false)
    expect(fakeHost.contextKeys.get(PREVIOUS_CONTEXT)).toBe(false)
  })

  test('refreshes annotations when Deep Trace settings change but not for unrelated settings', () => {
    // Arrange
    const provider = new StepAnnotationProvider(
      createSessionStore(),
      new NavigationService(),
    )
    const refreshListener = vi.fn()
    provider.onDidChangeCodeLenses(refreshListener)

    // Act
    fakeHost.fireConfigurationChange('editor')
    fakeHost.fireConfigurationChange('deepTrace')

    // Assert
    expect(refreshListener).toHaveBeenCalledTimes(1)
  })

  test('stops annotating and tracking the cursor after being disposed', async () => {
    // Arrange
    const sessionStore = createSessionStore()
    const provider = new StepAnnotationProvider(
      sessionStore,
      new NavigationService(),
    )

    // Act
    provider.dispose()
    await sessionStore.load(TRACE_STEPS)
    fakeHost.fireSelectionChange(fakeHost.createEditor(pageDocument, 1))
    await flushContextUpdates()

    // Assert
    expect(fakeHost.codeLensProviders).toEqual([])
    expect(fakeHost.contextKeys.size).toBe(0)
  })
})
