import { describe, test, expect, spyOn, mock } from "bun:test"
import { mount, unmount, flushSync } from "svelte"
import { atom, store, type Store } from "valdres"
import { scope } from "./scope"
import ScopeProbe from "../test/components/ScopeProbe.svelte"
import ScopeLifecycle from "../test/components/ScopeLifecycle.svelte"

describe("scope", () => {
    test("throws outside a component context", () => {
        expect(() => scope("nope")).toThrow()
    })

    test("initialize seeds the scoped store, leaving the root untouched", () => {
        const countAtom = atom(0)
        const rootStore = store({ batchUpdates: true })
        const target = document.createElement("div")
        const comp = mount(ScopeProbe, {
            target,
            props: { rootStore, countAtom },
        })

        // The scoped store was initialized to 100...
        expect(target.querySelector(".scoped")!.textContent).toBe("100")
        // ...while the root keeps its default.
        expect(rootStore.get(countAtom)).toBe(0)

        unmount(comp)
    })

    test("detaches the scope when the owning component is destroyed", () => {
        const rootStore = store({ batchUpdates: true })
        const target = document.createElement("div")
        const comp = mount(ScopeLifecycle, {
            target,
            props: { rootStore, scopeId: "detach-me", onScope: () => {} },
        })
        flushSync() // complete the initial mount so onDestroy will fire later

        expect(rootStore.data.scopes?.has("detach-me")).toBe(true)

        unmount(comp)
        flushSync() // onDestroy runs on the unmount flush
        // onDestroy → scopedStore.detach() drops the last consumer.
        expect(rootStore.data.scopes?.has("detach-me")).toBe(false)
    })

    test("reuses an existing scope of the same id (ref-counted detach)", () => {
        const rootStore = store({ batchUpdates: true })
        let a: Store | undefined
        let b: Store | undefined

        const targetA = document.createElement("div")
        const compA = mount(ScopeLifecycle, {
            target: targetA,
            props: { rootStore, scopeId: "shared", onScope: s => (a = s) },
        })
        const targetB = document.createElement("div")
        const compB = mount(ScopeLifecycle, {
            target: targetB,
            props: { rootStore, scopeId: "shared", onScope: s => (b = s) },
        })
        flushSync() // complete both mounts so onDestroy fires on unmount

        // Both resolve the same scoped store data.
        expect(a!.data.id).toBe(b!.data.id)

        // Two consumers: unmounting one keeps the scope alive. The creator
        // detaching while a consumer remains logs an expected core warning.
        const warn = spyOn(console, "warn").mockImplementation(mock())
        try {
            unmount(compA)
            flushSync()
            expect(rootStore.data.scopes?.has("shared")).toBe(true)
            // ...and the last consumer's destroy detaches it.
            unmount(compB)
            flushSync()
            expect(rootStore.data.scopes?.has("shared")).toBe(false)
        } finally {
            warn.mockRestore()
        }
    })
})
