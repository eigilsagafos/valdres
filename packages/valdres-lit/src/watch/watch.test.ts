import { describe, test, expect } from "bun:test"
import { LitElement, html } from "lit"
import { atom, selector, store as createStore } from "valdres"
import type { Store } from "valdres"
import { watch } from "./watch"
import { StoreProvider } from "../StoreProvider"

const tick = () => new Promise(r => setTimeout(r, 0))
const settle = async (...els: any[]) => {
    for (let i = 0; i < 4; i++) {
        await tick()
        for (const el of els) if (el?.updateComplete) await el.updateComplete
    }
}

// Host with an explicit store; counts its own render() calls so we can assert
// the directive updates without re-rendering the host.
class ExplicitHost extends LitElement {
    state!: any
    store!: Store
    renders = 0
    render() {
        this.renders++
        return html`<span>${watch(this.state, this.store)}</span>`
    }
}
if (!customElements.get("watch-explicit-host"))
    customElements.define("watch-explicit-host", ExplicitHost)

class ProviderShell extends LitElement {
    provider = new StoreProvider(this)
    render() {
        return html`<slot></slot>`
    }
}
if (!customElements.get("watch-provider-shell"))
    customElements.define("watch-provider-shell", ProviderShell)

class ContextHost extends LitElement {
    state!: any
    renders = 0
    render() {
        this.renders++
        return html`<span>${watch(this.state)}</span>`
    }
}
if (!customElements.get("watch-context-host"))
    customElements.define("watch-context-host", ContextHost)

const text = (el: any) =>
    el.shadowRoot.querySelector("span").textContent.trim()

describe("watch directive", () => {
    test("renders the value and updates without re-rendering the host", async () => {
        const a = atom(1)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("watch-explicit-host") as ExplicitHost
        el.state = a
        el.store = s
        document.body.appendChild(el)
        await settle(el)
        expect(text(el)).toBe("1")
        const rendersAfterMount = el.renders

        s.set(a, 2)
        await settle(el)
        expect(text(el)).toBe("2")
        s.set(a, 3)
        await settle(el)
        expect(text(el)).toBe("3")
        // Fine-grained: the binding updated, the host render() did not re-run.
        expect(el.renders).toBe(rendersAfterMount)
        el.remove()
    })

    test("tracks a selector", async () => {
        const a = atom(2)
        const doubled = selector(get => get(a) * 2)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("watch-explicit-host") as ExplicitHost
        el.state = doubled
        el.store = s
        document.body.appendChild(el)
        await settle(el)
        expect(text(el)).toBe("4")
        s.set(a, 5)
        await settle(el)
        expect(text(el)).toBe("10")
        el.remove()
    })

    test("resolves the store from context", async () => {
        const a = atom(7)
        const shell = document.createElement(
            "watch-provider-shell",
        ) as ProviderShell
        document.body.appendChild(shell)
        await shell.updateComplete
        const el = document.createElement("watch-context-host") as ContextHost
        el.state = a
        shell.appendChild(el)
        await settle(shell, el)
        expect(text(el)).toBe("7")
        shell.provider.store.set(a, 8)
        await settle(shell, el)
        expect(text(el)).toBe("8")
        shell.remove()
    })

    test("pauses on disconnect and resumes with a fresh value on reconnect", async () => {
        const a = atom(1)
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("watch-explicit-host") as ExplicitHost
        el.state = a
        el.store = s
        document.body.appendChild(el)
        await settle(el)
        expect(text(el)).toBe("1")

        el.remove()
        s.set(a, 41)
        await tick()
        document.body.appendChild(el)
        await settle(el)
        expect(text(el)).toBe("41")
        // and it keeps reacting after the reconnect
        s.set(a, 42)
        await settle(el)
        expect(text(el)).toBe("42")
        el.remove()
    })

    test("stale async resolution cannot overwrite a newer value", async () => {
        const a = atom<string>("start")
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("watch-explicit-host") as ExplicitHost
        el.state = a
        el.store = s
        document.body.appendChild(el)
        await settle(el)
        expect(text(el)).toBe("start")

        let resolveSlow!: (v: string) => void
        const slow = new Promise<string>(r => {
            resolveSlow = r
        })
        s.set(a, slow as any) // pending…
        await settle(el)
        s.set(a, "v2-sync") // overtaken by a sync write
        await settle(el)
        expect(text(el)).toBe("v2-sync")

        resolveSlow("v1-stale") // stale promise resolves last
        await settle(el)
        expect(text(el)).toBe("v2-sync") // must NOT regress to v1-stale
        el.remove()
    })

    test("context resolution retries until a provider exists", async () => {
        const a = atom(5)
        // Host mounts OUTSIDE any provider: first update finds no store.
        const el = document.createElement("watch-context-host") as ContextHost
        el.state = a
        document.body.appendChild(el)
        await settle(el)
        expect(text(el)).toBe("")

        // Re-parent under a provider; the next host render re-resolves.
        const shell = document.createElement(
            "watch-provider-shell",
        ) as ProviderShell
        document.body.appendChild(shell)
        await shell.updateComplete
        el.remove()
        shell.appendChild(el)
        el.requestUpdate()
        await settle(shell, el)
        expect(text(el)).toBe("5")
        shell.provider.store.set(a, 6)
        await settle(shell, el)
        expect(text(el)).toBe("6")
        shell.remove()
    })

    test("async atom renders nothing while pending, then the value", async () => {
        let resolve!: (v: string) => void
        const a = atom<string>(
            new Promise<string>(r => {
                resolve = r
            }) as unknown as string,
        )
        const s = createStore({ batchUpdates: true })
        const el = document.createElement("watch-explicit-host") as ExplicitHost
        el.state = a
        el.store = s
        document.body.appendChild(el)
        await settle(el)
        expect(text(el)).toBe("")
        resolve("ready!")
        await settle(el)
        expect(text(el)).toBe("ready!")
        el.remove()
    })
})
