import {
    store as createValdresStore,
    type Atom as ValdresAtom,
    type Store as ValdresStore,
} from "valdres"
import type { Store } from "../types/jotai"
import type { AnyAtomConfig, AtomNode } from "./nodeRegistry"
import { getNode, readNodeState } from "./nodes"
import { withOperation, type LifecycleSink } from "./operationStack"
import { decodeValue, encodeValue } from "./promiseBox"

type Listener = () => void

interface Mounted {
    readonly config: AnyAtomConfig
    readonly listeners: Set<Listener>
    unsubscribe: (() => void) | undefined
}

const DISCARD = Symbol("discard staged read")

/**
 * Where a write function's `get` and `set` go while it runs synchronously.
 * Jotai applies each `set` immediately but notifies once at the end, so writes
 * are staged here, read back by later `get`s, and committed in one Valdres
 * transaction. Reads before the first `set` hit the committed cache.
 */
class BufferFrame {
    open = true
    private readonly writes = new Map<ValdresAtom<unknown>, unknown>()
    /** Configs a set changed, even if a later set restored them. */
    private readonly changed = new Set<AnyAtomConfig>()

    constructor(private readonly runtime: StoreRuntime) {}

    read(node: AtomNode): unknown {
        if (this.writes.size === 0) return this.runtime.readCommitted(node)
        if (node.isPrimitive) {
            return this.writes.has(node.value!)
                ? decodeValue(this.writes.get(node.value!))
                : this.runtime.readCommitted(node)
        }
        return this.runtime.readStaged(node, this.writes)
    }

    stage(node: AtomNode, value: unknown): void {
        const atom = node.value!
        const next = encodeValue(value)
        const previous = this.writes.has(atom)
            ? this.writes.get(atom)
            : this.runtime.readOwnValue(atom)
        if (!Object.is(previous, next)) this.changed.add(node.config)
        this.writes.set(atom, next)
    }

    flush(): void {
        if (this.writes.size === 0) return
        const writes = [...this.writes]
        const changed = [...this.changed]
        this.writes.clear()
        this.changed.clear()
        this.runtime.commit(writes, changed)
    }
}

const runtimes = new WeakMap<Store, StoreRuntime>()

/** The runtime behind a store created by this package, if it is one. */
export const runtimeOf = (store: Store): StoreRuntime | undefined =>
    runtimes.get(store)

const assertInitialValue = (config: AnyAtomConfig) => {
    if (!("init" in config)) throw new Error("atom not writable")
}

const aggregate = (errors: unknown[]) =>
    typeof AggregateError === "function"
        ? new AggregateError(errors)
        : Object.assign(new Error(), { errors })

/**
 * One Jotai store: a private Valdres Store plus Jotai's write, listener and
 * mount protocol. Valdres subscriptions only record which mounted atoms
 * changed; Jotai listeners, onUnmount and onMount then run in a flush after
 * the Valdres operation, outside any transaction, as in Jotai's
 * `flushCallbacks`.
 */
export class StoreRuntime implements LifecycleSink {
    readonly api: Store
    private readonly valdres: ValdresStore = createValdresStore()
    private frame: BufferFrame | undefined
    private lifecycleFrame: BufferFrame | undefined
    private readonly mountedAtoms = new Map<AnyAtomConfig, Mounted>()
    private readonly onUnmounts = new WeakMap<AnyAtomConfig, () => void>()
    private readonly changed = new Set<Mounted>()
    private readonly unmounts: AnyAtomConfig[] = []
    private readonly mounts: AnyAtomConfig[] = []
    private readonly watchers = new Set<() => void>()

    constructor() {
        this.api = {
            get: atom => this.get(atom as unknown as AnyAtomConfig) as never,
            set: (atom, ...args) =>
                this.set(atom as unknown as AnyAtomConfig, args) as never,
            sub: (atom, listener) =>
                this.sub(atom as unknown as AnyAtomConfig, listener),
        }
        runtimes.set(this.api, this)
    }

    /**
     * Calls `watcher` after every store operation until unwatched. Suspense
     * uses it to notice when an atom stops serving the promise a component is
     * waiting for, where Jotai would abort that promise.
     */
    watch(watcher: () => void): () => void {
        this.watchers.add(watcher)
        return () => this.watchers.delete(watcher)
    }

    mounted(config: AnyAtomConfig): void {
        this.mounts.push(config)
    }

    unmounted(config: AnyAtomConfig): void {
        // Mounted and released before its onMount ran: nothing to undo.
        const pending = this.mounts.indexOf(config)
        if (pending === -1) this.unmounts.push(config)
        else this.mounts.splice(pending, 1)
    }

    readCommitted(node: AtomNode): unknown {
        return readNodeState(this.valdres.get, node)
    }

    readOwnValue(atom: ValdresAtom<unknown>): unknown {
        return this.valdres.get(atom)
    }

    readStaged(
        node: AtomNode,
        writes: ReadonlyMap<ValdresAtom<unknown>, unknown>,
    ): unknown {
        let value: unknown
        try {
            this.valdres.txn(tx => {
                for (const [atom, staged] of writes) tx.set(atom, staged)
                value = readNodeState(tx.get, node)
                throw DISCARD
            })
        } catch (error) {
            if (error !== DISCARD) throw error
        }
        return value
    }

    commit(
        writes: ReadonlyArray<readonly [ValdresAtom<unknown>, unknown]>,
        changed: readonly AnyAtomConfig[],
    ) {
        withOperation(this, () => {
            if (writes.length === 1) {
                this.valdres.set(writes[0]![0], writes[0]![1])
            } else {
                this.valdres.txn(tx => {
                    for (const [atom, value] of writes) tx.set(atom, value)
                })
            }
        })
        // Jotai notifies an atom's listeners when any set changed it, even if
        // a later set in the same write restored the committed value.
        for (const config of changed) {
            const mounted = this.mountedAtoms.get(config)
            if (mounted) this.changed.add(mounted)
        }
    }

    private get(config: AnyAtomConfig): unknown {
        const node = getNode(config)
        const frame = this.frame
        return frame?.open ? frame.read(node) : this.readCommitted(node)
    }

    private set(config: AnyAtomConfig, args: unknown[]): unknown {
        return this.run(() => {
            const outer = this.frame
            if (outer?.open) {
                // A store.set inside a write function or onMount: Jotai applies
                // it and flushes it together with the earlier sets.
                try {
                    return this.write(outer, config, args)
                } finally {
                    outer.flush()
                }
            }
            const frame = new BufferFrame(this)
            this.frame = frame
            try {
                return this.write(frame, config, args)
            } finally {
                // Jotai keeps the writes made before a write function threw.
                frame.open = false
                this.frame = outer
                frame.flush()
            }
        })
    }

    private setOwnValue(config: AnyAtomConfig, value: unknown): void {
        assertInitialValue(config)
        this.run(() => {
            const node = getNode(config)
            const frame = this.frame?.open ? this.frame : new BufferFrame(this)
            frame.stage(node, value)
            frame.flush()
        })
    }

    private write(frame: BufferFrame, config: AnyAtomConfig, args: unknown[]) {
        const get = (target: AnyAtomConfig) =>
            frame.open ? frame.read(getNode(target)) : this.get(target)
        // After the write function returns (an async write past its first
        // await), each set is its own store operation, as in Jotai.
        const set = (target: AnyAtomConfig, ...values: unknown[]): unknown => {
            if (!frame.open) {
                return target === config
                    ? this.setOwnValue(target, values[0])
                    : this.set(target, values)
            }
            if (target === config) {
                assertInitialValue(target)
                frame.stage(getNode(target), values[0])
                return undefined
            }
            return this.write(frame, target, values)
        }
        return config.write!(get, set, ...args)
    }

    private sub(config: AnyAtomConfig, listener: Listener): () => void {
        const node = getNode(config)
        let mounted!: Mounted
        this.run(() => {
            if (this.frame?.open) this.frame.flush()
            mounted = this.mountedAtoms.get(config) ?? this.mount(config, node)
            mounted.listeners.add(listener)
        })
        let subscribed = true
        return () => {
            if (!subscribed) return
            subscribed = false
            this.run(() => {
                mounted.listeners.delete(listener)
                if (
                    mounted.listeners.size > 0 ||
                    this.mountedAtoms.get(config) !== mounted
                ) {
                    return
                }
                this.mountedAtoms.delete(config)
                this.changed.delete(mounted)
                mounted.unsubscribe?.()
            })
        }
    }

    private mount(config: AnyAtomConfig, node: AtomNode): Mounted {
        const mounted: Mounted = {
            config,
            listeners: new Set(),
            unsubscribe: undefined,
        }
        this.mountedAtoms.set(config, mounted)
        // The Valdres callback only records the change; Jotai's listeners run
        // in flushCallbacks, where they may read, write and (un)subscribe.
        mounted.unsubscribe = this.valdres.sub(node.state, () => {
            this.changed.add(mounted)
        })
        return mounted
    }

    private run<T>(operation: () => T): T {
        try {
            return withOperation(this, operation)
        } finally {
            const errors = withOperation(this, () => this.flushCallbacks())
            for (const watcher of [...this.watchers]) {
                try {
                    watcher()
                } catch (error) {
                    errors.push(error)
                }
            }
            if (errors.length > 0) throw aggregate(errors)
        }
    }

    // Port of Jotai 3.0.1's flushCallbacks order: listeners of changed atoms
    // (each listener once), then onUnmount, then onMount, repeated while new
    // work appears. setAtom calls made synchronously by mount callbacks are
    // applied together after them.
    private flushCallbacks(): unknown[] {
        const errors: unknown[] = []
        const call = (fn: () => void) => {
            try {
                fn()
            } catch (error) {
                errors.push(error)
            }
        }
        while (
            this.changed.size > 0 ||
            this.unmounts.length > 0 ||
            this.mounts.length > 0
        ) {
            const callbacks = new Set<Listener>()
            for (const mounted of this.changed) {
                for (const listener of mounted.listeners)
                    callbacks.add(listener)
            }
            this.changed.clear()
            const unmounts = this.unmounts.splice(0)
            const mounts = this.mounts.splice(0)
            for (const listener of callbacks) call(listener)
            if (unmounts.length === 0 && mounts.length === 0) continue
            const outerFrame = this.frame
            const outerLifecycle = this.lifecycleFrame
            const frame = new BufferFrame(this)
            this.frame = frame
            this.lifecycleFrame = frame
            try {
                for (const config of unmounts) {
                    call(() => {
                        const onUnmount = this.onUnmounts.get(config)
                        this.onUnmounts.delete(config)
                        onUnmount?.()
                    })
                }
                for (const config of mounts) call(() => this.runOnMount(config))
            } finally {
                frame.open = false
                this.frame = outerFrame
                this.lifecycleFrame = outerLifecycle
                call(() => frame.flush())
            }
        }
        return errors
    }

    private runOnMount(config: AnyAtomConfig) {
        const onMount = config.onMount as
            | ((setAtom: (...args: unknown[]) => unknown) => unknown)
            | undefined
        if (typeof config.write !== "function" || !onMount) return
        const setAtom = (...args: unknown[]) => {
            const frame = this.lifecycleFrame
            return frame?.open
                ? this.write(frame, config, args)
                : this.set(config, args)
        }
        const onUnmount = onMount.call(config, setAtom)
        if (typeof onUnmount === "function") {
            this.onUnmounts.set(config, onUnmount as () => void)
        }
    }
}
