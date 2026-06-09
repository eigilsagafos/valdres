import type { ReactiveController, ReactiveElement } from "lit"
import { ContextConsumer, ContextProvider } from "@lit/context"
import type { Store } from "valdres"
import { valdresContext } from "./lib/valdresContext"

type ScopedStore = Store & {
    detach: (warnIfNotDestroyed?: boolean) => void
}

let scopeIdCounter = 0
const generateScopeId = () => `valdres-lit-scope-${++scopeIdCounter}`

export class ScopeController implements ReactiveController {
    private _host: ReactiveElement
    private _scopeId: string
    private _provider: ContextProvider<typeof valdresContext>
    private _scopedStore?: ScopedStore
    private _wasCreated = false

    constructor(host: ReactiveElement, scopeId?: string) {
        this._host = host
        this._scopeId = scopeId ?? generateScopeId()
        host.addController(this)

        this._provider = new ContextProvider(host, {
            context: valdresContext,
        })

        // subscribe:true so the callback re-fires on every (re)connect. A
        // subscribe:false consumer is one-shot, which combined with the scope
        // teardown in hostDisconnected would leave the scope unacquired (and
        // `get store()` throwing) after a disconnect→reconnect cycle. The
        // `_scopedStore` guard keeps this idempotent while connected.
        new ContextConsumer(host, {
            context: valdresContext,
            subscribe: true,
            callback: parent => {
                if (!parent || this._scopedStore) return
                this._wasCreated = !parent.data.scopes?.has(this._scopeId)
                this._scopedStore = parent.scope(this._scopeId) as ScopedStore
                this._provider.setValue(this._scopedStore)
                host.requestUpdate()
            },
        })
    }

    hostDisconnected() {
        this._scopedStore?.detach(this._wasCreated)
        this._scopedStore = undefined
    }

    get store(): Store {
        if (!this._scopedStore) {
            throw new Error(
                "valdres-lit: ScopeController accessed before parent store was available.",
            )
        }
        return this._scopedStore
    }
}
