import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"

export type GlobalAtomFamilyRegistration = {
    family: AtomFamily<any, any>
    usesKeyOf: boolean
    keyOfArity: number | undefined
}

export type ValdresRuntime = {
    globalStore?: {
        store: Store
        data: StoreData
    }
    globalAtomFamilies: Map<string, GlobalAtomFamilyRegistration>
    /** Semantic side tables keyed by StoreData must follow an adopted runtime;
     * otherwise a later copy cannot retire work created by the first copy. */
    asyncAtomCoordinators: WeakMap<
        StoreData,
        WeakMap<Atom<any>, { promise: PromiseLike<any> }>
    >
    disposedStoreTokens: WeakMap<StoreData, object>
    disposedErrorTokens: WeakMap<Error, object>
    disposedStorePending: Set<WeakKey>
    /** Shared constructor keeps the selector hot path on native instanceof. */
    suspendErrorClass?: new (
        promise: Promise<any>,
    ) => Error & { promise: Promise<any> }
    /** Generated IDs are diagnostic identities and stay unique process-wide. */
    nextStoreId: number
    namedStateIndexes: WeakMap<
        StoreData,
        Map<Atom<any> | AtomFamily<any>, string>
    >
    registeredNames: WeakMap<WeakKey, string>
}

/** The shape of the `globalThis.__valdres__` single-instance slot.
 *
 *  Historically the slot held the loaded version as a bare string; it is now an
 *  object so the same slot can carry the global name registry. `version` keeps
 *  the single-instance guard in index.ts working: it is `undefined` until an
 *  instance claims the slot (set from the build-time VALDRES_VERSION).
 *  Same-version instances adopt `runtime`; incompatible or unknown versions
 *  throw. `buildVariant` identifies whether the first instance came from the
 *  default, development, or unbuilt source artifact. `registry` maps every
 *  `name`d atom and atomFamily to its object — names are global addresses, so
 *  the registry is deliberately instance-global, not per-store. */
export type ValdresGlobal = {
    adoptable: boolean
    loaded: boolean
    version: string | undefined
    buildVariant?: string
    registry: Map<string, Atom<any> | AtomFamily<any>>
    runtime: ValdresRuntime
}

declare global {
    // The slot may hold a bare version string written by a pre-registry valdres
    // build sharing the same global scope.
    var __valdres__: ValdresGlobal | string | undefined
}

const createRuntime = (): ValdresRuntime => ({
    globalAtomFamilies: new Map(),
    asyncAtomCoordinators: new WeakMap(),
    disposedStoreTokens: new WeakMap(),
    disposedErrorTokens: new WeakMap(),
    disposedStorePending: new Set(),
    nextStoreId: 0,
    namedStateIndexes: new WeakMap(),
    registeredNames: new WeakMap(),
})

const slotToString = function (this: ValdresGlobal) {
    return this.version ?? "unknown"
}

/** The `globalThis.__valdres__` slot, created on first touch. Older string and
 *  registry-only slots are upgraded in place. A bare string represents an
 *  already-loaded legacy copy; an object without an explicit `loaded` marker
 *  is considered claimed when it already carries a version or build variant.
 *  `toString` keeps legacy guards readable by rendering `unknown` rather than
 *  `[object Object]` for an unversioned source build. */
export const valdresGlobal = (): ValdresGlobal => {
    const existing = globalThis.__valdres__
    if (typeof existing === "object" && existing !== null) {
        const slot = existing as ValdresGlobal
        slot.loaded ??=
            slot.version !== undefined || slot.buildVariant !== undefined
        const hadSharedRuntime = slot.runtime !== undefined
        slot.adoptable ??= !slot.loaded || hadSharedRuntime
        slot.registry ??= new Map()
        slot.runtime ??= createRuntime()
        slot.runtime.globalAtomFamilies ??= new Map()
        slot.runtime.asyncAtomCoordinators ??= new WeakMap()
        slot.runtime.disposedStoreTokens ??= new WeakMap()
        slot.runtime.disposedErrorTokens ??= new WeakMap()
        slot.runtime.disposedStorePending ??= new Set()
        slot.runtime.nextStoreId ??= 0
        slot.runtime.namedStateIndexes ??= new WeakMap()
        slot.runtime.registeredNames ??= new WeakMap()
        if (!Object.hasOwn(slot, "toString")) {
            Object.defineProperty(slot, "toString", { value: slotToString })
        }
        return slot
    }
    const slot: ValdresGlobal = {
        adoptable: typeof existing !== "string",
        loaded: typeof existing === "string",
        version: typeof existing === "string" ? existing : undefined,
        registry: new Map(),
        runtime: createRuntime(),
        toString: slotToString,
    } as ValdresGlobal
    globalThis.__valdres__ = slot
    return slot
}
