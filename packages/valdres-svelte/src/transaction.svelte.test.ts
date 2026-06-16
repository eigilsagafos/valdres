import { describe, test, expect } from "bun:test"
import { mount, unmount, flushSync } from "svelte"
import { atom, store } from "valdres"
import { transaction } from "./transaction"
import TxnButton from "../test/components/TxnButton.svelte"

describe("transaction", () => {
    test("runs from a deferred event handler using the captured store", () => {
        const countAtom = atom(0)
        const s = store({ batchUpdates: true })
        const target = document.createElement("div")
        const comp = mount(TxnButton, {
            target,
            props: { store: s, countAtom },
        })

        const button = target.querySelector("button")!
        expect(button.textContent?.trim()).toBe("count is 0")

        button.click()
        flushSync()
        expect(s.get(countAtom)).toBe(2)
        expect(button.textContent?.trim()).toBe("count is 2")

        button.click()
        flushSync()
        expect(s.get(countAtom)).toBe(4)

        unmount(comp)
    })

    test("forwards the devtools name to store.txn", () => {
        const countAtom = atom(0)
        const s = store({ batchUpdates: true })
        let seenName: string | undefined
        const unsub = s.onChange((_changes, meta) => {
            seenName = meta.name
        })
        const run = transaction(s)
        run(({ set }) => set(countAtom, 1), "my-txn")
        expect(seenName).toBe("my-txn")
        unsub()
    })

    test("commits multiple writes atomically (one notification)", () => {
        const a = atom(0)
        const b = atom(0)
        const s = store({ batchUpdates: true })
        let commits = 0
        const unsub = s.onChange(() => commits++)

        const run = transaction(s)
        run(({ set }) => {
            set(a, 1)
            set(b, 2)
        })

        expect(s.get(a)).toBe(1)
        expect(s.get(b)).toBe(2)
        // Two writes, one commit → one onChange notification.
        expect(commits).toBe(1)
        unsub()
    })
})
