import { describe, test, expect } from "bun:test"
import { LitElement, html } from "lit"
import { atom, store as createStore } from "valdres"
import { AtomController } from "./AtomController"
import { StoreProvider } from "./StoreProvider"

const counterAtom = atom(0)

class App extends LitElement {
    private _provider = new StoreProvider(this)
    get store() {
        return this._provider.store
    }
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("ac-app")) customElements.define("ac-app", App)

class CountHost extends LitElement {
    ctrl!: AtomController<number>
    render() {
        return html`<span>${this.ctrl?.value ?? "?"}</span>`
    }
}
if (!customElements.get("ac-count-host"))
    customElements.define("ac-count-host", CountHost)

const mountWithExplicitStore = async (
    initial: number,
    s = createStore({ batchUpdates: true }),
) => {
    const a = atom(initial)
    const el = document.createElement("ac-count-host") as CountHost
    const ctrl = new AtomController(el, a, s)
    el.ctrl = ctrl
    document.body.appendChild(el)
    await el.updateComplete
    return { atom: a, store: s, el, ctrl }
}

describe("AtomController", () => {
    test("explicit store: reads initial value", async () => {
        const { ctrl, el } = await mountWithExplicitStore(10)
        expect(ctrl.value).toBe(10)
        el.remove()
    })

    test("explicit store: set updates value and store", async () => {
        const { ctrl, store, atom: a, el } = await mountWithExplicitStore(0)
        ctrl.set(5)
        await el.updateComplete
        expect(ctrl.value).toBe(5)
        expect(store.get(a)).toBe(5)
        el.remove()
    })

    test("setter accepts updater function", async () => {
        const { ctrl, el } = await mountWithExplicitStore(10)
        ctrl.set(prev => prev + 5)
        await el.updateComplete
        expect(ctrl.value).toBe(15)
        el.remove()
    })

    test("reacts to external store changes", async () => {
        const { ctrl, store, atom: a, el } = await mountWithExplicitStore(1)
        store.set(a, 99)
        await el.updateComplete
        expect(ctrl.value).toBe(99)
        el.remove()
    })

    test("reset returns to default", async () => {
        const { ctrl, store, atom: a, el } = await mountWithExplicitStore(7)
        ctrl.set(42)
        await el.updateComplete
        ctrl.reset()
        await el.updateComplete
        expect(store.get(a)).toBe(7)
        expect(ctrl.value).toBe(7)
        el.remove()
    })

    test("unsubscribes on disconnect", async () => {
        const { ctrl, store, atom: a, el } = await mountWithExplicitStore(0)
        ctrl.set(1)
        await el.updateComplete
        const last = ctrl.value
        el.remove()
        store.set(a, 999)
        expect(ctrl.value).toBe(last)
    })

    test("renders value in template", async () => {
        const { el } = await mountWithExplicitStore(123)
        const span = el.shadowRoot!.querySelector("span")
        expect(span?.textContent).toBe("123")
        el.remove()
    })

    test("pulls store from ancestor context", async () => {
        const app = document.createElement("ac-app") as App
        document.body.appendChild(app)
        await app.updateComplete
        const host = document.createElement("ac-count-host") as CountHost
        host.ctrl = new AtomController(host, counterAtom)
        app.appendChild(host)
        await host.updateComplete
        expect(host.ctrl.value).toBe(0)
        host.ctrl.set(60)
        await host.updateComplete
        expect(host.ctrl.value).toBe(60)
        app.remove()
    })

    test("keeps reacting after disconnect → reconnect under a provider", async () => {
        const reconnectAtom = atom(0)
        const app = document.createElement("ac-app") as App
        document.body.appendChild(app)
        await app.updateComplete
        const host = document.createElement("ac-count-host") as CountHost
        host.ctrl = new AtomController(host, reconnectAtom)
        app.appendChild(host)
        await host.updateComplete
        host.ctrl.set(1)
        await host.updateComplete
        expect(host.ctrl.value).toBe(1)

        // Re-parent within the same provider, then mutate.
        host.remove()
        app.appendChild(host)
        await host.updateComplete
        host.ctrl.set(2)
        await host.updateComplete
        expect(host.ctrl.value).toBe(2)
        expect(app.store.get(reconnectAtom)).toBe(2)
        app.remove()
    })

    test("set without store throws helpful error", () => {
        const a = atom(0)
        const el = document.createElement("ac-count-host") as CountHost
        const ctrl = new AtomController(el, a)
        expect(() => ctrl.set(1)).toThrow(/before store was attached/)
    })

    test("set(promise) re-enters pending synchronously then resolves", async () => {
        const a = atom<string>("idle")
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("ac-count-host") as CountHost
        const ctrl = new AtomController<string>(el, a as any, s)
        ;(el as any).ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        expect(ctrl.status).toBe("ready")
        expect(ctrl.value).toBe("idle")

        ctrl.set(
            new Promise<string>(res =>
                setTimeout(() => res("loaded"), 15),
            ) as any,
        )
        // The controller reflects its own async write immediately, before the
        // promise resolves — this is the "Next dog shows loading" guarantee.
        expect(ctrl.status).toBe("pending")
        await new Promise(r => setTimeout(r, 30))
        await el.updateComplete
        expect(ctrl.status).toBe("ready")
        expect(ctrl.value).toBe("loaded")
        el.remove()
    })

    test("reset into an async default re-enters pending then refetches", async () => {
        let n = 0
        const a = atom<string>(
            (() =>
                new Promise<string>(res =>
                    setTimeout(() => res(`v${++n}`), 15),
                )) as unknown as string,
        )
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("ac-count-host") as CountHost
        const ctrl = new AtomController<string>(el, a as any, s)
        ;(el as any).ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        expect(ctrl.status).toBe("pending")
        await new Promise(r => setTimeout(r, 30))
        await el.updateComplete
        expect(ctrl.value).toBe("v1")

        ctrl.reset()
        expect(ctrl.status).toBe("pending") // synchronous, not stuck on ready
        await new Promise(r => setTimeout(r, 30))
        await el.updateComplete
        expect(ctrl.status).toBe("ready")
        expect(ctrl.value).toBe("v2")
        el.remove()
    })
})
