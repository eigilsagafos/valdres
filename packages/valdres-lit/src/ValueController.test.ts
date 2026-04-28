import { describe, test, expect } from "bun:test"
import { LitElement, html } from "lit"
import { atom, selector, store as createStore } from "valdres"
import { ValueController } from "./ValueController"

class HostEl extends LitElement {
    ctrl!: ValueController<any>
    render() {
        return html`<span>${this.ctrl?.value ?? "?"}</span>`
    }
}
if (!customElements.get("vc-host"))
    customElements.define("vc-host", HostEl)

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

    test("read before attach throws", () => {
        const a = atom(0)
        const el = document.createElement("vc-host") as HostEl
        const ctrl = new ValueController(el, a)
        expect(() => ctrl.value).toThrow(/before store was attached/)
    })
})
