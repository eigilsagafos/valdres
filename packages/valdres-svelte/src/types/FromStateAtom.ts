/** The reactive box {@link fromState} returns for an atom: an assignable
 *  `.current` (so `bind:value={box.current}` and `box.current++` work), plus an
 *  updater-form `update` and `reset`. */
export interface FromStateAtom<V> {
    /** Tracked read and write. Assigning is sugar for setting the value, so a
     *  function value is stored as-is rather than treated as an updater. */
    current: V
    /** Update the atom from its current value — the read-modify-write form
     *  (`box.update(c => c + 1)`). For a plain set, assign `box.current = value`. */
    update(updater: (current: V) => V): void
    /** Reset the atom to its default value. */
    reset(): void
}
