import * as Vue from "vue"
import { inject, onScopeDispose, provide } from "vue"
import { setAtomPairs, type InitializeCallback, type Store } from "valdres"
import { ValdresKey } from "./lib/storeKey"

/** Options for {@link provideValdresScope}. */
export interface ProvideValdresScopeOptions {
    /** Identifier for the scope. Reuses an existing scope of the same id in the
     *  ancestor chain; otherwise a new one is created and detached on unmount.
     *  Defaults to a stable, SSR-safe `useId()` (falling back to a random id on
     *  Vue < 3.5). NOT reactive — a dynamic scope id needs `:key` on the
     *  providing component to force a remount. */
    scopeId?: string
    /** Seed the scoped store inside a transaction when the scope is created. */
    initialize?: InitializeCallback
}

// Vue 3.5+ ships `useId()` for SSR-stable ids. Feature-detect via the namespace
// import so the package can keep a `vue >=3.3` peer floor; older Vue falls back
// to a random id (not SSR-stable, but scopes rarely cross the SSR boundary).
const useIdFn: (() => string) | undefined =
    typeof (Vue as { useId?: unknown }).useId === "function"
        ? (Vue as { useId: () => string }).useId
        : undefined

const generateId = () => (Math.random() + 1).toString(36).substring(7)

/** [Docs Reference](https://valdres.dev/vue/provideValdresScope)
 *
 * Scope the current component's subtree to a child store and expose it to
 * descendants — the composable form of {@link ValdresScope}, so a
 * `<script setup>` component can scope itself. Returns the scoped store.
 *
 * ```vue
 * <script setup lang="ts">
 * import { provideValdresScope } from "valdres-vue"
 * const scoped = provideValdresScope({ initialize: txn => txn.set(countAtom, 100) })
 * </script>
 * ```
 *
 * Reuses an existing scope of the same `scopeId` in the ancestor chain;
 * otherwise creates one and detaches it on unmount. The default id is `useId()`
 * (SSR-stable on Vue 3.5+), computed here in the composable body.
 *
 * **scopeId is not reactive.** Vue captures provided context once per
 * descendant at its setup, so re-scoping a live tree would silently fail to
 * propagate — change the id with `:key="scopeId"` on the providing component to
 * force a remount. In dev, changing it without a remount logs a warning.
 *
 * **Reading scoped state in the same component.** Vue's inject never sees the
 * component's own provides, so this component's other composables still resolve
 * the *parent* store — pass the returned store explicitly to read scoped state
 * here: `useValue(filterAtom, scoped)`.
 */
export const provideValdresScope = (
    options: ProvideValdresScopeOptions = {},
): Store => {
    const scopeId =
        options.scopeId ?? (useIdFn ? useIdFn() : generateId())

    const parentCtx = inject(ValdresKey)
    if (!parentCtx) {
        throw new Error(
            "valdres-vue: No valdres store provided. provideValdresScope() must " +
                "run under createValdres() or another scope.",
        )
    }

    const scopeCreated = !parentCtx.current.data.scopes?.has(scopeId)
    const scopedStore = parentCtx.current.scope(scopeId)

    if (options.initialize) {
        scopedStore.txn(txn => {
            const pairs = options.initialize!(txn)
            if (pairs) setAtomPairs(txn.set, pairs)
        })
    }

    provide(ValdresKey, {
        current: scopedStore,
        stores: {
            ...parentCtx.stores,
            [parentCtx.current.data.id]: parentCtx.current,
            [scopedStore.data.id]: scopedStore,
        },
    })

    onScopeDispose(() => {
        scopedStore?.detach?.(scopeCreated)
    })

    return scopedStore
}
