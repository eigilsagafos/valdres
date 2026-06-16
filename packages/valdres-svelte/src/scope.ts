import { getContext, onDestroy, setContext } from "svelte"
import { setAtomPairs, type InitializeCallback, type Store } from "valdres"
import { VALDRES_CONTEXT_KEY, type ValdresContext } from "./lib/storeContext"
import { getValdresContext } from "./getValdresContext"

/** Options for {@link scope}. */
export interface ScopeOptions {
    /** Seed the scoped store inside a transaction when the scope is created. */
    initialize?: InitializeCallback
}

const generateId = () => (Math.random() + 1).toString(36).substring(7)

/** Create a scoped store under the current context store and expose it to
 *  descendants — a subtree with its own overlay over the parent's atoms.
 *
 *  Reuses an existing scope of the same `scopeId` if one is already in the tree;
 *  otherwise creates it and, on the owning component's destroy, detaches it.
 *  `initialize` (when the scope is set up here) seeds the scoped store inside a
 *  transaction. Reads via {@link fromState}/{@link toStore} in descendants
 *  resolve to this scoped store.
 *
 * ```svelte
 * <script lang="ts">
 *     import { scope } from "valdres-svelte"
 *     scope("checkout", { initialize: () => [[countAtom, 100]] })
 * </script>
 * ```
 */
export function scope(
    scopeId: string = generateId(),
    options?: ScopeOptions,
): Store {
    const parentStore = getValdresContext()
    const scopeCreated = !parentStore.data.scopes?.has(scopeId)
    const scopedStore = parentStore.scope(scopeId)

    if (options?.initialize) {
        scopedStore.txn(txn => {
            const pairs = options.initialize!(txn)
            if (pairs) setAtomPairs(txn.set, pairs)
        })
    }

    const parentCtx = getContext<ValdresContext | undefined>(
        VALDRES_CONTEXT_KEY,
    )
    const ctx: ValdresContext = {
        current: scopedStore,
        stores: {
            ...(parentCtx?.stores ?? {}),
            [parentStore.data.id]: parentStore,
            [scopedStore.data.id]: scopedStore,
        },
    }
    setContext(VALDRES_CONTEXT_KEY, ctx)

    onDestroy(() => scopedStore.detach(scopeCreated))
    return scopedStore
}
