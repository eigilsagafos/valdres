/**
 * A Map-shaped cache whose values do not become lifetime owners.
 *
 * index() terms are primitive/serialized keys, so WeakMap cannot be used
 * directly. WeakRef preserves selector identity while a caller or live store
 * dependency graph still owns the selector; FinalizationRegistry removes the
 * primitive key after that selector is collected. Reads and observable
 * size/iteration also sweep dead entries, so correctness never depends on
 * finalizer timing.
 *
 * This is intentionally separate from WeakValueMap. That atom-family hot-path
 * cache batches WeakRef creation and sweeps keys only when observed so it never
 * schedules finalizer work. One-off index terms may never be looked up again,
 * so their primitive keys need autonomous cleanup instead.
 */
export class WeakSelectorCache<
    K extends string | number | boolean | bigint,
    V extends object,
> {
    readonly [Symbol.toStringTag] = "Map"

    private readonly refs = new Map<K, WeakRef<V>>()
    private readonly finalizer = new FinalizationRegistry<{
        key: K
        ref: WeakRef<V>
    }>(({ key, ref }) => {
        if (this.refs.get(key) === ref) this.refs.delete(key)
    })

    get size() {
        this.sweep()
        return this.refs.size
    }

    clear() {
        for (const ref of this.refs.values()) this.finalizer.unregister(ref)
        this.refs.clear()
    }

    delete(key: K) {
        const ref = this.refs.get(key)
        if (ref === undefined) return false
        this.finalizer.unregister(ref)
        return this.refs.delete(key)
    }

    get(key: K): V | undefined {
        const ref = this.refs.get(key)
        if (ref === undefined) return undefined
        const value = ref.deref()
        if (value === undefined) this.deleteRef(key, ref)
        return value
    }

    has(key: K) {
        return this.get(key) !== undefined
    }

    set(key: K, value: V) {
        const previous = this.refs.get(key)
        if (previous !== undefined) this.finalizer.unregister(previous)
        const ref = new WeakRef(value)
        this.refs.set(key, ref)
        this.finalizer.register(value, { key, ref }, ref)
        return this
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
        callback: (value: V, key: K, map: WeakSelectorCache<K, V>) => void,
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

    private sweep() {
        for (const [key, ref] of this.refs) {
            if (ref.deref() === undefined) this.deleteRef(key, ref)
        }
    }

    private deleteRef(key: K, ref: WeakRef<V>) {
        // Do not delete a replacement installed for the same key while an
        // iterator was suspended between dereferencing and cleanup.
        if (this.refs.get(key) !== ref) return
        this.finalizer.unregister(ref)
        this.refs.delete(key)
    }
}
