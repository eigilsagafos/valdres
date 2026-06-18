import type { Atom, AtomFamily, Selector, SnapshotEntry } from "valdres"

/**
 * One way to single out atoms (or selectors) to exclude from DevTools:
 * - an atom / selector reference — matched by identity;
 * - an `atomFamily` reference — matches every one of its members;
 * - a `name` string — matches an atom/selector with that `name`, or any member
 *   of a family with that `name`;
 * - a predicate `(state) => boolean` over the changed atom/selector for full
 *   control.
 */
export type ExcludeRule =
    | Atom<any>
    | AtomFamily<any>
    | Selector<any>
    | string
    | ((state: SnapshotEntry["state"]) => boolean)

/** One rule, or an array of them. */
export type ExcludeOption = ExcludeRule | readonly ExcludeRule[]

export interface ConnectReduxDevtoolsOptions {
    /** Instance name shown in the Redux DevTools extension dropdown. */
    name?: string
    /**
     * Transform a value before it's sent to the extension (which serializes
     * over `postMessage`). Use this to strip or shape values that aren't
     * structured-cloneable (DOM nodes, class instances, functions). The first
     * argument is the state the value belongs to — an atom, a family-member
     * atom, or (with `selectors: true`) a selector. Defaults to identity.
     */
    serialize?: (state: SnapshotEntry["state"], value: unknown) => unknown
    /**
     * Include scope state under the `@scopes` key and react to scope writes.
     * Defaults to `true`.
     */
    scopes?: boolean
    /**
     * How to handle atoms declared without a `name`:
     * - `"track"` (default): auto-label them `unnamed_atom_N` so they appear
     *   in the timeline and can be restored within the session. These labels
     *   are assigned in encounter order and are NOT stable across reloads, so
     *   a one-time hint suggests naming the atoms you want stable time-travel
     *   for.
     * - `"ignore"`: leave them out of DevTools entirely.
     */
    unnamed?: "track" | "ignore"
    /**
     * Atoms (or selectors) to leave out of DevTools entirely — neither seeded
     * nor reported as actions. Pass an atom/selector reference, an `atomFamily`
     * (excludes all its members), a `name` string, a predicate
     * `(state) => boolean`, or an array mixing any of these. Use this for
     * high-frequency churn (e.g. a `cursorPositionAtom`) that would otherwise
     * flood the timeline and make time-travel unusable.
     */
    exclude?: ExcludeOption
    /**
     * Also report named selector (derived) values under a `@computed` key.
     * Display-only — selectors aren't settable, so they're excluded from
     * time-travel restore. Unnamed selectors are skipped. Defaults to `false`.
     */
    selectors?: boolean
}

export interface ReduxDevtoolsHandle {
    /** Detach the store listener and the extension connection. */
    disconnect(): void
}
