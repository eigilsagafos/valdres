/**
 * Minimal surface of the Redux DevTools browser extension that this adapter
 * relies on. The real extension injects `window.__REDUX_DEVTOOLS_EXTENSION__`.
 */

export interface ReduxDevtoolsConnection {
    /** Seed the timeline with the initial state. */
    init(state: unknown): void
    /**
     * Append an action + the resulting state to the timeline. A `null` action
     * replaces the monitor's whole lifted state instead — used to load an
     * imported session (`state` is then the full lifted state).
     */
    send(
        action: ({ type: string } & Record<string, unknown>) | null,
        state: unknown,
    ): void
    /** Listen for messages from the extension (time-travel, commit, reset). */
    subscribe(listener: (message: ReduxDevtoolsMessage) => void): () => void
    unsubscribe(): void
    error(message: string): void
}

export interface ReduxDevtoolsExtension {
    connect(options?: {
        name?: string
        [key: string]: unknown
    }): ReduxDevtoolsConnection
    disconnect?(): void
}

export interface ReduxDevtoolsMessage {
    /** "DISPATCH" | "ACTION" | "START" | "STOP" | ... */
    type: string
    payload?: {
        /** "JUMP_TO_ACTION" | "JUMP_TO_STATE" | "COMMIT" | "ROLLBACK" | "RESET" | ... */
        type?: string
        [key: string]: unknown
    }
    /** JSON-encoded snapshot the extension wants us to jump/roll back to. */
    state?: string
    id?: string
}

declare global {
    interface Window {
        __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension
    }
}
