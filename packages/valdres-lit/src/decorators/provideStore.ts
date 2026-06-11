import type { ReactiveElement } from "lit"
import type { Store } from "valdres"
import { StoreProvider } from "../StoreProvider"
import { assertAccessorContext } from "../lib/assertAccessorContext"

/**
 * Provide a valdres store to the element's subtree via context, mirroring
 * `@lit/context`'s `@provide`:
 *
 * ```ts
 * class App extends LitElement {
 *     @provideStore() accessor store!: Store
 * }
 * ```
 *
 * With no argument a `{ batchUpdates: true }` store is auto-created (same as
 * `StoreProvider`). An accessor initializer
 * (`@provideStore() accessor store = myStore`) or a later assignment swaps the
 * provided store; passing it to the decorator (`@provideStore(myStore)`) works
 * too.
 */
export const provideStore =
    (store?: Store) =>
    <C extends ReactiveElement>(
        _target: ClassAccessorDecoratorTarget<C, Store>,
        context: ClassAccessorDecoratorContext<C, Store>,
    ): ClassAccessorDecoratorResult<C, Store> => {
        assertAccessorContext(context, "provideStore")
        const providers = new WeakMap<C, StoreProvider>()
        context.addInitializer(function (this: C) {
            providers.set(this, new StoreProvider(this, store))
        })
        return {
            get(this: C): Store {
                return providers.get(this)!.store
            },
            set(this: C, next: Store): void {
                providers.get(this)!.setStore(next)
            },
            init(this: C, initial: Store | undefined): Store {
                // Decorator extra initializers run before accessor field
                // initializers, so the StoreProvider exists by now.
                if (initial) providers.get(this)!.setStore(initial)
                return initial as Store
            },
        }
    }
