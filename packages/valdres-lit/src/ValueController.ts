import type { ReactiveController, ReactiveControllerHost } from "lit"
import { ContextConsumer } from "@lit/context"
import { isPromiseLike, type State, type Store } from "valdres"
import { valdresContext } from "./lib/valdresContext"

type Host = ReactiveControllerHost & HTMLElement

export type ValueStatus = "pending" | "ready" | "error"

export class ValueController<
    Value = unknown,
    Args extends [any, ...any[]] = [any, ...any[]],
> implements ReactiveController
{
    protected _host: Host
    protected _state: State<Value, Args>
    protected _store?: Store
    private _explicitStore?: Store
    private _unsubscribe?: () => void
    private _value!: Value
    private _hasValue = false
    private _status: ValueStatus = "pending"
    private _error: unknown = undefined

    constructor(host: Host, state: State<Value, Args>, store?: Store) {
        this._host = host
        this._state = state
        this._explicitStore = store
        host.addController(this)

        if (!store) {
            new ContextConsumer(host, {
                context: valdresContext,
                subscribe: true,
                callback: ctx => {
                    if (ctx && ctx !== this._store) this._attach(ctx)
                },
            })
        }
    }

    hostConnected() {
        if (this._explicitStore && !this._unsubscribe) {
            this._attach(this._explicitStore)
        }
    }

    hostDisconnected() {
        this._detach()
    }

    /**
     * The current value, or `undefined` while a store is not yet attached or an
     * async state is still pending. Mirrors `@lit/context`'s `ContextConsumer`,
     * whose `value` is also `undefined` until provided — so templates can use
     * `${ctrl.value ?? fallback}` instead of guarding a throw. Branch on
     * `status`/`error` for explicit loading and error states.
     */
    get value(): Value | undefined {
        return this._hasValue ? this._value : undefined
    }

    /** `"pending"` before the first value resolves, `"ready"` once it has, `"error"` if an async state rejected. */
    get status(): ValueStatus {
        return this._status
    }

    /** The rejection reason when `status === "error"`, otherwise `undefined`. */
    get error(): unknown {
        return this._error
    }

    private _attach(store: Store) {
        this._detach()
        this._store = store
        this._ingest(store, store.get(this._state))
        // @ts-expect-error valdres SubscribeFn overload typing
        this._unsubscribe = store.sub(
            this._state,
            () => this._ingest(store, store.get(this._state)),
            false,
        )
    }

    private _ingest(store: Store, next: unknown) {
        if (isPromiseLike(next)) {
            this._status = "pending"
            this._host.requestUpdate()
            Promise.resolve(next).then(
                v => {
                    if (this._store !== store) return
                    this._value = v as Value
                    this._hasValue = true
                    this._status = "ready"
                    this._error = undefined
                    this._host.requestUpdate()
                },
                err => {
                    if (this._store !== store) return
                    this._error = err
                    this._status = "error"
                    this._host.requestUpdate()
                },
            )
        } else {
            this._value = next as Value
            this._hasValue = true
            this._status = "ready"
            this._error = undefined
            this._host.requestUpdate()
        }
    }

    private _detach() {
        this._unsubscribe?.()
        this._unsubscribe = undefined
        // Clear the attached store so a reconnect (the same provider re-firing
        // its context callback with the same store instance) re-runs _attach
        // and re-subscribes. Without this, the `ctx !== this._store` guard in
        // the context consumer would skip re-attachment and the controller
        // would silently stop reacting. _value/_hasValue are intentionally left
        // intact so the last value stays readable while disconnected.
        this._store = undefined
    }
}
