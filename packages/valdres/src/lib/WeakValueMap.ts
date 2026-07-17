/**
 * A Map-shaped cache that keeps its values weakly.
 *
 * Atom-family keys are primitive/serialized values, so a WeakMap cannot be used
 * directly. Keeping WeakRefs as the values preserves a member's identity for as
 * long as a caller or store membership still retains it, without making the
 * family itself the lifetime owner of every member it has ever created.
 */
export class WeakValueMap<K, V extends WeakKey> {
    readonly [Symbol.toStringTag] = "Map"

    private readonly refs = new Map<K, WeakRef<V>>()
    private readonly cleanup = new FinalizationRegistry<{
        key: K
        ref: WeakRef<V>
    }>(({ key, ref }) => {
        // A key may have been explicitly released and recreated before the old
        // member is finalized. Only remove the entry if it still points at the
        // finalized member's WeakRef.
        if (this.refs.get(key) === ref) this.refs.delete(key)
    })

    get size() {
        // Finalization callbacks are deliberately eventual. Sweep here so the
        // observable Map surface never counts entries whose values are gone.
        for (const [key, ref] of this.refs) {
            if (ref.deref() === undefined) this.deleteRef(key, ref)
        }
        return this.refs.size
    }

    clear() {
        for (const ref of this.refs.values()) this.cleanup.unregister(ref)
        this.refs.clear()
    }

    delete(key: K) {
        const ref = this.refs.get(key)
        if (!ref) return false
        this.deleteRef(key, ref)
        return true
    }

    get(key: K): V | undefined {
        const ref = this.refs.get(key)
        if (!ref) return undefined
        const value = ref.deref()
        if (value === undefined) this.deleteRef(key, ref)
        return value
    }

    has(key: K) {
        return this.get(key) !== undefined
    }

    set(key: K, value: V) {
        const previous = this.refs.get(key)
        if (previous) this.cleanup.unregister(previous)

        const ref = new WeakRef(value)
        this.refs.set(key, ref)
        this.cleanup.register(value, { key, ref }, ref)
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
        for (const [key, ref] of this.refs) {
            const value = ref.deref()
            if (value === undefined) {
                this.deleteRef(key, ref)
            } else {
                yield [key, value]
            }
        }
    }

    private *iterateKeys(): IterableIterator<K> {
        for (const [key] of this.entries()) yield key
    }

    private *iterateValues(): IterableIterator<V> {
        for (const [, value] of this.entries()) yield value
    }

    private deleteRef(key: K, ref: WeakRef<V>) {
        this.cleanup.unregister(ref)
        // Do not delete a replacement installed for the same key while an
        // iterator was suspended between dereferencing and cleanup.
        if (this.refs.get(key) === ref) this.refs.delete(key)
    }
}
