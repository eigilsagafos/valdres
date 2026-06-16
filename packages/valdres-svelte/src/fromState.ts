import { createSubscriber } from "svelte/reactivity"
import {
    isAtom,
    type Atom,
    type Selector,
    type State,
    type Store,
} from "valdres"
import { getValdresContext } from "./getValdresContext"
import type { FromStateAtom } from "./types/FromStateAtom"
import type { FromStateValue } from "./types/FromStateValue"

/** Bridge a valdres atom or selector into a Svelte 5 reactive box.
 *
 * Reading `box.current` inside an effect (a template expression, `$derived`,
 * `$effect`, …) subscribes to the state and re-runs that effect when it
 * changes. For an atom the box is writable — `box.current = v`, `bind:value`,
 * `box.current++` — and also carries the read-modify-write `update(fn)` and
 * `reset()`. For a selector (or generic `State`) the box is read-only; async
 * selectors surface as `current: V | Promise<V>` (see {@link FromStateValue} /
 * {@link resourceState}).
 *
 * `store` defaults to the store from `setValdresContext`/`scope` (resolved via
 * `getValdresContext`), so it can only be omitted during component
 * initialization; pass an explicit `store` to use the box in plain `.svelte.ts`
 * module state or during SSR.
 *
 * Built on `createSubscriber`: the underlying valdres subscription is lazy and
 * shared — it starts on the first effect that reads `.current` and stops when
 * the last one is destroyed. One consequence to know: a valdres `onMount`-driven
 * atom (the `@valdres/browser-*` pattern) only bootstraps once `.current` is
 * read inside an effect, matching Svelte's own `MediaQuery` semantics. If a
 * component reads the value only from an event handler (never in the template /
 * an effect), force the subscription to start with `$effect(() => void box.current)`.
 */
export function fromState<V>(atom: Atom<V>, store?: Store): FromStateAtom<V>
export function fromState<V>(
    selector: Selector<V>,
    store?: Store,
): FromStateValue<V>
export function fromState<V>(state: State<V>, store?: Store): FromStateValue<V>
export function fromState<V>(
    state: State<V>,
    store?: Store,
): FromStateAtom<V> | FromStateValue<V> {
    const resolvedStore = store ?? getValdresContext()
    const subscribe = createSubscriber(update =>
        resolvedStore.sub(state, update),
    )

    if (isAtom(state)) {
        return {
            get current() {
                subscribe()
                return resolvedStore.get(state) as V
            },
            set current(value: V) {
                // Wrap in a thunk so a function value is stored verbatim rather
                // than hitting core's updater-function branch (setAtom.ts).
                resolvedStore.set(state, () => value)
            },
            update(updater: (current: V) => V) {
                resolvedStore.set(state, updater)
            },
            reset() {
                resolvedStore.reset(state)
            },
        }
    }

    return {
        get current() {
            subscribe()
            return resolvedStore.get(state) as V
        },
    }
}
