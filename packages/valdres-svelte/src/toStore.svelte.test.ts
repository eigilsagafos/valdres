import { describe, test, expect } from "bun:test"
import { mount, unmount, flushSync } from "svelte"
import { atom, store } from "valdres"
import ToStoreBind from "../test/components/ToStoreBind.svelte"

describe("toStore (mounted)", () => {
    test("bind:value={$count$} is two-way", () => {
        const countAtom = atom(0)
        const s = store()
        const target = document.createElement("div")
        const comp = mount(ToStoreBind, {
            target,
            props: { atom: countAtom, store: s },
        })

        // store → input
        s.set(countAtom, 3)
        flushSync()
        expect((target.querySelector("input") as HTMLInputElement).value).toBe(
            "3",
        )
        expect(target.querySelector(".v")!.textContent).toBe("3")

        // input → store
        const input = target.querySelector("input") as HTMLInputElement
        input.value = "8"
        input.dispatchEvent(new Event("input", { bubbles: true }))
        flushSync()
        expect(s.get(countAtom)).toBe(8)

        unmount(comp)
    })
})
