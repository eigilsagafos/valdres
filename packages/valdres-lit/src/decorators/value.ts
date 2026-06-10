import type { ReactiveElement } from "lit"
import type { State, Store } from "valdres"
import { ValueController } from "../ValueController"
import { assertAccessorContext } from "../lib/assertAccessorContext"

/**
 * Bind a class accessor to any valdres state (atom or selector), read-only:
 *
 * ```ts
 * class Price extends LitElement {
 *     @value(grandTotalSelector) accessor total!: number | undefined
 * }
 * ```
 *
 * The store resolves via context unless passed explicitly. Reads are
 * `undefined` while no store is attached or an initially-pending async state
 * hasn't resolved. Don't give the accessor an initializer. Redeclaring a
 * decorated accessor in a subclass does not remove the base binding.
 */
export const value =
    <Value>(state: State<Value>, store?: Store) =>
    <C extends ReactiveElement>(
        _target: ClassAccessorDecoratorTarget<C, Value | undefined>,
        context: ClassAccessorDecoratorContext<C, Value | undefined>,
    ): ClassAccessorDecoratorResult<C, Value | undefined> => {
        assertAccessorContext(context, "value")
        const controllers = new WeakMap<C, ValueController<Value>>()
        context.addInitializer(function (this: C) {
            controllers.set(this, new ValueController(this, state, store))
        })
        return {
            get(this: C): Value | undefined {
                return controllers.get(this)!.value
            },
            set(): void {
                throw new Error(
                    "valdres-lit: a @value accessor is read-only. Use @atom for writable state.",
                )
            },
            init(this: C, initial: Value | undefined): Value | undefined {
                if (initial !== undefined) {
                    console.warn(
                        `valdres-lit: the initializer on @value accessor "${String(context.name)}" is ignored — the value derives from the store.`,
                    )
                }
                return undefined
            },
        }
    }
