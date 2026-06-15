import type { SetAtomValue } from "valdres"

/** The reactive box {@link fromState} returns for an atom: an assignable
 *  `.current` (so `bind:value={box.current}` and `box.current++` work), plus the
 *  updater-form `set` and `reset`. */
export interface FromStateAtom<V> {
    /** Tracked read and write. Assigning is sugar for `set(() => value)`, so a
     *  function value is stored as-is rather than treated as an updater. */
    current: V
    /** Set the atom from a value or an updater function (the `SetAtomValue`
     *  form: `box.set(c => c + 1)`). */
    set(value: SetAtomValue<V>): void
    /** Reset the atom to its default value. */
    reset(): void
}
