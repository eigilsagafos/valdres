/**
 * A Map-shaped cache that keeps its values weakly.
 *
 * Atom-family keys are primitive/serialized values, so a WeakMap cannot be used
 * directly. Keeping only WeakRefs after the current job preserves a member's
 * identity for as long as a caller or store membership still retains it,
 * without making the family itself the lifetime owner of every member it has
 * ever created. Dead entries are swept lazily by lookup, iteration, and size
 * reads so finalization callbacks never add unpredictable work to unrelated
 * code.
 *
 * New values stay strong until the next microtask checkpoint, then are weakened
 * in one batch. This keeps synchronous family creation on the normal Map.set
 * path and performs weak-ref conversion in one tight loop; the ECMAScript
 * WeakRef model keeps newly dereferenced targets alive for the current job
 * either way.
 */
export class WeakValueMap<K, V extends WeakKey> {
    readonly [Symbol.toStringTag] = "Map"

    private readonly refs = new Map<K, V | WeakRef<V>>()
    private weakeningScheduled = false

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
        this.refs.clear()
    }

    delete(key: K) {
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
        queueMicrotask(() => {
            this.weakeningScheduled = false
            for (const [key, entry] of this.refs) {
                if (!(entry instanceof WeakRef)) {
                    this.refs.set(key, new WeakRef(entry))
                }
            }
        })
    }

    private deleteRef(key: K, ref: WeakRef<V>) {
        // Do not delete a replacement installed for the same key while an
        // iterator was suspended between dereferencing and cleanup.
        if (this.refs.get(key) === ref) this.refs.delete(key)
    }
}
