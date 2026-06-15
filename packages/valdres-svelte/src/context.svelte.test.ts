import { describe, test, expect } from "bun:test"
import { mount, unmount, flushSync } from "svelte"
import { atom, store } from "valdres"
import ContextProvider from "../test/components/ContextProvider.svelte"

describe("context resolution (mounted)", () => {
    const tick = () => new Promise(resolve => setTimeout(resolve, 0))

    test("fromState and toStore resolve the context store without an explicit arg", async () => {
        const countAtom = atom(1)
        // The provider's real (auto-created) store is batched; mirror that here.
        const s = store({ batchUpdates: true })
        const target = document.createElement("div")
        const comp = mount(ContextProvider, {
            target,
            props: { store: s, countAtom },
        })

        expect(target.querySelector(".from-state")!.textContent).toBe("1")
        expect(target.querySelector(".to-store")!.textContent).toBe("1")

        // batchUpdates coalesces notifications onto a microtask, so let valdres
        // flush before Svelte does.
        s.set(countAtom, 2)
        await tick()
        flushSync()
        expect(target.querySelector(".from-state")!.textContent).toBe("2")
        expect(target.querySelector(".to-store")!.textContent).toBe("2")

        unmount(comp)
    })
})
