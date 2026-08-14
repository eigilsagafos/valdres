/**
 * A Map-shaped cache that keeps its values weakly.
 *
 * Atom-family keys are primitive/serialized values, so a WeakMap cannot be used
 * directly. Keeping only WeakRefs after the current job preserves a member's
 * identity for as long as a caller or store membership still retains it,
 * without making the family itself the lifetime owner of every member it has
 * ever created. Dead entries are swept lazily by lookup, iteration, and size.
 * Caches whose one-shot keys may never be observed again can opt into
 * autonomous cleanup; bounded groups then share one finalizer token so
 * registration and callback work do not scale one-for-one with members.
 *
 * New values stay strong until the next microtask checkpoint, then are weakened
 * in one batch. This keeps synchronous family creation on the normal Map.set
 * path and performs weak-ref conversion in one tight loop; the ECMAScript
 * WeakRef model keeps newly dereferenced targets alive for the current job
 * either way.
 */
type WeakValueMapOptions = {
    autonomousCleanup?: boolean
}

type AutonomousFinalizerEntry<K, V extends WeakKey> = {
    active: boolean
    key: K | undefined
    ref: WeakRef<V>
}

const FINALIZER_BATCH_SIZE = 64

class AutonomousCleanup<K, V extends WeakKey> {
    private readonly batchTokensByValue = new WeakMap<V, object[]>()
    private readonly entryByRef = new WeakMap<
        WeakRef<V>,
        AutonomousFinalizerEntry<K, V>
    >()
    private readonly finalizer = new FinalizationRegistry<
        AutonomousFinalizerEntry<K, V>[]
    >(entries => {
        for (const entry of entries) {
            if (entry.active) this.remove(entry.key as K, entry.ref)
        }
    })

    constructor(private readonly remove: (key: K, ref: WeakRef<V>) => void) {}

    register(entries: Array<{ key: K; value: V; ref: WeakRef<V> }>) {
        for (let offset = 0; offset < entries.length; ) {
            const batchToken = {}
            const batch: AutonomousFinalizerEntry<K, V>[] = []
            const end = Math.min(offset + FINALIZER_BATCH_SIZE, entries.length)
            for (; offset < end; offset++) {
                const { key, value, ref } = entries[offset]!
                const finalizerEntry = { active: true, key, ref }
                this.entryByRef.set(ref, finalizerEntry)
                const tokens = this.batchTokensByValue.get(value)
                if (tokens === undefined) {
                    this.batchTokensByValue.set(value, [batchToken])
                } else {
                    tokens.push(batchToken)
                }
                batch.push(finalizerEntry)
            }
            this.finalizer.register(batchToken, batch)
        }
    }

    release(ref: WeakRef<V>) {
        const entry = this.entryByRef.get(ref)
        if (entry === undefined) return
        entry.active = false
        entry.key = undefined
    }
}

export class WeakValueMap<K, V extends WeakKey> {
    readonly [Symbol.toStringTag] = "Map"

    private readonly refs = new Map<K, V | WeakRef<V>>()
    private readonly autonomousCleanup: AutonomousCleanup<K, V> | undefined
    private weakeningScheduled = false
    private readonly weaken = () => {
        this.weakeningScheduled = false
        const finalizerEntries:
            | Array<{ key: K; value: V; ref: WeakRef<V> }>
            | undefined = this.autonomousCleanup ? [] : undefined
        for (const [key, entry] of this.refs) {
            if (!(entry instanceof WeakRef)) {
                const ref = new WeakRef(entry)
                this.refs.set(key, ref)
                finalizerEntries?.push({ key, value: entry, ref })
            }
        }
        if (finalizerEntries !== undefined) {
            this.autonomousCleanup!.register(finalizerEntries)
        }
    }

    constructor(options?: WeakValueMapOptions) {
        this.autonomousCleanup = options?.autonomousCleanup
            ? new AutonomousCleanup((key, ref) => {
                  if (this.refs.get(key) === ref) this.refs.delete(key)
              })
            : undefined
    }

    get size() {
        // Sweep here so the observable Map surface never counts entries whose
        // values are gone.
        for (const [key, entry] of this.refs) {
            if (entry instanceof WeakRef && entry.deref() === undefined) {
                this.deleteRef(key, entry)
            }
        }
        return this.refs.size
    }

    clear() {
        if (this.autonomousCleanup !== undefined) {
            for (const entry of this.refs.values()) {
                if (entry instanceof WeakRef) {
                    this.autonomousCleanup.release(entry)
                }
            }
        }
        this.refs.clear()
    }

    delete(key: K) {
        if (this.autonomousCleanup !== undefined) {
            const entry = this.refs.get(key)
            if (entry instanceof WeakRef) {
                this.autonomousCleanup.release(entry)
            }
        }
        return this.refs.delete(key)
    }

    get(key: K): V | undefined {
        const entry = this.refs.get(key)
        if (entry === undefined) return undefined
        if (!(entry instanceof WeakRef)) return entry
        const value = entry.deref()
        if (value === undefined) this.deleteRef(key, entry)
        return value
    }

    has(key: K) {
        return this.get(key) !== undefined
    }

    set(key: K, value: V) {
        this.refs.set(key, value)
        this.scheduleWeakening()
        return this
    }

    getOrInsert(key: K, defaultValue: V) {
        const existing = this.get(key)
        if (existing !== undefined) return existing
        this.set(key, defaultValue)
        return defaultValue
    }

    getOrInsertComputed(key: K, callback: (key: K) => V) {
        const existing = this.get(key)
        if (existing !== undefined) return existing
        const value = callback(key)
        this.set(key, value)
        return value
    }

    entries(): MapIterator<[K, V]> {
        return this.iterateEntries() as MapIterator<[K, V]>
    }

    keys(): MapIterator<K> {
        return this.iterateKeys() as MapIterator<K>
    }

    values(): MapIterator<V> {
        return this.iterateValues() as MapIterator<V>
    }

    forEach(
        callback: (value: V, key: K, map: WeakValueMap<K, V>) => void,
        thisArg?: unknown,
    ) {
        for (const [key, value] of this.entries()) {
            callback.call(thisArg, value, key, this)
        }
    }

    [Symbol.iterator]() {
        return this.entries()
    }

    private *iterateEntries(): IterableIterator<[K, V]> {
        for (const [key, entry] of this.refs) {
            if (entry instanceof WeakRef) {
                const value = entry.deref()
                if (value === undefined) {
                    this.deleteRef(key, entry)
                } else {
                    yield [key, value]
                }
            } else {
                yield [key, entry]
            }
        }
    }

    private *iterateKeys(): IterableIterator<K> {
        for (const [key] of this.entries()) yield key
    }

    private *iterateValues(): IterableIterator<V> {
        for (const [, value] of this.entries()) yield value
    }

    private scheduleWeakening() {
        if (this.weakeningScheduled) return
        this.weakeningScheduled = true
        queueMicrotask(this.weaken)
    }

    private deleteRef(key: K, ref: WeakRef<V>) {
        // Do not delete a replacement installed for the same key while an
        // iterator was suspended between dereferencing and cleanup.
        if (this.refs.get(key) !== ref) return
        this.autonomousCleanup?.release(ref)
        this.refs.delete(key)
    }
}
