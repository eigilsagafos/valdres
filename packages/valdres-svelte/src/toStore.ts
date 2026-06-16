import type { Readable, Writable } from "svelte/store"
import {
    isAtom,
    type Atom,
    type Selector,
    type State,
    type Store,
} from "valdres"
import { getValdresContext } from "./getValdresContext"

/** Bridge a valdres atom or selector into Svelte's store contract — for
 *  `$`-prefix auto-subscription (`$count$`) and `bind:value={$count$}`.
 *
 * An atom yields a `Writable` (`subscribe`/`set`/`update`, all delegating to the
 * store); a selector (or generic `State`) yields a read-only `Readable`. `store`
 * defaults to the context store (`getValdresContext`), so it can be omitted
 * during component initialization — consistent with {@link fromState}. Prefer
 * `fromState` for new code; `toStore` exists for `$`-syntax interop.
 */
export function toStore<V>(atom: Atom<V>, store?: Store): Writable<V>
export function toStore<V>(selector: Selector<V>, store?: Store): Readable<V>
export function toStore<V>(state: State<V>, store?: Store): Readable<V>
export function toStore<V>(
    state: State<V>,
    store?: Store,
): Writable<V> | Readable<V> {
    const resolvedStore = store ?? getValdresContext()
    const subscribe = (run: (value: V) => void) => {
        run(resolvedStore.get(state) as V)
        return resolvedStore.sub(state, () =>
            run(resolvedStore.get(state) as V),
        )
    }

    if (isAtom(state)) {
        return {
            subscribe,
            // Wrap in a thunk so a function value isn't read as an updater.
            set: (value: V) => resolvedStore.set(state, () => value),
            update: (updater: (value: V) => V) =>
                resolvedStore.set(state, updater),
        }
    }

    return { subscribe }
}
