import {
    store as createValdresStore,
    type Atom as ValdresAtom,
    type Store as ValdresStore,
    type Transaction,
} from "valdres"
import type { Store } from "../types/jotai"
import type { AnyAtomConfig, AtomNode } from "./nodeRegistry"
import { getNode, readNodeState } from "./nodes"
import { withOperation, type LifecycleSink } from "./operationStack"
import { decodeValue, encodeValue } from "./promiseBox"

type Listener = () => void

interface Mounted {
    readonly listeners: Set<Listener>
    unsubscribe: (() => void) | undefined
}

/**
 * Where a write function's `get` and `set` go while it runs synchronously.
 *
 * - A buffer frame serves a top-level `store.set`. Jotai applies each `set`
 *   immediately but notifies once at the end, so writes are staged here, read
 *   back by later `get`s, and committed in one Valdres transaction. Reads before
 *   the first `set` hit the committed cache, as in Jotai.
 * - A transaction frame serves a listener: listeners run as Valdres `settle`
 *   handlers, so their reads and writes use that handler's transaction.
 */
interface Frame {
    open: boolean
    readonly buffered: boolean
    read(node: AtomNode): unknown
    stage(node: AtomNode, value: unknown): void
    flush(): void
}

const DISCARD = Symbol("discard staged read")

class BufferFrame implements Frame {
    open = true
    readonly buffered = true
    private readonly writes = new Map<ValdresAtom<unknown>, unknown>()

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
        this.writes.set(node.value!, encodeValue(value))
    }

    flush(): void {
        if (this.writes.size === 0) return
        const writes = [...this.writes]
        this.writes.clear()
        this.runtime.commit(writes)
    }
}

class TransactionFrame implements Frame {
    open = true
    readonly buffered = false

    constructor(private readonly tx: Transaction) {}

    read(node: AtomNode): unknown {
        return readNodeState(this.tx.get, node)
    }

    stage(node: AtomNode, value: unknown): void {
        this.tx.set(node.value!, encodeValue(value))
    }

    flush(): void {}
}

const runtimes = new WeakMap<Store, StoreRuntime>()

/** The runtime behind a store created by this package, if it is one. */
export const runtimeOf = (store: Store): StoreRuntime | undefined =>
    runtimes.get(store)

const assertInitialValue = (config: AnyAtomConfig) => {
    if (!("init" in config)) throw new Error("atom not writable")
}

/** One Jotai store: a private Valdres Store plus Jotai's write, listener and mount protocol. */
export class StoreRuntime implements LifecycleSink {
    readonly api: Store
    private readonly valdres: ValdresStore = createValdresStore()
    private depth = 0
    private frame: Frame | undefined
    private readonly mountedAtoms = new Map<AnyAtomConfig, Mounted>()
    private readonly onUnmounts = new WeakMap<AnyAtomConfig, () => void>()
    // Work Jotai performs while flushing, after listeners: Store subscriptions
    // requested inside a listener (Valdres forbids them inside `settle`), then
    // onUnmount callbacks, then onMount callbacks.
    private readonly deferred: Array<() => void> = []
    private readonly unmounts: AnyAtomConfig[] = []
    private readonly mounts: AnyAtomConfig[] = []
    private lifecycleFrame: BufferFrame | undefined
    private readonly watchers = new Set<() => void>()
    private errors: unknown[] = []

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

    commit(writes: ReadonlyArray<readonly [ValdresAtom<unknown>, unknown]>) {
        withOperation(this, () => {
            if (writes.length === 1) {
                this.valdres.set(writes[0]![0], writes[0]![1])
                return
            }
            this.valdres.txn(tx => {
                for (const [atom, value] of writes) tx.set(atom, value)
            })
        })
    }

    private get(config: AnyAtomConfig): unknown {
        const node = getNode(config)
        const frame = this.frame
        return frame?.open ? frame.read(node) : this.readCommitted(node)
    }

    private set(config: AnyAtomConfig, args: unknown[]): unknown {
        return this.run(() => {
            const outer = this.frame
            if (outer?.open && !outer.buffered) {
                return this.write(outer, config, args)
            }
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
            const outer = this.frame
            if (outer?.open) {
                outer.stage(node, value)
                outer.flush()
                return
            }
            const frame = new BufferFrame(this)
            frame.stage(node, value)
            frame.flush()
        })
    }

    private write(frame: Frame, config: AnyAtomConfig, args: unknown[]) {
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
            const outer = this.frame
            if (outer?.open && outer.buffered) outer.flush()
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
                this.structural(() => mounted.unsubscribe?.())
            })
        }
    }

    private mount(config: AnyAtomConfig, node: AtomNode): Mounted {
        const mounted: Mounted = {
            listeners: new Set(),
            unsubscribe: undefined,
        }
        this.mountedAtoms.set(config, mounted)
        this.structural(() => {
            mounted.unsubscribe = this.valdres.sub(node.state, {
                settle: tx => this.deliver(mounted, tx),
            })
        })
        return mounted
    }

    // Listeners run as `settle` handlers so they can write synchronously, as
    // Jotai listeners can. Their failures are collected rather than thrown, so
    // a throwing listener keeps the writes it made and does not stop the rest.
    private deliver(mounted: Mounted, tx: Transaction) {
        const outer = this.frame
        const frame = new TransactionFrame(tx)
        this.frame = frame
        try {
            for (const listener of [...mounted.listeners]) {
                try {
                    listener()
                } catch (error) {
                    this.errors.push(error)
                }
            }
        } finally {
            frame.open = false
            this.frame = outer
        }
    }

    private structural(task: () => void) {
        const frame = this.frame
        if (frame?.open && !frame.buffered) this.deferred.push(task)
        else task()
    }

    private run<T>(operation: () => T): T {
        this.depth++
        try {
            return withOperation(this, operation)
        } finally {
            if (this.depth === 1) {
                try {
                    withOperation(this, () => this.flushCallbacks())
                } finally {
                    this.depth--
                }
                for (const watcher of [...this.watchers]) this.guard(watcher)
                this.throwCollectedErrors()
            } else {
                this.depth--
            }
        }
    }

    private flushCallbacks() {
        while (
            this.deferred.length > 0 ||
            this.unmounts.length > 0 ||
            this.mounts.length > 0
        ) {
            if (this.deferred.length > 0) {
                this.guard(this.deferred.shift()!)
                continue
            }
            // Like Jotai, apply the setAtom calls these callbacks make
            // synchronously together, after the callbacks have run.
            const outer = this.frame
            const frame = new BufferFrame(this)
            this.frame = frame
            this.lifecycleFrame = frame
            try {
                for (const config of this.unmounts.splice(0)) {
                    this.guard(() => {
                        const onUnmount = this.onUnmounts.get(config)
                        this.onUnmounts.delete(config)
                        onUnmount?.()
                    })
                }
                for (const config of this.mounts.splice(0)) {
                    this.guard(() => this.runOnMount(config))
                }
            } finally {
                frame.open = false
                this.frame = outer
                this.lifecycleFrame = undefined
                this.guard(() => frame.flush())
            }
        }
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

    private guard(task: () => void) {
        try {
            task()
        } catch (error) {
            this.errors.push(error)
        }
    }

    private throwCollectedErrors() {
        if (this.errors.length === 0) return
        const errors = this.errors
        this.errors = []
        if (typeof AggregateError === "function") {
            throw new AggregateError(errors)
        }
        throw Object.assign(new Error(), { errors })
    }
}
