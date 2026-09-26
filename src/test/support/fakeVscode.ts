// Source files reach these exports through `vi.mock('vscode')`, which static analysis cannot follow.
// fallow-ignore-file unused-export unused-type unused-class-member
/**
 * In-memory stand-in for the `vscode` module, used through `vi.mock('vscode')`.
 *
 * Why: the real API only exists inside the extension host, so controller-level tests
 * need a fake that records what the extension showed, opened, and registered.
 * Tests drive it through {@link fakeHost} and read the recorded effects back from it.
 */

type Listener<T> = (value: T) => void
type CommandHandler = (...argumentsList: unknown[]) => unknown

export class Uri {
  private constructor(public readonly fsPath: string) {}

  public static file(filePath: string): Uri {
    return new Uri(filePath)
  }

  public static joinPath(base: Uri, ...pathSegments: string[]): Uri {
    return new Uri([base.fsPath, ...pathSegments].join('/'))
  }

  public toString(): string {
    return `file://${this.fsPath}`
  }
}

export class Position {
  public constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  public constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class Selection extends Range {
  public constructor(
    public readonly anchor: Position,
    public readonly active: Position,
  ) {
    super(anchor, active)
  }
}

export class Location {
  public readonly range: Range

  public constructor(
    public readonly uri: Uri,
    rangeOrPosition: Range | Position,
  ) {
    this.range =
      rangeOrPosition instanceof Range
        ? rangeOrPosition
        : new Range(rangeOrPosition, rangeOrPosition)
  }
}

export class EventEmitter<T> {
  private readonly listeners = new Set<Listener<T>>()

  public readonly event = (listener: Listener<T>): { dispose(): void } =>
    subscribe(this.listeners, listener)

  public fire(value: T): void {
    for (const listener of this.listeners) {
      listener(value)
    }
  }

  public dispose(): void {
    this.listeners.clear()
  }
}

export class CodeLens {
  public constructor(
    public readonly range: Range,
    public readonly command: {
      title: string
      tooltip: string
      command: string
    },
  ) {}
}

export class TreeItem {
  public description?: string
  public tooltip?: MarkdownString
  public command?: { command: string; title: string; arguments: unknown[] }
  public contextValue?: string
  public iconPath?: ThemeIcon

  public constructor(
    public readonly label: string,
    public readonly collapsibleState: number,
  ) {}
}

export const TreeItemCollapsibleState = { None: 0 }

export class MarkdownString {
  public constructor(public readonly value: string) {}
}

export class ThemeIcon {
  public constructor(public readonly id: string) {}
}

export class ThemeColor {
  public constructor(public readonly id: string) {}
}

export const TextEditorRevealType = { InCenterIfOutsideViewport: 2 }

export class Breakpoint {
  public readonly id: string

  public constructor(public readonly enabled = true) {
    fakeHost.breakpointCount += 1
    this.id = `breakpoint-${fakeHost.breakpointCount}`
  }
}

export class SourceBreakpoint extends Breakpoint {
  public constructor(
    public readonly location: Location,
    enabled = true,
  ) {
    super(enabled)
  }
}

export type FakeTextDocument = {
  uri: Uri
  lineCount: number
  lineAt(lineIndex: number): { text: string; range: Range }
}

export type FakeTextEditor = {
  document: FakeTextDocument
  selection: Selection
  revealedRanges: Range[]
  revealRange(range: Range): void
  setDecorations(): void
}

/**
 * Mutable state of the fake extension host: inputs the tests arrange and effects they assert.
 */
export const fakeHost = {
  breakpointCount: 0,
  breakpoints: [] as Breakpoint[],
  clipboardText: '',
  clipboardError: undefined as unknown,
  commandHandlers: new Map<string, CommandHandler>(),
  contextKeys: new Map<string, unknown>(),
  configuration: new Map<string, unknown>(),
  definitionResults: undefined as unknown[] | undefined,
  definitionError: undefined as Error | undefined,
  definitionRequests: [] as { uri: Uri; position: Position }[],
  documents: new Map<string, FakeTextDocument>(),
  workspaceFolders: [{ uri: Uri.file('/workspace') }] as
    { uri: Uri }[] | undefined,
  activeTextEditor: undefined as FakeTextEditor | undefined,
  openedEditors: [] as FakeTextEditor[],
  revealedTreeItems: [] as TreeItem[],
  codeLensProviders: [] as unknown[],
  quickPickItems: [] as { label: string; description: string }[],
  pickQuickPickItem: (items: unknown[]): unknown => items[0],
  informationMessages: [] as string[],
  warningMessages: [] as string[],
  errorMessages: [] as string[],
  breakpointListeners: new Set<Listener<unknown>>(),
  selectionListeners: new Set<Listener<{ textEditor: FakeTextEditor }>>(),
  activeEditorListeners: new Set<Listener<FakeTextEditor | undefined>>(),
  configurationListeners: new Set<
    Listener<{ affectsConfiguration(section: string): boolean }>
  >(),

  /**
   * Restores the empty host so every test starts from the same state.
   */
  reset(): void {
    this.breakpointCount = 0
    this.breakpoints = []
    this.clipboardText = ''
    this.clipboardError = undefined
    this.commandHandlers.clear()
    this.contextKeys.clear()
    this.configuration.clear()
    this.definitionResults = undefined
    this.definitionError = undefined
    this.definitionRequests = []
    this.documents.clear()
    this.workspaceFolders = [{ uri: Uri.file('/workspace') }]
    this.activeTextEditor = undefined
    this.openedEditors = []
    this.revealedTreeItems = []
    this.codeLensProviders = []
    this.quickPickItems = []
    this.pickQuickPickItem = (items) => items[0]
    this.informationMessages = []
    this.warningMessages = []
    this.errorMessages = []
    this.breakpointListeners.clear()
    this.selectionListeners.clear()
    this.activeEditorListeners.clear()
    this.configurationListeners.clear()
  },

  /**
   * Makes a file openable through `workspace.openTextDocument`.
   */
  addDocument(filePath: string, lines: string[]): FakeTextDocument {
    const document: FakeTextDocument = {
      uri: Uri.file(filePath),
      lineCount: lines.length,
      lineAt(lineIndex: number) {
        const text = lines[lineIndex] ?? ''
        return {
          text,
          range: new Range(
            new Position(lineIndex, 0),
            new Position(lineIndex, text.length),
          ),
        }
      },
    }
    this.documents.set(document.uri.toString(), document)
    return document
  },

  /**
   * Builds an editor whose cursor sits at the start of the given zero-based line.
   */
  createEditor(document: FakeTextDocument, lineIndex: number): FakeTextEditor {
    const cursor = new Position(lineIndex, 0)
    return createEditor(document, new Selection(cursor, cursor))
  },

  /**
   * Simulates the user moving the cursor inside an editor.
   */
  fireSelectionChange(editor: FakeTextEditor): void {
    for (const listener of this.selectionListeners) {
      listener({ textEditor: editor })
    }
  },

  /**
   * Simulates the user switching (or closing) the active editor.
   */
  fireActiveEditorChange(editor: FakeTextEditor | undefined): void {
    this.activeTextEditor = editor
    for (const listener of this.activeEditorListeners) {
      listener(editor)
    }
  },

  /**
   * Simulates a settings change that affects the given section.
   */
  fireConfigurationChange(changedSection: string): void {
    for (const listener of this.configurationListeners) {
      listener({
        affectsConfiguration: (section) => section === changedSection,
      })
    }
  },
}

/**
 * Adds a listener and returns a VS Code style disposable that removes it.
 */
function subscribe<T>(
  listeners: Set<Listener<T>>,
  listener: Listener<T>,
): { dispose(): void } {
  listeners.add(listener)
  return {
    dispose(): void {
      listeners.delete(listener)
    },
  }
}

/**
 * Creates an editor that records reveal calls.
 */
function createEditor(
  document: FakeTextDocument,
  selection: Selection,
): FakeTextEditor {
  const editor: FakeTextEditor = {
    document,
    selection,
    revealedRanges: [],
    revealRange(range: Range): void {
      editor.revealedRanges.push(range)
    },
    setDecorations(): void {},
  }
  return editor
}

export const commands = {
  registerCommand(
    commandId: string,
    handler: CommandHandler,
  ): { dispose(): void } {
    fakeHost.commandHandlers.set(commandId, handler)
    return {
      dispose(): void {
        fakeHost.commandHandlers.delete(commandId)
      },
    }
  },
  async executeCommand(
    commandId: string,
    ...args: unknown[]
  ): Promise<unknown> {
    if (commandId === 'setContext') {
      fakeHost.contextKeys.set(args[0] as string, args[1])
      return undefined
    }

    if (commandId === 'vscode.executeDefinitionProvider') {
      fakeHost.definitionRequests.push({
        uri: args[0] as Uri,
        position: args[1] as Position,
      })
      if (fakeHost.definitionError) {
        throw fakeHost.definitionError
      }
      return fakeHost.definitionResults
    }

    throw new Error(`Unexpected command in test: ${commandId}`)
  },
}

export const window = {
  get activeTextEditor(): FakeTextEditor | undefined {
    return fakeHost.activeTextEditor
  },
  async showInformationMessage(message: string): Promise<undefined> {
    fakeHost.informationMessages.push(message)
    return undefined
  },
  async showWarningMessage(message: string): Promise<undefined> {
    fakeHost.warningMessages.push(message)
    return undefined
  },
  async showErrorMessage(message: string): Promise<undefined> {
    fakeHost.errorMessages.push(message)
    return undefined
  },
  async showQuickPick(items: { label: string; description: string }[]) {
    fakeHost.quickPickItems = items.map(({ label, description }) => ({
      label,
      description,
    }))
    return fakeHost.pickQuickPickItem(items)
  },
  async showTextDocument(
    document: FakeTextDocument,
    options: { selection: Range },
  ): Promise<FakeTextEditor> {
    const editor = createEditor(
      document,
      new Selection(options.selection.start, options.selection.end),
    )
    fakeHost.openedEditors.push(editor)
    fakeHost.activeTextEditor = editor
    return editor
  },
  createTextEditorDecorationType(): { dispose(): void } {
    return { dispose(): void {} }
  },
  createTreeView() {
    return {
      async reveal(item: TreeItem): Promise<void> {
        fakeHost.revealedTreeItems.push(item)
      },
      dispose(): void {},
    }
  },
  onDidChangeTextEditorSelection(
    listener: Listener<{ textEditor: FakeTextEditor }>,
  ): { dispose(): void } {
    return subscribe(fakeHost.selectionListeners, listener)
  },
  onDidChangeActiveTextEditor(listener: Listener<FakeTextEditor | undefined>): {
    dispose(): void
  } {
    return subscribe(fakeHost.activeEditorListeners, listener)
  },
}

export const workspace = {
  get workspaceFolders(): { uri: Uri }[] | undefined {
    return fakeHost.workspaceFolders
  },
  async openTextDocument(uri: Uri): Promise<FakeTextDocument> {
    const document = fakeHost.documents.get(uri.toString())
    if (!document) {
      throw new Error(`File not found: ${uri.fsPath}`)
    }
    return document
  },
  asRelativePath(uri: Uri): string {
    return uri.fsPath.replace('/workspace/', '')
  },
  getConfiguration(section: string) {
    return {
      get<T>(key: string, defaultValue: T): T {
        const configuredValue = fakeHost.configuration.get(`${section}.${key}`)
        return configuredValue === undefined
          ? defaultValue
          : (configuredValue as T)
      },
    }
  },
  onDidChangeConfiguration(
    listener: Listener<{ affectsConfiguration(section: string): boolean }>,
  ): { dispose(): void } {
    return subscribe(fakeHost.configurationListeners, listener)
  },
}

export const languages = {
  registerCodeLensProvider(
    _selector: unknown,
    provider: unknown,
  ): { dispose(): void } {
    fakeHost.codeLensProviders.push(provider)
    return {
      dispose(): void {
        fakeHost.codeLensProviders = fakeHost.codeLensProviders.filter(
          (registeredProvider) => registeredProvider !== provider,
        )
      },
    }
  },
}

export const env = {
  clipboard: {
    async readText(): Promise<string> {
      if (fakeHost.clipboardError !== undefined) {
        throw fakeHost.clipboardError
      }
      return fakeHost.clipboardText
    },
  },
}

export const debug = {
  get breakpoints(): readonly Breakpoint[] {
    return fakeHost.breakpoints
  },
  addBreakpoints(nextBreakpoints: readonly Breakpoint[]): void {
    fakeHost.breakpoints = [...fakeHost.breakpoints, ...nextBreakpoints]
  },
  removeBreakpoints(removedBreakpoints: readonly Breakpoint[]): void {
    const removedIds = new Set(
      removedBreakpoints.map((breakpoint) => breakpoint.id),
    )
    fakeHost.breakpoints = fakeHost.breakpoints.filter(
      (breakpoint) => !removedIds.has(breakpoint.id),
    )
  },
  onDidChangeBreakpoints(listener: Listener<unknown>): { dispose(): void } {
    return subscribe(fakeHost.breakpointListeners, listener)
  },
}
