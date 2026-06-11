import { Signal } from "signal-polyfill"
import {
    isAtom,
    isPromiseLike,
    type Atom,
    type Selector,
    type SetAtomValue,
    type State,
    type Store,
} from "valdres"

/** A `Signal.State` whose `set` is disabled — what `toSignal` returns for
 *  selectors, where writes have no meaning. */
export type ReadonlySignal<Value> = Omit<Signal.State<Value>, "set">

/**
 * Mirror a valdres atom or selector as a TC39 `Signal.State` (from
 * `signal-polyfill`) — the same signal implementation `@lit-labs/signals`
 * watches, so valdres state participates in `SignalWatcher` auto-tracking:
 *
 * ```ts
 * const count = toSignal(countAtom, store)
 *
 * class Counter extends SignalWatcher(LitElement) {
 *     render() {
 *         return html`${count.get()}` // auto-tracked, re-renders on change
 *     }
 * }
 * ```
 *
 * Create the signal once (module scope) and reuse it — each call creates an
 * independent mirror with its own store subscription when watched.
 *
 * The store subscription is lazy: it starts when the signal gains its first
 * watcher and stops when the last one leaves (`Signal.subtle.watched` /
 * `unwatched`), so an unobserved mirror holds no store subscription. Reads
 * while unwatched are not mirrored; after a watch begins the signal refreshes
 * on the next microtask, so the first synchronous read after watching may
 * still be stale (at most one corrective re-render in `SignalWatcher` hosts).
 *
 * For atoms, `signal.set(v)` writes through to the store (valdres updater
 * functions included — `sig.set(c => c + 1)` works). For selectors, `set` is
 * absent from the type and throws at runtime — write to the underlying atoms
 * instead.
 *
 * Async state: pending at creation mirrors as `undefined`; later pending
 * transitions keep the previous value until the new promise resolves.
 * Rejections keep the last mirrored value.
 */
export function toSignal<Value>(
    state: Atom<Value>,
    store: Store,
): Signal.State<Value | undefined>
export function toSignal<Value>(
    state: Selector<Value>,
    store: Store,
): ReadonlySignal<Value | undefined>
export function toSignal<Value>(
    state: State<Value>,
    store: Store,
): Signal.State<Value | undefined> {
    let unsubscribe: (() => void) | undefined
    // Generation counter: only the latest in-flight async resolution may
    // commit. (Don't compare against store.get() — valdres swaps the stored
    // promise for its resolved value, so equality fails exactly when the
    // write is legitimate.)
    let epoch = 0

    const initial = store.get(state)
    const signal = new Signal.State<Value | undefined>(
        isPromiseLike(initial) ? undefined : (initial as Value),
        {
            [Signal.subtle.watched]: () => {
                unsubscribe = store.sub(
                    state,
                    () => mirror(store.get(state)),
                    false,
                )
                // `watched` fires inside the watcher's tracking context, where
                // synchronous writes are forbidden — defer the staleness
                // refresh (reads while unwatched aren't mirrored).
                queueMicrotask(() => {
                    if (unsubscribe) mirror(store.get(state))
                })
            },
            [Signal.subtle.unwatched]: () => {
                unsubscribe?.()
                unsubscribe = undefined
            },
        },
    )

    // Internal writes bypass the public .set override below.
    const write = Signal.State.prototype.set.bind(signal) as (
        v: Value | undefined,
    ) => void
    const mirror = (next: unknown) => {
        const e = ++epoch
        if (isPromiseLike(next)) {
            Promise.resolve(next).then(
                v => {
                    if (e === epoch) write(v as Value)
                },
                () => {
                    // Rejections keep the last mirrored value; valdres reverts
                    // the atom itself and re-notifies subscribers if it lands
                    // on a different value.
                },
            )
        } else {
            write(next as Value)
        }
    }
    if (isPromiseLike(initial)) mirror(initial)

    if (isAtom(state)) {
        signal.set = (v: SetAtomValue<Value | undefined>) => {
            store.set(state as Atom<Value>, v as SetAtomValue<Value>)
            // Reflect the write synchronously (batched stores notify later).
            mirror(store.get(state))
        }
    } else {
        signal.set = () => {
            throw new Error(
                "valdres-lit: toSignal(selector) is read-only — write to the underlying atoms instead.",
            )
        }
    }
    return signal
}
