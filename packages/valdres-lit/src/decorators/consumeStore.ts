import type { ReactiveElement } from "lit"
import { ContextConsumer } from "@lit/context"
import type { Store } from "valdres"
import { valdresContext } from "../lib/valdresContext"
import { assertAccessorContext } from "../lib/assertAccessorContext"

/**
 * Consume the nearest provided valdres store, mirroring `@lit/context`'s
 * `@consume`:
 *
 * ```ts
 * class Widget extends LitElement {
 *     @consumeStore() accessor store: Store | undefined
 * }
 * ```
 *
 * Reads are `undefined` until a provider responds (same contract as
 * `ContextConsumer.value`); the host re-renders when the store arrives or is
 * swapped. The accessor is read-only.
 */
export const consumeStore =
    () =>
    <C extends ReactiveElement>(
        _target: ClassAccessorDecoratorTarget<C, Store | undefined>,
        context: ClassAccessorDecoratorContext<C, Store | undefined>,
    ): ClassAccessorDecoratorResult<C, Store | undefined> => {
        assertAccessorContext(context, "consumeStore")
        const stores = new WeakMap<C, Store>()
        context.addInitializer(function (this: C) {
            new ContextConsumer(this, {
                context: valdresContext,
                subscribe: true,
                callback: store => {
                    if (store) {
                        stores.set(this, store)
                        // Deliberate: ContextConsumer requests its own host
                        // update, but only the accessor's backing (this
                        // WeakMap) knows the value actually changed for THIS
                        // decorator application.
                        this.requestUpdate()
                    }
                },
            })
        })
        return {
            get(this: C): Store | undefined {
                return stores.get(this)
            },
            set(): void {
                throw new Error(
                    "valdres-lit: a @consumeStore accessor is read-only; the store comes from context.",
                )
            },
        }
    }
