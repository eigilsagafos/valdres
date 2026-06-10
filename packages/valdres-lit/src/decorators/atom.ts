import type { ReactiveElement } from "lit"
import type { Atom, SetAtomValue, Store } from "valdres"
import { AtomController } from "../AtomController"
import { assertAccessorContext } from "../lib/assertAccessorContext"

/**
 * Bind a class accessor to a valdres atom (read + write), mirroring
 * `@lit/context`'s `@provide`/`@consume` decorator style:
 *
 * ```ts
 * class Counter extends LitElement {
 *     @atom(countAtom) accessor count!: number | undefined
 *     render() {
 *         return html`<button @click=${() => this.count = (this.count ?? 0) + 1}>
 *             ${this.count}
 *         </button>`
 *     }
 * }
 * ```
 *
 * The store resolves via context (nearest `StoreProvider`/`ScopeController`)
 * unless passed explicitly. Reads are `undefined` until a store is attached —
 * same contract as `AtomController.value` — and assigning before a store is
 * attached throws. Assigning `undefined` resets the atom to its default
 * (mirroring the read contract, where `undefined` means "no value").
 *
 * Don't give the accessor an initializer; the atom's default is the initial
 * value. Note that redeclaring a decorated accessor in a subclass does not
 * remove the base binding — the host still re-renders on state changes.
 */
export const atom =
    <Value>(atomDef: Atom<Value>, store?: Store) =>
    <C extends ReactiveElement>(
        _target: ClassAccessorDecoratorTarget<C, Value | undefined>,
        context: ClassAccessorDecoratorContext<C, Value | undefined>,
    ): ClassAccessorDecoratorResult<C, Value | undefined> => {
        assertAccessorContext(context, "atom")
        const controllers = new WeakMap<C, AtomController<Value>>()
        context.addInitializer(function (this: C) {
            controllers.set(this, new AtomController(this, atomDef, store))
        })
        return {
            get(this: C): Value | undefined {
                return controllers.get(this)!.value
            },
            set(this: C, value: Value | undefined): void {
                const controller = controllers.get(this)!
                if (value === undefined) controller.reset()
                else controller.set(value as SetAtomValue<Value>)
            },
            init(this: C, initial: Value | undefined): Value | undefined {
                if (initial !== undefined) {
                    console.warn(
                        `valdres-lit: the initializer on @atom accessor "${String(context.name)}" is ignored — the atom's default is the initial value.`,
                    )
                }
                return undefined
            },
        }
    }
