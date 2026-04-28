import { describe, test, expect } from "bun:test"
import { LitElement, html } from "lit"
import { ContextConsumer } from "@lit/context"
import { atom, store as createStore } from "valdres"
import type { Store } from "valdres"
import { StoreProvider } from "./StoreProvider"
import { ScopeController } from "./ScopeController"
import { valdresContext } from "./lib/valdresContext"

let rootStore: Store

class App extends LitElement {
    private _provider: StoreProvider
    constructor() {
        super()
        rootStore = createStore({ id: "root", batchUpdates: true })
        this._provider = new StoreProvider(this, rootStore)
    }
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("sc-app")) customElements.define("sc-app", App)

class Page extends LitElement {
    scopeId?: string
    scope?: ScopeController
    connectedCallback() {
        super.connectedCallback()
        if (!this.scope) {
            this.scope = new ScopeController(this, this.scopeId)
        }
    }
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("sc-page")) customElements.define("sc-page", Page)

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
if (!customElements.get("sc-reader"))
    customElements.define("sc-reader", Reader)

const mount = async (scopeId?: string) => {
    const app = document.createElement("sc-app") as App
    document.body.appendChild(app)
    await app.updateComplete
    const page = document.createElement("sc-page") as Page
    page.scopeId = scopeId
    app.appendChild(page)
    await page.updateComplete
    const reader = document.createElement("sc-reader") as Reader
    page.appendChild(reader)
    await reader.updateComplete
    return { app, page, reader }
}

describe("ScopeController", () => {
    test("provides a scoped store distinct from root", async () => {
        const { app, page, reader } = await mount("page-scope")
        expect(reader.seen).toBeDefined()
        expect(reader.seen).not.toBe(rootStore)
        expect(page.scope!.store.data.id).toBe("page-scope")
        app.remove()
    })

    test("scoped store sets are visible to descendants", async () => {
        const a = atom(0)
        const { app, page, reader } = await mount("scope-1")
        page.scope!.store.set(a, 50)
        expect(reader.seen!.get(a)).toBe(50)
        app.remove()
    })

    test("auto-generated scope id when none provided", async () => {
        const { app, page } = await mount()
        expect(page.scope!.store.data.id).toMatch(/valdres-lit-scope-/)
        app.remove()
    })

    test("scope is detached on disconnect", async () => {
        const { app, page } = await mount("disposable")
        page.remove()
        expect(rootStore.data.scopes?.has("disposable")).toBe(false)
        app.remove()
    })
})
