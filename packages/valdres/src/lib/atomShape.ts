import { equal as defaultEqual } from "./equal"
import type { Atom, CacheMeta } from "../types/Atom"
import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomOnInit } from "../types/AtomOnInit"
import type { AtomOnMount } from "../types/AtomOnMount"
import type { AtomOnSet } from "../types/AtomOnSet"
import type { AtomOptions } from "../types/AtomOptions"
import type { GlobalAtom } from "../types/GlobalAtom"
import type { GlobalAtomGetSelfFunc } from "../types/GlobalAtomGetSelfFunc"
import type { GlobalAtomResetSelfFunc } from "../types/GlobalAtomResetSelfFunc"
import type { GlobalAtomSetSelfFunc } from "../types/GlobalAtomSetSelfFunc"
import type { StoreData } from "../types/StoreData"

// Atom construction used to spread caller options into a plain literal —
// `{ equal, ...options, defaultValue }` — so every option combination
// produced a distinct hidden class. The core's hot reads (atom.equal,
// atom.maxAge, atom.onMount, …) turned megamorphic against atoms in the
// wild and V8/JSC couldn't inline them.
//
// `createAtom` writes every Atom field as a single object literal in a
// fixed order. V8 hangs an Object Literal Boilerplate off the call site
// and clones it on every call, so allocation cost stays close to the
// pre-refactor literal while shape is now stable regardless of which
// options were passed.
//
// Field order is load-bearing. Reordering invalidates the boilerplate
// and the inline caches the rest of the core depends on.

const EMPTY_OPTIONS: AtomOptions<any> = {}

export const createAtom = <V>(
    defaultValue: AtomDefaultValue<V> | undefined,
    options: AtomOptions<V> | undefined,
    name: string | undefined,
    family: AtomFamily<any, any> | undefined,
    familyArgs: any,
    familyArgsStringified: string | number | boolean | undefined,
): Atom<V> => {
    const o = options || EMPTY_OPTIONS
    return {
        equal: o.equal || defaultEqual,
        defaultValue,
        name,
        onInit: undefined,
        onSet: o.onSet,
        onMount: o.onMount,
        maxAge: o.maxAge,
        mutable: o.mutable,
        staleWhileRevalidate: o.staleWhileRevalidate,
        staleIfError: o.staleIfError,
        __cacheMeta: undefined,
        __cacheMetaSelector: undefined,
        family,
        familyArgs,
        familyArgsStringified,
    } as Atom<V>
}

// Global atoms get a separate hidden class because they expose extra
// machinery (setSelf, stores, …). isGlobalAtom() still discriminates via
// hasOwn(state, "stores"), so non-global atoms never declare "stores".
// All inherited atom fields appear first in the same order as createAtom
// so reads on the shared subset (equal, defaultValue, maxAge, …) hit the
// same IC slot across both shapes.
export const createGlobalAtom = <V>(
    defaultValue: AtomDefaultValue<V> | undefined,
    options: AtomOptions<V>,
    onInit: AtomOnInit<V>,
    onSet: AtomOnSet<V>,
    onMount: AtomOnMount | undefined,
    setSelf: GlobalAtomSetSelfFunc<V>,
    getSelf: GlobalAtomGetSelfFunc<V>,
    resetSelf: GlobalAtomResetSelfFunc,
    detach: (storeData: StoreData) => void,
    stores: Set<StoreData>,
): GlobalAtom<V> => {
    return {
        equal: options.equal || defaultEqual,
        defaultValue,
        name: options.name,
        onInit,
        onSet,
        onMount,
        maxAge: options.maxAge,
        mutable: options.mutable,
        staleWhileRevalidate: options.staleWhileRevalidate,
        staleIfError: options.staleIfError,
        __cacheMeta: undefined,
        __cacheMetaSelector: undefined,
        family: undefined,
        familyArgs: undefined,
        familyArgsStringified: undefined,
        setSelf,
        resetSelf,
        getSelf,
        detach,
        stores,
        maxAgeInterval: undefined,
    } as GlobalAtom<V>
}

// Plain-object atom used by cacheMeta plumbing. Created on demand from the
// hot subscribe path — kept as a minimal 2-field literal so it shares the
// same hidden class as no-options user atoms (and so we don't pay the
// 15-slot allocation here, where every maxAge timer triggers one).
export const createCacheMetaAtom = (): Atom<CacheMeta | null> =>
    ({ equal: defaultEqual, defaultValue: null }) as Atom<CacheMeta | null>
