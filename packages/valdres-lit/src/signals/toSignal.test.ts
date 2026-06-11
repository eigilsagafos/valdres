import { describe, test, expect } from "bun:test"
import { Signal } from "signal-polyfill"
import { LitElement, html } from "lit"
import { SignalWatcher } from "@lit-labs/signals"
import { atom, selector, store as createStore } from "valdres"
import { toSignal } from "./toSignal"

const tick = () => new Promise(r => setTimeout(r, 0))

const subCount = (store: any, state: any) =>
    store.data.subscriptions.get(state)?.size ?? 0

// Module-scoped element definition (defining inside a test throws on re-runs
// in the same JS environment); the test parameterizes the signal via this slot.
let currentSignal: ReturnType<typeof toSignal<number>> | undefined
class SigHost extends SignalWatcher(LitElement) {
    render() {
        return html`<span>${currentSignal?.get()}</span>`
    }
}
if (!customElements.get("sig-host")) customElements.define("sig-host", SigHost)

describe("toSignal", () => {
    test("subscribes lazily on first watcher, unsubscribes on last", async () => {
        const a = atom(1)
        const s = createStore({ batchUpdates: true })
        const sig = toSignal(a, s)
        expect(subCount(s, a)).toBe(0)

        const watcher = new Signal.subtle.Watcher(() => {})
        watcher.watch(sig)
        expect(subCount(s, a)).toBe(1)

        watcher.unwatch(sig)
        expect(subCount(s, a)).toBe(0)
    })

    test("mirrors store updates while watched", async () => {
        const a = atom(1)
        const s = createStore({ batchUpdates: true })
        const sig = toSignal(a, s)
        let notified = 0
        const watcher = new Signal.subtle.Watcher(() => {
            notified++
        })
        watcher.watch(sig)
        expect(sig.get()).toBe(1)

        s.set(a, 2)
        await tick()
        expect(sig.get()).toBe(2)
        expect(notified).toBeGreaterThan(0)
    })

    test("atom signal set() writes through to the store synchronously", () => {
        const a = atom(0)
        const s = createStore({ batchUpdates: true })
        const sig = toSignal(a, s)
        sig.set(7)
        expect(s.get(a)).toBe(7)
        expect(sig.get()).toBe(7)
    })

    test("selector signal mirrors and is read-only", async () => {
        const a = atom(3)
        const doubled = selector(get => get(a) * 2)
        const s = createStore({ batchUpdates: true })
        const sig = toSignal(doubled, s)
        const watcher = new Signal.subtle.Watcher(() => {})
        watcher.watch(sig)
        expect(sig.get()).toBe(6)
        s.set(a, 5)
        await tick()
        expect(sig.get()).toBe(10)
        expect(() => sig.set(99)).toThrow(/read-only/)
    })

    test("async atom mirrors undefined while pending, value after", async () => {
        let resolve!: (v: string) => void
        const a = atom<string>(
            new Promise<string>(r => {
                resolve = r
            }) as unknown as string,
        )
        const s = createStore({ batchUpdates: true })
        const sig = toSignal(a, s)
        expect(sig.get()).toBeUndefined()
        resolve("done")
        await tick()
        await tick()
        expect(sig.get()).toBe("done")
    })

    test("stale async resolution cannot clobber a newer value", async () => {
        const a = atom<string>("start")
        const s = createStore({ batchUpdates: true })
        const sig = toSignal(a, s)
        const watcher = new Signal.subtle.Watcher(() => {})
        watcher.watch(sig)
        await tick()

        let resolveSlow!: (v: string) => void
        const slow = new Promise<string>(r => {
            resolveSlow = r
        })
        s.set(a, slow as any)
        await tick()
        s.set(a, "v2-sync")
        await tick()
        expect(sig.get()).toBe("v2-sync")

        resolveSlow("v1-stale")
        await tick()
        await tick()
        expect(sig.get()).toBe("v2-sync") // epoch guard: stale write dropped
    })

    test("integrates with @lit-labs/signals SignalWatcher auto-tracking", async () => {
        const a = atom(10)
        const s = createStore({ batchUpdates: true })
        const sig = toSignal(a, s)
        currentSignal = sig

        const el = document.createElement("sig-host") as LitElement
        document.body.appendChild(el)
        await el.updateComplete
        expect(el.shadowRoot!.querySelector("span")!.textContent).toBe("10")

        s.set(a, 11)
        await tick()
        await el.updateComplete
        await el.updateComplete
        expect(el.shadowRoot!.querySelector("span")!.textContent).toBe("11")
        el.remove()
    })
})
