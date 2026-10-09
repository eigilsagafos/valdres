import type { Atom as ValdresAtom, ExternalAtom, State } from "valdres"

/** The Valdres definitions behind one Jotai atom config. Store-independent. */
export interface AtomNode {
    readonly config: AnyAtomConfig
    /** What a read of the config returns (encoded). */
    readonly state: State<unknown>
    /** The atom's own value when the config has `init`. */
    readonly value: ValdresAtom<unknown> | undefined
    /** `state` reads `value` and nothing else (besides `lifecycle`). */
    readonly isPrimitive: boolean
    /** Per-Store mount sentinel for writable configs that may have onMount. */
    readonly lifecycle: ExternalAtom<undefined> | undefined
}

export interface AnyAtomConfig {
    readonly read: (get: unknown, options: unknown) => unknown
    readonly write?: (get: unknown, set: unknown, ...args: unknown[]) => unknown
    readonly init?: unknown
    readonly onMount?: unknown
    readonly INTERNAL_onInit?: unknown
    debugLabel?: string
}

export const nodes = new WeakMap<object, AtomNode>()
