import type {
    Atom,
    Store,
    StoreChange,
    StoreChangeMeta,
    StoreChangeSource,
} from "valdres"
import type {
    ConnectReduxDevtoolsOptions,
    ReduxDevtoolsHandle,
} from "./types/ConnectReduxDevtoolsOptions"
import type { DevtoolsSnapshot } from "./types/DevtoolsSnapshot"
import { createNameRegistry } from "./lib/nameRegistry"
import { restoreSnapshot } from "./lib/restoreSnapshot"
import { atomBucket, cloneSnapshot, computedBucket } from "./lib/snapshot"

const noop: ReduxDevtoolsHandle = { disconnect() {} }

/** Suffix tag for automatic / non-`set` operations, so the timeline can tell
 *  a reset/delete/revalidation apart from a plain assignment. */
const SOURCE_TAG: Record<StoreChangeSource, string> = {
    set: "",
    transaction: "",
    reset: "reset",
    delete: "deleted",
    unset: "reverted",
    revalidate: "revalidate",
    "async-set": "resolved",
}

/** Build the Redux action label for one committed operation. A named
 *  transaction uses its name verbatim; otherwise we synthesize from the changed
 *  atoms, the scopes they touched, and the operation source. */
const buildLabel = (
    meta: StoreChangeMeta,
    qualified: string[],
    scopesTouched: Set<string>,
    lastBareName: string,
): string => {
    if (meta.name) return meta.name
    const scopes = [...scopesTouched]
    const count = qualified.length
    let base: string
    if (scopes.length === 1) {
        const scope = scopes[0]
        const prefix = scope === "root" ? "" : `@scope:${scope} `
        const core =
            count === 1
                ? lastBareName
                : meta.source === "transaction"
                  ? `txn (${count} atoms)`
                  : `${count} atoms`
        base = prefix + core
    } else {
        base = `txn (${count} atoms · ${scopes.join(", ")})`
    }
    const tag = SOURCE_TAG[meta.source]
    return tag ? `${base} (${tag})` : base
}

/**
 * Connect a valdres store to the Redux DevTools browser extension.
 *
 * Every committed change to a named atom (in the store or any scope) is sent as
 * an action, and the extension's time-travel / commit / reset controls restore
 * state back onto the store. Built on `store.onChange`, so a transaction —
 * including one spanning scopes — arrives as a single action (named via
 * `store.txn(fn, name)` when you provide one).
 *
 * Unnamed atoms are tracked as `unnamed_atom_N` by default; pass
 * `unnamed: "ignore"` to leave them out. Returns a handle whose `disconnect()`
 * detaches everything; a no-op handle (with a warning) when the extension isn't
 * installed.
 */
export const connectReduxDevtools = (
    store: Store,
    options: ConnectReduxDevtoolsOptions = {},
): ReduxDevtoolsHandle => {
    const ext =
        typeof window !== "undefined"
            ? window.__REDUX_DEVTOOLS_EXTENSION__
            : undefined
    if (!ext) {
        console.warn(
            "[@valdres/redux-devtools] Redux DevTools extension not found — connectReduxDevtools() is a no-op. Install the extension and reload.",
        )
        return noop
    }

    const {
        name = "valdres",
        serialize = (_atom, value) => value,
        scopes: includeScopes = true,
        unnamed = "track",
        selectors: includeSelectors = false,
    } = options

    // NB: we intentionally do NOT pass a `features` object to disable the
    // reducer-only controls (skip/reorder/dispatch). In practice the extension
    // couples the action-row toolbar to those flags and hides the Jump button
    // when skip/reorder are disabled — even with `jump: true`. So we leave the
    // monitor's defaults intact (Jump/slider work) and instead surface an
    // in-panel error if skip/reorder is actually dispatched (see below).
    const connection = ext.connect({ name })
    const names = createNameRegistry(unnamed)

    const model: DevtoolsSnapshot = {}

    // Seed the timeline with state that already exists. Only enumerable stores
    // (`store(id, { enumerable: true })`) can be enumerated — a default store's
    // values live in a WeakMap, so we skip (no `snapshot()` call, no warning)
    // and the model fills in via onChange as state first changes.
    if (store.data.enumerable) {
        for (const entry of store.snapshot()) {
            if (entry.scope.length > 0 && !includeScopes) continue
            const scopeKey =
                entry.scope.length === 0 ? null : entry.scope.join("/")
            if (entry.type === "selector") {
                if (!includeSelectors) continue
                const selName = entry.state.name
                if (!selName) continue
                // Root selectors → top-level @computed; scope selectors →
                // @scopes.<scope>.@computed, keyed by bare selector name.
                computedBucket(model, scopeKey)[selName] = serialize(
                    entry.state,
                    entry.value,
                )
                continue
            }
            const atomName = names.nameFor(entry.state)
            if (!atomName) continue
            atomBucket(model, scopeKey)[atomName] = serialize(
                entry.state,
                entry.value,
            )
        }
    }

    // Captured after seeding, so RESET returns to the connect-time state.
    const initial = cloneSnapshot(model)
    connection.init(cloneSnapshot(model))

    let isRestoring = false
    let paused = false

    const overwriteModel = (target: DevtoolsSnapshot) => {
        for (const key of Object.keys(model)) delete model[key]
        const clone = cloneSnapshot(target)
        for (const key of Object.keys(clone)) model[key] = clone[key]
    }

    const resolveAtom = (atomName: string): Atom<any> | undefined =>
        names.resolve(atomName) as Atom<any> | undefined

    const handleChanges = (
        changes: readonly StoreChange[],
        meta: StoreChangeMeta,
    ) => {
        if (isRestoring) return

        const qualified: string[] = []
        const scopesTouched = new Set<string>()
        let lastBareName = ""
        let computedTouched = false

        for (const change of changes) {
            if (change.scope.length > 0 && !includeScopes) continue
            const scopeKey =
                change.scope.length === 0 ? null : change.scope.join("/")

            // Derived (selector) values: display-only, under @computed, keyed by
            // scope-qualified selector name. Unnamed selectors are skipped.
            if (change.type === "selector") {
                const selName = change.state.name
                if (!selName) continue
                // Root selectors → top-level @computed; scope selectors →
                // @scopes.<scope>.@computed, keyed by bare selector name.
                computedBucket(model, scopeKey)[selName] = serialize(
                    change.state,
                    change.value,
                )
                computedTouched = true
                continue
            }

            const atomName = names.nameFor(change.state)
            if (!atomName) continue // unnamed atom + unnamed: "ignore"
            const bucket = atomBucket(model, scopeKey)

            // `kind` is authoritative (it distinguishes an unset from a set even
            // inside a transaction, where meta.source is "transaction"):
            //  - delete        → the atom is gone, remove it.
            //  - unset + scope → the override is gone and the scope re-inherits,
            //                    so drop it from `@scopes` rather than showing
            //                    the inherited value as if it were an override.
            //  - unset + root  → reverted to default; that IS the root's value.
            //  - set           → the new value.
            if (
                change.kind === "delete" ||
                (change.kind === "unset" && scopeKey !== null)
            ) {
                delete bucket[atomName]
            } else {
                bucket[atomName] = serialize(change.state, change.value)
            }

            scopesTouched.add(scopeKey === null ? "root" : scopeKey)
            lastBareName = atomName
            qualified.push(scopeKey === null ? atomName : `${scopeKey}/${atomName}`)
        }
        if (qualified.length === 0 && !computedTouched) return
        // Recording paused from the monitor: keep the model current (so the next
        // recorded action carries up-to-date state) but don't add a timeline
        // entry.
        if (paused) return

        const type =
            qualified.length > 0
                ? buildLabel(meta, qualified, scopesTouched, lastBareName)
                : "(derived)"
        connection.send(
            {
                type,
                atoms: qualified,
                source: meta.source,
                ...(meta.name ? { name: meta.name } : {}),
            },
            cloneSnapshot(model),
        )
    }

    const unsubscribeStore = includeSelectors
        ? store.onChange(handleChanges, { selectors: true })
        : store.onChange(handleChanges)

    const unsubscribeConnection = connection.subscribe(message => {
        if (message.type !== "DISPATCH" || !message.payload) return
        const dispatchType = message.payload.type
        const jumpTo = (raw: string | undefined) => {
            if (!raw) return
            let target: DevtoolsSnapshot
            try {
                target = JSON.parse(raw)
            } catch {
                return
            }
            isRestoring = true
            try {
                restoreSnapshot(store, target, model, resolveAtom, includeScopes)
                overwriteModel(target)
            } finally {
                isRestoring = false
            }
        }

        switch (dispatchType) {
            case "JUMP_TO_ACTION":
            case "JUMP_TO_STATE":
                jumpTo(message.state)
                break
            case "ROLLBACK":
                jumpTo(message.state)
                connection.init(cloneSnapshot(model))
                break
            case "RESET":
                jumpTo(JSON.stringify(initial))
                connection.init(cloneSnapshot(model))
                break
            case "COMMIT":
                connection.init(cloneSnapshot(model))
                break
            case "PAUSE_RECORDING": {
                // Stop / resume adding timeline entries. `status` is the desired
                // paused state; toggle if absent.
                const status = (message.payload as { status?: unknown }).status
                paused = typeof status === "boolean" ? status : !paused
                break
            }
            case "IMPORT_STATE": {
                // Load a previously exported session: restore the store to the
                // imported *current* state, then hand the imported lifted
                // history back via `send(null, lifted)` so the monitor shows it.
                // (We can't replay the history action-by-action — valdres has no
                // reducer — but the store + timeline end up consistent.)
                const lifted = (
                    message.payload as { nextLiftedState?: any }
                ).nextLiftedState
                const states = lifted?.computedStates
                if (!Array.isArray(states) || states.length === 0) break
                const idx =
                    typeof lifted.currentStateIndex === "number"
                        ? lifted.currentStateIndex
                        : states.length - 1
                const target = states[idx]?.state
                if (target && typeof target === "object") {
                    isRestoring = true
                    try {
                        restoreSnapshot(
                            store,
                            target,
                            model,
                            resolveAtom,
                            includeScopes,
                        )
                        overwriteModel(target)
                    } finally {
                        isRestoring = false
                    }
                }
                connection.send(null, lifted)
                break
            }
            case "TOGGLE_ACTION":
            case "REORDER_ACTION":
                // Skip/reorder recompute state by replaying actions through a
                // reducer — valdres has no reducer, only per-operation changes,
                // so these can't be honored. Surface it in the panel and leave
                // both the store and the action history untouched. (Do NOT
                // re-init here — init re-seeds the monitor and wipes history.)
                connection.error(
                    `[@valdres/redux-devtools] "${dispatchType}" (skip/reorder) is not supported — valdres reports state changes, not replayable actions. Use jump / commit / reset instead.`,
                )
                break
        }
    })

    return {
        disconnect() {
            // Per-connection teardown only: stop observing the store and remove
            // our message listener. NOT `ext.disconnect()` — that's global and
            // would tear down any other connected store instances too.
            unsubscribeStore()
            if (typeof unsubscribeConnection === "function") {
                unsubscribeConnection()
            }
        },
    }
}
