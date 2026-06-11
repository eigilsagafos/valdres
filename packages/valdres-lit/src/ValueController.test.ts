import { describe, test, expect } from "bun:test"
import { LitElement, html } from "lit"
import { atom, selector, store as createStore } from "valdres"
import type { Store } from "valdres"
import { ValueController } from "./ValueController"
import { StoreProvider } from "./StoreProvider"

class HostEl extends LitElement {
    ctrl!: ValueController<any>
    render() {
        return html`<span>${this.ctrl?.value ?? "?"}</span>`
    }
}
if (!customElements.get("vc-host"))
    customElements.define("vc-host", HostEl)

class ProviderShell extends LitElement {
    providerStore!: Store
    private _provider?: StoreProvider
    connectedCallback() {
        super.connectedCallback()
        if (!this._provider) {
            this._provider = new StoreProvider(this, this.providerStore)
        }
    }
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("vc-provider"))
    customElements.define("vc-provider", ProviderShell)

describe("ValueController", () => {
    test("reads initial atom value", async () => {
        const a = atom(7)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController(el, a, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        expect(ctrl.value).toBe(7)
        el.remove()
    })

    test("re-evaluates selector when dependency changes", async () => {
        const countAtom = atom(2)
        const doubled = selector(get => get(countAtom) * 2)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController<number>(el, doubled, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        expect(ctrl.value).toBe(4)
        s.set(countAtom, 10)
        await el.updateComplete
        expect(ctrl.value).toBe(20)
        el.remove()
    })

    test("unsubscribes on disconnect", async () => {
        const a = atom(0)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController(el, a, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        s.set(a, 1)
        await el.updateComplete
        expect(ctrl.value).toBe(1)
        el.remove()
        s.set(a, 999)
        expect(ctrl.value).toBe(1)
    })

    test("value is undefined and status pending before attach", () => {
        const a = atom(0)
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController(el, a)
        expect(ctrl.value).toBeUndefined()
        expect(ctrl.status).toBe("pending")
        expect(ctrl.error).toBeUndefined()
    })

    test("status is ready once a synchronous value attaches", async () => {
        const a = atom(5)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController(el, a, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        expect(ctrl.status).toBe("ready")
        expect(ctrl.value).toBe(5)
        el.remove()
    })

    test("re-subscribes after disconnect → reconnect via context", async () => {
        const a = atom(1)
        const s = createStore({ batchUpdates: true })
        const provider = document.createElement("vc-provider") as ProviderShell
        provider.providerStore = s
        document.body.appendChild(provider)
        await provider.updateComplete

        const el = document.createElement("vc-host") as HostEl
        el.ctrl = new ValueController(el, a)
        provider.appendChild(el)
        await el.updateComplete
        expect(el.ctrl.value).toBe(1)

        // Disconnect, mutate while detached, then reconnect.
        el.remove()
        s.set(a, 2)
        provider.appendChild(el)
        await el.updateComplete
        // After reconnect a fresh subscription must observe further changes.
        s.set(a, 3)
        await el.updateComplete
        expect(el.ctrl.value).toBe(3)
        provider.remove()
    })

    test("renders into shadow DOM and reflects a later set", async () => {
        const a = atom(1)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        el.ctrl = new ValueController(el, a, s)
        document.body.appendChild(el)
        await el.updateComplete
        s.set(a, 7)
        // Batched stores can need an extra tick to flush.
        await el.updateComplete
        await el.updateComplete
        expect(el.shadowRoot!.querySelector("span")?.textContent).toBe("7")
        el.remove()
    })

    test("async atom: pending then ready, no first-render throw", async () => {
        let resolve!: (v: number) => void
        const promise = new Promise<number>(r => {
            resolve = r
        })
        const a = atom(promise)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController(el, a, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        // Pending: value undefined, render did not throw.
        expect(ctrl.status).toBe("pending")
        expect(ctrl.value).toBeUndefined()
        resolve(99)
        await promise
        await el.updateComplete
        expect(ctrl.status).toBe("ready")
        expect(ctrl.value).toBe(99)
        el.remove()
    })

    test("async atom rejection surfaces as error status, no unhandled rejection", async () => {
        let reject!: (e: unknown) => void
        const promise = new Promise<number>((_, r) => {
            reject = r
        })
        // Swallow the rejection on the source promise itself; the controller
        // must independently handle its derived promise.
        promise.catch(() => {})
        const a = atom(promise)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController(el, a, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        reject(new Error("boom"))
        await promise.catch(() => {})
        await el.updateComplete
        expect(ctrl.status).toBe("error")
        expect((ctrl.error as Error)?.message).toBe("boom")
        expect(ctrl.value).toBeUndefined()
        el.remove()
    })

    test("stale async resolution cannot overwrite a newer value", async () => {
        const a = atom<string>("start")
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController<string>(el, a, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        expect(ctrl.value).toBe("start")

        let resolveSlow!: (v: string) => void
        const slow = new Promise<string>(r => {
            resolveSlow = r
        })
        s.set(a, slow as any) // pending…
        await new Promise(r => setTimeout(r, 0))
        s.set(a, "v2-sync") // overtaken by a sync write
        await new Promise(r => setTimeout(r, 0))
        await el.updateComplete
        expect(ctrl.value).toBe("v2-sync")
        expect(ctrl.status).toBe("ready")

        resolveSlow("v1-stale") // stale promise resolves last
        await new Promise(r => setTimeout(r, 0))
        await el.updateComplete
        expect(ctrl.value).toBe("v2-sync") // must NOT regress
        expect(ctrl.status).toBe("ready")
        el.remove()
    })

    test("error is undefined while a later async write is pending", async () => {
        let reject!: (e: unknown) => void
        const failing = new Promise<string>((_, r) => {
            reject = r
        })
        failing.catch(() => {})
        const a = atom<string>(failing as unknown as string)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController<string>(el, a, s)
        el.ctrl = ctrl
        document.body.appendChild(el)
        await el.updateComplete
        reject(new Error("boom"))
        await failing.catch(() => {})
        await el.updateComplete
        expect(ctrl.status).toBe("error")
        expect((ctrl.error as Error)?.message).toBe("boom")

        // A new pending write clears the exposed error until it settles.
        s.set(a, new Promise<string>(() => {}) as any)
        await new Promise(r => setTimeout(r, 0))
        await el.updateComplete
        expect(ctrl.status).toBe("pending")
        expect(ctrl.error).toBeUndefined()
        el.remove()
    })
})
