export type UnnamedMode = "track" | "ignore"

export interface NameRegistry {
    /**
     * The label for an atom: its declared `name`, or a synthetic
     * `unnamed_atom_N` in `"track"` mode. `null` for an unnamed atom when the
     * mode is `"ignore"`. Registers the name → atom mapping so time-travel can
     * resolve it back.
     */
    nameFor(atom: { name?: string }): string | null
    /** Reverse lookup (name → atom) used by time-travel restore. */
    resolve(name: string): object | undefined
}

/**
 * Per-connection atom ↔ name map. valdres core has no name registry, so the
 * adapter builds its own as atoms flow through `store.onChange`: named atoms map
 * by their `name`, unnamed ones get a synthetic `unnamed_atom_N` (in `"track"`
 * mode) assigned in encounter order. Synthetic labels are stable for the
 * session but NOT across reloads, so the first one logs a one-time hint. The
 * reverse map holds atoms strongly only for the connection's lifetime (dropped
 * on `disconnect()`).
 */
export const createNameRegistry = (mode: UnnamedMode): NameRegistry => {
    const reverse = new Map<string, object>()
    const synthetic = new WeakMap<object, string>()
    let counter = 0
    let hintShown = false
    let collisionWarned = false

    return {
        nameFor(atom) {
            const declared = atom.name
            if (declared) {
                const existing = reverse.get(declared)
                if (existing && existing !== atom && !collisionWarned) {
                    collisionWarned = true
                    console.warn(
                        `[@valdres/redux-devtools] Two different atoms share the name "${declared}". Time-travel may restore the wrong one — give them distinct names.`,
                    )
                }
                reverse.set(declared, atom)
                return declared
            }
            const cached = synthetic.get(atom)
            if (cached) return cached
            if (mode === "ignore") return null
            const name = `unnamed_atom_${++counter}`
            synthetic.set(atom, name)
            reverse.set(name, atom)
            if (!hintShown) {
                hintShown = true
                console.warn(
                    '[@valdres/redux-devtools] Some atoms have no `name` and are tracked as `unnamed_atom_N`. These labels are not stable across reloads — add { name: "…" } to the atoms you want meaningful, restorable time-travel for.',
                )
            }
            return name
        },
        resolve(name) {
            return reverse.get(name)
        },
    }
}
