import type { ReactiveController, ReactiveControllerHost } from "lit"
import { ContextConsumer } from "@lit/context"
import { isPromiseLike, type State, type Store } from "valdres"
import { valdresContext } from "./lib/valdresContext"

type Host = ReactiveControllerHost & HTMLElement

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

    get value(): Value {
        if (!this._hasValue) {
            throw new Error(
                "valdres-lit: value read before store was attached. " +
                    "Make sure the host element is connected and a store is available via context or as an explicit argument.",
            )
        }
        return this._value
    }

    private _attach(store: Store) {
        this._detach()
        this._store = store
        const initial = store.get(this._state)
        if (isPromiseLike(initial)) {
            this._hasValue = false
            Promise.resolve(initial).then(v => {
                if (this._store !== store) return
                this._value = v as Value
                this._hasValue = true
                this._host.requestUpdate()
            })
        } else {
            this._value = initial as Value
            this._hasValue = true
        }
        // @ts-expect-error valdres SubscribeFn overload typing
        this._unsubscribe = store.sub(
            this._state,
            () => {
                const next = store.get(this._state)
                if (!isPromiseLike(next)) {
                    this._value = next as Value
                    this._hasValue = true
                    this._host.requestUpdate()
                }
            },
            false,
        )
        this._host.requestUpdate()
    }

    private _detach() {
        this._unsubscribe?.()
        this._unsubscribe = undefined
    }
}
