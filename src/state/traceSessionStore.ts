import type { TraceStep } from "../models/traceStep";

export const SESSION_STORAGE_KEY = "deepTrace.session";
const EMPTY_STEP_INDEX = -1;
const FIRST_STEP_INDEX = 0;

export type TraceSessionSnapshot = {
  steps: TraceStep[];
  currentStepIndex: number;
};

export type SessionStorage = {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Promise<void>;
};

/**
 * Keeps the currently loaded trace in memory and in persistent workspace state.
 */
export class TraceSessionStore {
  private steps: TraceStep[] = [];
  private currentStepIndex = EMPTY_STEP_INDEX;
  private readonly changeListeners = new Set<() => void>();

  /**
   * Creates a new session store around the provided persistence layer.
   */
  public constructor(private readonly storage: SessionStorage) {}

  /**
   * Loads new steps into the current session.
   */
  public async load(steps: TraceStep[]): Promise<void> {
    this.steps = [...steps];
    this.currentStepIndex = steps.length > 0 ? FIRST_STEP_INDEX : EMPTY_STEP_INDEX;
    await this.persistCurrentSnapshot();
    this.emitChange();
  }

  /**
   * Restores a previous session from storage when possible.
   */
  public async restore(): Promise<boolean> {
    const savedSnapshot = this.storage.get<TraceSessionSnapshot | undefined>(
      SESSION_STORAGE_KEY
    );

    if (!savedSnapshot || savedSnapshot.steps.length === 0) {
      return false;
    }

    this.steps = [...savedSnapshot.steps];
    this.currentStepIndex = this.clampStepIndex(savedSnapshot.currentStepIndex);
    this.emitChange();
    return true;
  }

  /**
   * Clears the active session from memory and storage.
   */
  public async clear(): Promise<void> {
    this.steps = [];
    this.currentStepIndex = EMPTY_STEP_INDEX;
    await this.storage.update(SESSION_STORAGE_KEY, undefined);
    this.emitChange();
  }

  /**
   * Returns the currently selected step.
   */
  public getCurrentStep(): TraceStep | undefined {
    if (!this.hasSession() || this.currentStepIndex === EMPTY_STEP_INDEX) {
      return undefined;
    }

    return this.steps[this.currentStepIndex];
  }

  /**
   * Returns whether any trace session is currently loaded.
   */
  public hasSession(): boolean {
    return this.steps.length > 0;
  }

  /**
   * Moves the current selection to the next trace step when possible.
   */
  public async goToNext(): Promise<TraceStep | undefined> {
    return this.setCurrentStepIndex(this.currentStepIndex + 1);
  }

  /**
   * Moves the current selection to the previous trace step when possible.
   */
  public async goToPrevious(): Promise<TraceStep | undefined> {
    return this.setCurrentStepIndex(this.currentStepIndex - 1);
  }

  /**
   * Returns the ordered steps in the active session.
   */
  public getSteps(): TraceStep[] {
    return [...this.steps];
  }

  /**
   * Returns the currently selected step index.
   */
  public getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  /**
   * Moves the selection to a specific index when a session exists.
   */
  public async setCurrentStepIndex(index: number): Promise<TraceStep | undefined> {
    if (!this.hasSession()) {
      return undefined;
    }

    this.currentStepIndex = this.clampStepIndex(index);
    await this.persistCurrentSnapshot();
    this.emitChange();
    return this.getCurrentStep();
  }

  /**
   * Registers a callback that runs whenever the active session changes.
   */
  public onDidChange(listener: () => void): () => void {
    this.changeListeners.add(listener);

    return () => {
      this.changeListeners.delete(listener);
    };
  }

  /**
   * Saves the current in-memory state back to the persistence layer.
   */
  private async persistCurrentSnapshot(): Promise<void> {
    const snapshot = this.hasSession()
      ? {
          steps: this.getSteps(),
          currentStepIndex: this.currentStepIndex
        }
      : undefined;
    await this.storage.update(SESSION_STORAGE_KEY, snapshot);
  }

  /**
   * Ensures that the selected index always stays inside the available steps.
   */
  private clampStepIndex(index: number): number {
    if (!this.hasSession()) {
      return EMPTY_STEP_INDEX;
    }

    const lastStepIndex = this.steps.length - 1;
    return Math.min(Math.max(index, FIRST_STEP_INDEX), lastStepIndex);
  }

  /**
   * Notifies all listeners that the session state changed.
   */
  private emitChange(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}
