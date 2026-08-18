import { globalAtom } from "valdres"
import type { GlobalAtom } from "valdres"

// Only `GlobalAtom`s propagate through `globalStore`, which is where
// setupInvalidation subscribes. Storing a non-global atom here would silently
// never trigger invalidation, so the type rejects them at compile time.
export const invalidateOnAtom = globalAtom<GlobalAtom<unknown>[]>([], {
    name: "@valdres/bandwidth/invalidateOn",
    // `mutable: true` exempts this value from the dev-mode deepFreeze that
    // would otherwise recurse into the array and freeze the atoms inside —
    // breaking their internal refCount/listener mutations.
    mutable: true,
})
