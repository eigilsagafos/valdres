import {
    lastKeyDownAtom,
    latestKeyDownSequence,
    preventKeyDownDefault,
} from "@valdres/browser-keyboard"
import type { State, Store, Transaction } from "valdres"
import { HotkeyConflictError } from "../errors/HotkeyConflictError"
import { validateBindingConfig } from "./validateBindingConfig"
import { shortcutSelector } from "../selectors/shortcutSelector"
import type { HotkeyCommand } from "../types/HotkeyCommand"
import type { HotkeyOptions } from "../types/HotkeyOptions"
import type { HotkeyScope } from "../types/HotkeyScope"
import type { Shortcut } from "../types/Shortcut"
import { scopeCountAtom } from "./scopeState"

/** A binding's configuration, read afresh at each keydown. */
export type BindingConfig = HotkeyOptions & { readonly command: HotkeyCommand }

export interface BindingHandle {
    /** Re-indexes new shortcuts in place, keeping registration identity and cutoff. */
    readonly setShortcuts: (shortcuts: readonly Shortcut[]) => void
    /** Idempotent. Safe inside a command and after the store is disposed. */
    readonly dispose: () => void
}

interface Binding {
    readonly id: number
    shortcuts: readonly Shortcut[]
    readonly config: () => BindingConfig
    /** Keydowns at or below this sequence happened before the registration. */
    readonly cutoff: number
}

interface Registry {
    readonly store: Store
    readonly bindings: Set<Binding>
    /** Candidates by `c:<code>` and `k:<lowercased key>`. */
    readonly index: Map<string, Set<Binding>>
    /**
     * Exclusive scopes that may be active in this store. Whether one is active
     * is always read from its count atom, so this set can never disagree with
     * the activations; it only avoids checking every scope ever defined.
     */
    readonly exclusive: Set<HotkeyScope>
    /** The highest sequence this store's dispatcher has decided on. */
    lastSeen: number
    stop: (() => void) | undefined
    teardownScheduled: boolean
}

type Candidate = {
    readonly config: BindingConfig
    readonly shortcut: Shortcut
}

const registries = new WeakMap<Store, Registry>()
let nextId = 0

const registryFor = (store: Store): Registry => {
    let registry = registries.get(store)
    if (registry === undefined) {
        registry = {
            store,
            bindings: new Set(),
            index: new Map(),
            exclusive: new Set(),
            lastSeen: 0,
            stop: undefined,
            teardownScheduled: false,
        }
        registries.set(store, registry)
    }
    return registry
}

const indexKeys = (shortcut: Shortcut) => [
    `c:${shortcut.trigger}`,
    `k:${shortcut.key}`,
]

const addToIndex = (registry: Registry, binding: Binding) => {
    for (const shortcut of binding.shortcuts)
        for (const key of indexKeys(shortcut)) {
            let set = registry.index.get(key)
            if (set === undefined) registry.index.set(key, (set = new Set()))
            set.add(binding)
        }
}

const removeFromIndex = (registry: Registry, binding: Binding) => {
    for (const shortcut of binding.shortcuts)
        for (const key of indexKeys(shortcut)) {
            const set = registry.index.get(key)
            if (set === undefined) continue
            set.delete(binding)
            if (set.size === 0) registry.index.delete(key)
        }
}

const isEnabled = (
    tx: Transaction,
    enabled: boolean | State<boolean> | undefined,
) =>
    enabled === undefined ||
    (typeof enabled === "boolean" ? enabled : tx.get(enabled) === true)

/**
 * The store's one settle handler. Its only trigger is a new keydown, never an
 * eligibility, scope or registration change, so a retained keydown is never
 * served again. Picks at most one binding and runs it in this settle's own
 * transaction.
 */
const dispatch = (registry: Registry, tx: Transaction): unknown => {
    const keyDown = tx.get(lastKeyDownAtom)
    if (keyDown === null || keyDown.sequence <= registry.lastSeen) return
    // Recorded outside the transaction, before any command runs: a failing
    // command rolls back its writes, not this decision. No retry, no fallthrough.
    registry.lastSeen = keyDown.sequence

    const candidates = new Set<Binding>()
    for (const key of [`c:${keyDown.code}`, `k:${keyDown.key.toLowerCase()}`])
        for (const binding of registry.index.get(key) ?? [])
            candidates.add(binding)
    if (candidates.size === 0) return

    const isActive = (scope: HotkeyScope) =>
        tx.get(scopeCountAtom(scope, registry.store)) > 0
    let floor = -Infinity
    for (const scope of registry.exclusive)
        if (scope.priority > floor && isActive(scope)) floor = scope.priority

    let best: Candidate[] = []
    let bestLayer = -Infinity
    let bestPriority = -Infinity
    for (const binding of candidates) {
        if (keyDown.sequence <= binding.cutoff) continue
        const config = binding.config()
        // Applied before arbitration: an already-cancelled keydown is not a
        // candidate unless the binding opts in. The snapshot predates every
        // store update, so another store's cancellation never affects it.
        if (keyDown.defaultPrevented && config.handleDefaultPrevented !== true)
            continue
        const layer = config.scope?.priority ?? 0
        if (layer < floor) continue
        if (keyDown.editable && config.editable !== true) continue
        const shortcut = binding.shortcuts.find(
            s => tx.get(shortcutSelector(s.id)) !== null,
        )
        if (shortcut === undefined) continue
        if (config.scope !== undefined && !isActive(config.scope)) continue
        if (!isEnabled(tx, config.enabled)) continue
        const priority = config.priority ?? 0
        if (
            layer > bestLayer ||
            (layer === bestLayer && priority > bestPriority)
        ) {
            best = [{ config, shortcut }]
            bestLayer = layer
            bestPriority = priority
        } else if (layer === bestLayer && priority === bestPriority) {
            best.push({ config, shortcut })
        }
    }
    if (best.length === 0) return
    if (best.length > 1)
        throw new HotkeyConflictError(
            keyDown,
            best.map(({ shortcut }) => shortcut.id),
        )
    const { config, shortcut } = best[0]!
    if (config.preventDefault === true) preventKeyDownDefault(keyDown)
    if (keyDown.repeat && config.repeat !== true) return
    // Returned to core: a promise is contained (its rejection is observed) and
    // the transaction is rejected with InvalidTransactionCallbackResultError,
    // like any settle handler that returns one.
    return config.command(tx, Object.freeze({ keyDown, shortcut: shortcut.id }))
}

const isTransactionPhaseError = (error: unknown) =>
    (error as { name?: unknown } | null)?.name === "TransactionPhaseError"

const teardown = (registry: Registry) => {
    if (registry.bindings.size > 0 || registry.stop === undefined) return
    try {
        registry.stop()
        registry.stop = undefined
    } catch (error) {
        // Unsubscribing is forbidden inside a transaction, as when a command
        // disposes the last binding. Finish once the update is over.
        if (!isTransactionPhaseError(error) || registry.teardownScheduled)
            throw error
        registry.teardownScheduled = true
        queueMicrotask(() => {
            registry.teardownScheduled = false
            teardown(registry)
        })
    }
}

/**
 * Registers a binding with `store`'s dispatcher, creating it if needed.
 * `config` is read at each keydown. Throws `TransactionPhaseError` inside a
 * transaction and `StoreDisposedError` for a disposed store, before anything
 * is recorded.
 */
export const registerBinding = (
    store: Store,
    shortcuts: readonly Shortcut[],
    config: () => BindingConfig,
): BindingHandle => {
    if (shortcuts.length === 0)
        throw new TypeError("A hotkey needs at least one shortcut")
    validateBindingConfig(config())
    // The store's view may still be one keydown behind while that keydown is
    // delivered to other stores; the hub's own sequence never is.
    const storeView = store.get(lastKeyDownAtom)?.sequence ?? 0
    const cutoff = Math.max(storeView, latestKeyDownSequence())
    const registry = registryFor(store)
    if (registry.stop === undefined)
        registry.stop = store.sub(lastKeyDownAtom, {
            settle: tx => dispatch(registry, tx) as void,
        })
    const binding: Binding = { id: ++nextId, shortcuts, config, cutoff }
    registry.bindings.add(binding)
    addToIndex(registry, binding)
    let disposed = false
    return {
        setShortcuts: next => {
            if (disposed) return
            if (next.length === 0)
                throw new TypeError("A hotkey needs at least one shortcut")
            removeFromIndex(registry, binding)
            binding.shortcuts = next
            addToIndex(registry, binding)
        },
        dispose: () => {
            if (disposed) return
            disposed = true
            registry.bindings.delete(binding)
            removeFromIndex(registry, binding)
            teardown(registry)
        },
    }
}

/** Lets dispatch in `store` check an exclusive scope's floor. */
export const rememberExclusive = (store: Store, scope: HotkeyScope): void => {
    if (scope.exclusive) registryFor(store).exclusive.add(scope)
}

/** Stops checking a scope whose count in `store` reached 0. */
export const forgetExclusive = (store: Store, scope: HotkeyScope): void => {
    registries.get(store)?.exclusive.delete(scope)
}

/** @internal For tests: what a store's registry holds. */
export const inspectRegistry = (store: Store) => {
    const registry = registries.get(store)
    return {
        bindings: registry?.bindings.size ?? 0,
        /** Binding ids in registration order. */
        ids: [...(registry?.bindings ?? [])].map(binding => binding.id),
        indexKeys: registry?.index.size ?? 0,
        exclusiveScopes: registry?.exclusive.size ?? 0,
        dispatching: registry?.stop !== undefined,
    }
}
