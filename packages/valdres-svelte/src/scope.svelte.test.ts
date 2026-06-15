import { describe, test, expect } from "bun:test"
import { mount, unmount } from "svelte"
import { atom, store } from "valdres"
import { scope } from "./scope"
import ScopeProbe from "../test/components/ScopeProbe.svelte"

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
})
