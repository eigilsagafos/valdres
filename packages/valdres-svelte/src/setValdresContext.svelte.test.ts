import { describe, test, expect, spyOn, mock } from "bun:test"
import { mount, unmount } from "svelte"
import { atom, dehydrate, store, type DehydratedState, type Store } from "valdres"
import { z } from "zod"
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

describe("setValdresContext hydrateOptions", () => {
    const titleAtom = atom("", {
        name: "svelte-setup-skip-title",
        schema: z.string(),
    })
    const countAtom = atom(0, {
        name: "svelte-setup-skip-count",
        schema: z.number().int(),
    })
    // Hand-built payload: one valid entry, one that fails schema validation.
    const tampered: DehydratedState = {
        atoms: [
            ["svelte-setup-skip-title", "fine"],
            ["svelte-setup-skip-count", "not-a-number"],
        ],
        families: [],
    }

    test("forwards { invalid: 'skip' } to core hydrate — valid entries land, bad ones drop", () => {
        const warn = spyOn(console, "warn").mockImplementation(mock())
        try {
            const s = store({ batchUpdates: true, schemaValidation: true })
            mountProbe({
                store: s,
                hydrate: tampered,
                hydrateOptions: { invalid: "skip" },
            })
            expect(s.get(titleAtom)).toBe("fine")
            expect(s.get(countAtom)).toBe(0) // failed validation → skipped
            expect(warn).toHaveBeenCalled()
        } finally {
            warn.mockRestore()
        }
    })

    test("defaults to strict — an invalid entry throws and aborts hydration", () => {
        const s = store({ batchUpdates: true, schemaValidation: true })
        expect(() => mountProbe({ store: s, hydrate: tampered })).toThrow()
        // strict abort rolls back the whole payload — even the valid entry
        expect(s.get(titleAtom)).toBe("")
    })
})
