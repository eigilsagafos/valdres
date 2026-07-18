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
    private readonly cleanup = new FinalizationRegistry<K>((key) => {
        // A key may have been explicitly released and recreated before the old
        // member is finalized. Re-read the current ref so a stale callback
        // never removes a live replacement.
        const ref = this.refs.get(key)
        if (ref?.deref() === undefined) this.refs.delete(key)
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
        this.refs.clear()
    }

    delete(key: K) {
        return this.refs.delete(key)
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
        const ref = new WeakRef(value)
        this.refs.set(key, ref)
        // Deliberately omit an unregister token. Tokenized registration is
        // costly in JavaScriptCore, and stale callbacks are safe because
        // cleanup rechecks the current ref for this key.
        this.cleanup.register(value, key)
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
        // Do not delete a replacement installed for the same key while an
        // iterator was suspended between dereferencing and cleanup.
        if (this.refs.get(key) === ref) this.refs.delete(key)
    }
}
