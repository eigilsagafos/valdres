import { describe, test, expect, mock } from "bun:test"
import { LitElement, html } from "lit"
import { ContextConsumer } from "@lit/context"
import { atom, store as createStore } from "valdres"
import type { Store } from "valdres"
import { StoreProvider } from "./StoreProvider"
import { valdresContext } from "./lib/valdresContext"

class App extends LitElement {
    store: Store
    private _provider: StoreProvider
    constructor() {
        super()
        this.store = createStore({ batchUpdates: true })
        this._provider = new StoreProvider(this, this.store)
    }
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("sp-app")) customElements.define("sp-app", App)

// Element definitions are module-scoped (registering inside a test throws on
// re-runs in the same JS environment). Tests parameterize the store via this
// module-level slot, read at construction time.
let providedStore: Store | undefined

class ParamApp extends LitElement {
    provider = new StoreProvider(this, providedStore)
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("sp-param-app"))
    customElements.define("sp-param-app", ParamApp)

class AutoApp extends LitElement {
    provider = new StoreProvider(this)
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("sp-auto-app"))
    customElements.define("sp-auto-app", AutoApp)

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

    test("warns when an explicit store lacks batchUpdates", () => {
        const warn = mock(() => {})
        const original = console.warn
        console.warn = warn
        providedStore = createStore("no-batch")
        document.body.appendChild(document.createElement("sp-param-app"))
        console.warn = original
        providedStore = undefined
        expect(warn).toHaveBeenCalledTimes(1)
    })

    test("auto-creates a batched store and does not warn when none is passed", async () => {
        const warn = mock(() => {})
        const original = console.warn
        console.warn = warn
        const app = document.createElement("sp-auto-app") as AutoApp
        document.body.appendChild(app)
        await app.updateComplete
        console.warn = original
        expect(warn).not.toHaveBeenCalled()
        expect(app.provider.store).toBeDefined()
        expect(app.provider.store.data.batchUpdates).toBe(true)

        const a = atom(3)
        const reader = document.createElement("sp-reader") as Reader
        app.appendChild(reader)
        await reader.updateComplete
        expect(reader.seen).toBe(app.provider.store)
        expect(reader.seen!.get(a)).toBe(3)
        app.remove()
    })

    test("store getter returns the provided store", async () => {
        const s = createStore({ id: "getter", batchUpdates: true })
        providedStore = s
        const app = document.createElement("sp-param-app") as ParamApp
        providedStore = undefined
        document.body.appendChild(app)
        await app.updateComplete
        expect(app.provider.store).toBe(s)
        app.remove()
    })

    test("setStore replaces the provided store", async () => {
        const first = createStore({ id: "first", batchUpdates: true })
        const second = createStore({ id: "second", batchUpdates: true })
        providedStore = first
        const app = document.createElement("sp-param-app") as ParamApp
        providedStore = undefined
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
