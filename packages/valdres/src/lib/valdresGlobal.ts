import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"

/** The shape of the `globalThis.__valdres__` single-instance slot.
 *
 *  Historically the slot held the loaded version as a bare string; it is now an
 *  object so the same slot can carry the global name registry. `version` keeps
 *  the single-instance guard in index.ts working: it is `undefined` until an
 *  instance claims the slot (set from the build-time VALDRES_VERSION), and a
 *  second instance loading throws. `registry` maps every `name`d atom and
 *  atomFamily to its object — names are global addresses, so the registry is
 *  deliberately instance-global, not per-store. */
export type ValdresGlobal = {
    version: string | undefined
    registry: Map<string, Atom<any> | AtomFamily<any>>
}

declare global {
    // The slot may hold a bare version string written by a pre-registry valdres
    // build sharing the same global scope.
    var __valdres__: ValdresGlobal | string | undefined
}

/** The `globalThis.__valdres__` slot, created on first touch. A leftover string
 *  slot (older valdres build) is upgraded in place, preserving its version so
 *  the index.ts guard still throws for this instance. `toString` keeps the
 *  pre-registry guard readable: an old build interpolating the slot into its
 *  "already loaded" error prints the version, not `[object Object]`. */
export const valdresGlobal = (): ValdresGlobal => {
    const existing = globalThis.__valdres__
    if (typeof existing === "object" && existing !== null) return existing
    const slot: ValdresGlobal = {
        version: typeof existing === "string" ? existing : undefined,
        registry: new Map(),
        toString(this: ValdresGlobal) {
            return this.version ?? "unknown"
        },
    } as ValdresGlobal
    globalThis.__valdres__ = slot
    return slot
}
