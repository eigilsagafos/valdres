import { describe, test, expect, spyOn } from "bun:test"
import { mount, unmount } from "svelte"
import { atom, dehydrate, store, type Store } from "valdres"
import SetupProbe from "../test/components/SetupProbe.svelte"

const mountProbe = (options?: any): Store => {
    let captured: Store | undefined
    const target = document.createElement("div")
    const comp = mount(SetupProbe, {
        target,
        props: { options, onStore: (s: Store) => (captured = s) },
    })
    unmount(comp)
    return captured!
}

describe("setValdresContext", () => {
    test("no-arg creates a batched store per tree", () => {
        const s = mountProbe()
        expect(s).toBeDefined()
        expect(s.data.batchUpdates).toBe(true)
    })

    test("adopts a passed store", () => {
        const passed = store({ batchUpdates: true })
        const s = mountProbe(passed)
        expect(s).toBe(passed)
    })

    test("warns when a non-batched store is passed", () => {
        const warn = spyOn(console, "warn").mockImplementation(() => {})
        try {
            mountProbe(store())
            expect(warn).toHaveBeenCalled()
            expect(String(warn.mock.calls[0][0])).toContain("batchUpdates")
        } finally {
            warn.mockRestore()
        }
    })

    test("runs initialize inside a transaction on the fresh store", () => {
        const countAtom = atom(0)
        const s = mountProbe({ initialize: () => [[countAtom, 7]] })
        expect(s.get(countAtom)).toBe(7)
    })

    test("applies a hydrate payload", () => {
        const seededAtom = atom(0, { name: "svelte-setup-hydrate-a" })
        const source = store()
        source.set(seededAtom, 99)
        const payload = dehydrate(source)

        const s = mountProbe({ hydrate: payload })
        expect(s.get(seededAtom)).toBe(99)
    })

    test("hydrate wins over initialize (initialize runs first)", () => {
        const seededAtom = atom(0, { name: "svelte-setup-hydrate-b" })
        const source = store()
        source.set(seededAtom, 2)
        const payload = dehydrate(source)

        const s = mountProbe({
            initialize: () => [[seededAtom, 1]],
            hydrate: payload,
        })
        expect(s.get(seededAtom)).toBe(2)
    })
})
