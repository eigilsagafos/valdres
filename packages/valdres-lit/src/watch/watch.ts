import { noChange } from "lit"
import {
    AsyncDirective,
    directive,
    type DirectiveParameters,
    type Part,
} from "lit/async-directive.js"
import { ContextEvent } from "@lit/context"
import { isPromiseLike, type State, type Store } from "valdres"
import { valdresContext } from "../lib/valdresContext"
import { isServer } from "../lib/isServer"

/**
 * Bind one template position to a valdres atom or selector. Unlike a
 * controller, an update re-renders only this binding via `setValue()` — the
 * host's render() never re-runs:
 *
 * ```ts
 * render() {
 *     return html`<span>${watch(countAtom)}</span>`
 * }
 * ```
 *
 * The store resolves via context from the rendering host (nearest
 * `StoreProvider`/`ScopeController`); resolution is retried on every host
 * render and on reconnect until a provider answers. Pass a store explicitly to
 * override: `watch(countAtom, store)`.
 *
 * Async state: an initially-pending binding renders nothing; once a value has
 * been committed, later pending transitions keep the previous value until the
 * new promise resolves. Rejections keep the last committed value (use
 * `ValueController.status`/`.error` for explicit loading/error UI).
 *
 * Subscriptions pause on disconnect and resume — with a fresh context
 * resolution and a fresh read — on reconnect.
 */
class WatchDirective extends AsyncDirective {
    #state?: State<unknown>
    #store?: Store
    #storeIsExplicit = false
    #host?: HTMLElement
    #unsubscribe?: () => void
    // The promise whose resolution is allowed to commit. Cleared on every
    // sync commit so a stale resolution can never overwrite a newer value
    // (mirrors valdres core's `data.values.get(atom) !== promise` guard).
    #pending?: PromiseLike<unknown>

    render(state: State<unknown>, store?: Store): unknown {
        // Only reached server-side (update() handles the browser). With an
        // explicit store we can still render the current synchronous value;
        // context isn't available without a DOM.
        const s = store ?? this.#store
        if (s) {
            const v = s.get(state)
            return isPromiseLike(v) ? noChange : v
        }
        return noChange
    }

    override update(part: Part, [state, store]: DirectiveParameters<this>) {
        if (isServer) return this.render(state, store)

        const stateChanged = state !== this.#state
        let storeChanged = false
        if (store) {
            storeChanged = store !== this.#store
            this.#store = store
            this.#storeIsExplicit = true
        } else if (this.#storeIsExplicit) {
            // Explicit store dropped from the call site: fall back to context.
            this.#store = undefined
            this.#storeIsExplicit = false
            storeChanged = true
        }
        this.#state = state

        // Context resolution retries on every update until a provider answers
        // (a one-shot attempt would leave the binding permanently dead when
        // the first render happens before/without a provider).
        if (!this.#store) {
            const resolved = this.#resolveFromContext(part)
            storeChanged ||= resolved
        }

        if (stateChanged || storeChanged) this.#subscribe()

        const s = this.#store
        if (!s) return noChange
        const v = s.get(this.#state!)
        if (isPromiseLike(v)) {
            this.#resolveAsync(s, this.#state!, v)
            return noChange
        }
        this.#pending = undefined
        return v
    }

    /** One-shot context request from the rendering host; returns true if a
     *  provider answered (synchronously). */
    #resolveFromContext(part?: Part): boolean {
        const host =
            (part?.options?.host as HTMLElement | undefined) ?? this.#host
        if (!host) return false
        this.#host = host
        let answered = false
        host.dispatchEvent(
            new ContextEvent(
                valdresContext,
                host,
                s => {
                    if (s) {
                        this.#store = s
                        answered = true
                    }
                },
                false,
            ),
        )
        return answered
    }

    #subscribe() {
        this.#unsubscribe?.()
        this.#unsubscribe = undefined
        const store = this.#store
        const state = this.#state
        if (!store || !state || !this.isConnected) return
        this.#unsubscribe = store.sub(
            state,
            () => {
                const v = store.get(state)
                if (isPromiseLike(v)) this.#resolveAsync(store, state, v)
                else {
                    this.#pending = undefined
                    this.setValue(v)
                }
            },
            false,
        )
    }

    #resolveAsync(store: Store, state: State<unknown>, v: PromiseLike<unknown>) {
        this.#pending = v
        Promise.resolve(v).then(
            resolved => {
                if (
                    this.#pending === v &&
                    this.#store === store &&
                    this.#state === state &&
                    this.isConnected
                ) {
                    this.#pending = undefined
                    this.setValue(resolved)
                }
            },
            () => {
                // Rejections keep the last committed value; the store reverts
                // the atom itself. Swallow so the binding doesn't surface an
                // unhandled rejection for a promise it merely observed.
                if (this.#pending === v) this.#pending = undefined
            },
        )
    }

    protected override disconnected() {
        this.#unsubscribe?.()
        this.#unsubscribe = undefined
    }

    protected override reconnected() {
        // A context-resolved store may have been a scope that was destroyed
        // while we were detached — drop it and re-resolve from the (stashed)
        // host before resubscribing. Explicit stores are kept.
        if (!this.#storeIsExplicit) {
            this.#store = undefined
            this.#resolveFromContext()
        }
        this.#subscribe()
        if (this.#store && this.#state) {
            const v = this.#store.get(this.#state)
            if (!isPromiseLike(v)) {
                this.#pending = undefined
                this.setValue(v)
            }
        }
    }
}

export const watch = directive(WatchDirective)
