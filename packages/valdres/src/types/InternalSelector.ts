import type { AtomOnMount } from "./AtomOnMount"
import type { Selector } from "./Selector"

/** Engine-only selector fields deliberately absent from the public type. */
export type InternalSelector<
    Value extends any = any,
    FamilyArgs extends [any, ...any[]] = [any, ...any[]],
> = Selector<Value, FamilyArgs> & {
    /** Compat-layer override for onMount, set by adapters that need to wrap the
     *  user-supplied onMount signature. */
    __valdresOnMount?: AtomOnMount
    /** Marks selectors created by valdres itself (e.g. the cacheMeta selector).
     *  Excluded by `store.onChange` and `store.snapshot` so dev tools do not
     *  surface implementation-detail churn. */
    __valdresInternal?: boolean
}
