import { createSubscriber } from "svelte/reactivity"
import {
    isPromiseLike,
    type Selector,
    type State,
    type Store,
} from "valdres"
import { getValdresContext } from "./getValdresContext"
import type { ResourceState } from "./types/ResourceState"

/** Consume a (possibly async) selector as a `{ current, loading, error }` box.
 *
 * Core erases asyncness, so `fromState(sel).current` may be `V | Promise<V>`;
 * `resourceState` does the `isPromiseLike` detection for you and tracks the
 * promise's settlement. While pending, `loading` is `true` and `current` is
 * `undefined`; on resolve, `current` holds the value; on reject, `error` holds
 * the reason. A dependency change re-enters the pending state.
 *
 * Reactive via `createSubscriber` (like {@link fromState}), so read the fields
 * inside an effect/template to track them. `store` defaults to the context
 * store. For the plain-promise idiom, `{#await fromState(sel).current then v}`
 * also works.
 */
export function resourceState<V>(
    selector: Selector<V> | State<V>,
    store?: Store,
): ResourceState<V> {
    const resolvedStore = store ?? getValdresContext()

    let value: V | undefined
    let loading = false
    let error: unknown = undefined
    // The promise currently being awaited — also the guard that drops settlement
    // callbacks from a superseded evaluation. Read the selector value only here
    // (on subscription start and genuine dependency changes), never in the
    // getters: core re-evaluates an async selector on every `get` and issues a
    // fresh promise, so re-reading per access would oscillate `loading`.
    let tracked: Promise<V> | undefined
    let notify: (() => void) | undefined

    const refresh = () => {
        const next: unknown = resolvedStore.get(selector)
        if (isPromiseLike<V>(next)) {
            if (next === tracked) return
            tracked = next
            value = undefined
            loading = true
            error = undefined
            next.then(
                resolved => {
                    if (tracked !== next) return
                    value = resolved
                    loading = false
                    error = undefined
                    notify?.()
                },
                reason => {
                    if (tracked !== next) return
                    value = undefined
                    loading = false
                    error = reason
                    notify?.()
                },
            )
        } else {
            tracked = undefined
            value = next as V
            loading = false
            error = undefined
        }
    }

    const subscribe = createSubscriber(update => {
        notify = update
        refresh()
        const unsub = resolvedStore.sub(selector, () => {
            refresh()
            update()
        })
        return () => {
            notify = undefined
            unsub()
        }
    })

    return {
        get current() {
            subscribe()
            return value
        },
        get loading() {
            subscribe()
            return loading
        },
        get error() {
            subscribe()
            return error
        },
    }
}
