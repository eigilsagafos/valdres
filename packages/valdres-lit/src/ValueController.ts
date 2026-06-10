import type { ReactiveController, ReactiveControllerHost } from "lit"
import { ContextConsumer } from "@lit/context"
import { isPromiseLike, type State, type Store } from "valdres"
import { valdresContext } from "./lib/valdresContext"
import { isServer } from "./lib/isServer"

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
     * The current value — `undefined` until a store attaches and the first
     * value resolves. During later pending transitions the last value stays
     * readable (branch on `status` for loading UI). Mirrors `@lit/context`'s
     * `ContextConsumer`, whose `value` is also `undefined` until provided —
     * so templates can use `${ctrl.value ?? fallback}` instead of guarding a
     * throw.
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
        // Server-side the value above is all a render needs; never start a
        // live subscription without a DOM to clean it up against.
        if (isServer) return
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

    /**
     * Re-read the current state and update value/status now. The store batches
     * subscriber notifications and, for an atom written to a Promise, only
     * notifies on *resolution* — so a controller that triggers its own async
     * write (e.g. AtomController.reset/set into an async default) would never
     * reflect the intervening `pending` state. Calling this right after such a
     * write surfaces it synchronously.
     */
    protected _refresh() {
        if (this._store) this._ingest(this._store, this._store.get(this._state))
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
