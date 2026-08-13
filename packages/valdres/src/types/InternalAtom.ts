import type { Atom, CacheMeta } from "./Atom"
import type { AtomOnInit } from "./AtomOnInit"
import type { AtomOnMount } from "./AtomOnMount"
import type { InternalSelector } from "./InternalSelector"

/** Engine-only atom fields that are deliberately absent from the public type. */
export type InternalAtom<Value = unknown> = Atom<Value> & {
    onInit?: AtomOnInit<Value>
    /** Compat-layer override for onMount, set by adapters that need to wrap the
     *  user-supplied onMount signature. */
    __valdresOnMount?: AtomOnMount
    __cacheMeta?: InternalAtom<CacheMeta | null>
    __cacheMetaSelector?: InternalSelector<CacheMeta | null>
    /** Marks atoms created by valdres itself (e.g. the cacheMeta atom backing
     *  maxAge/stale-while-revalidate). These propagate to subscribers like any
     *  atom, so `store.onChange` excludes them to keep dev tools free of
     *  implementation-detail churn on every revalidation tick. */
    __valdresInternal?: boolean
}
