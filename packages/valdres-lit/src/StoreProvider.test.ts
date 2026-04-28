import { describe, test, expect, mock } from "bun:test"
import { LitElement, html } from "lit"
import { ContextConsumer } from "@lit/context"
import { atom, store as createStore } from "valdres"
import type { Store } from "valdres"
import { StoreProvider } from "./StoreProvider"
import { valdresContext } from "./lib/valdresContext"

class App extends LitElement {
    static current?: App
    store: Store
    private _provider: StoreProvider
    constructor() {
        super()
        App.current = this
        this.store = createStore({ batchUpdates: true })
        this._provider = new StoreProvider(this, this.store)
    }
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("sp-app")) customElements.define("sp-app", App)

class Reader extends LitElement {
    seen?: Store
    constructor() {
        super()
        new ContextConsumer(this, {
            context: valdresContext,
            subscribe: false,
            callback: store => {
                if (store) this.seen = store
            },
        })
    }
    render() {
        return html`<span></span>`
    }
}
if (!customElements.get("sp-reader")) customElements.define("sp-reader", Reader)

describe("StoreProvider", () => {
    test("provides store to descendants", async () => {
        const app = document.createElement("sp-app") as App
        document.body.appendChild(app)
        await app.updateComplete
        const reader = document.createElement("sp-reader") as Reader
        app.appendChild(reader)
        await reader.updateComplete
        expect(reader.seen).toBe(app.store)
        app.remove()
    })

    test("descendants can mutate via the provided store", async () => {
        const a = atom(0)
        const app = document.createElement("sp-app") as App
        document.body.appendChild(app)
        await app.updateComplete
        app.store.set(a, 99)
        expect(app.store.get(a)).toBe(99)
        app.remove()
    })

    test("warns when store lacks batchUpdates", () => {
        const warn = mock(() => {})
        const original = console.warn
        console.warn = warn
        const noBatch = createStore("no-batch")
        class WarnApp extends LitElement {
            constructor() {
                super()
                new StoreProvider(this, noBatch)
            }
            render() {
                return html``
            }
        }
        customElements.define("sp-warn-app", WarnApp)
        document.body.appendChild(document.createElement("sp-warn-app"))
        console.warn = original
        expect(warn).toHaveBeenCalledTimes(1)
    })

    test("setStore replaces the provided store", async () => {
        const a = atom(0)
        const first = createStore({ id: "first", batchUpdates: true })
        first.set(a, 1)
        const second = createStore({ id: "second", batchUpdates: true })
        second.set(a, 2)

        class SwapApp extends LitElement {
            provider: StoreProvider
            constructor() {
                super()
                this.provider = new StoreProvider(this, first)
            }
            render() {
                return html`<slot></slot>`
            }
        }
        customElements.define("sp-swap-app", SwapApp)

        const app = document.createElement("sp-swap-app") as SwapApp
        document.body.appendChild(app)
        await app.updateComplete
        const reader = document.createElement("sp-reader") as Reader
        app.appendChild(reader)
        await reader.updateComplete
        expect(reader.seen?.data.id).toBe("first")

        const reader2 = document.createElement("sp-reader") as Reader
        app.provider.setStore(second)
        app.appendChild(reader2)
        await reader2.updateComplete
        expect(reader2.seen?.data.id).toBe("second")
        app.remove()
    })
})
