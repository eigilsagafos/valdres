import { describe, test } from "bun:test"
import {
    atom as valdresAtom,
    selector as valdresSelector,
    store as valdresCreateStore,
} from "valdres"
import { writable, derived, get as svelteGet } from "svelte/store"
import { compare } from "./bench-utils"

let sink: any

describe("transaction vs batch", () => {
    test("set 10 atoms individually", async () => {
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: 10 }, () => valdresAtom(0))

        const sWritables = Array.from({ length: 10 }, () => writable(0))

        let vInt = 0
        let sInt = 0
        await compare(
            "set 10 atoms individually",
            () => { vAtoms.forEach(a => vStore.set(a, ++vInt)) },
            () => { sWritables.forEach(w => w.set(++sInt)) },
        )
    })

    test("set 10 atoms in transaction", async () => {
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: 10 }, () => valdresAtom(0))

        const sWritables = Array.from({ length: 10 }, () => writable(0))

        let vInt = 0
        let sInt = 0
        await compare(
            "set 10 atoms in txn (valdres) vs sequential (svelte)",
            () => {
                vStore.txn(({ set }) => {
                    vAtoms.forEach(a => set(a, ++vInt))
                })
            },
            () => {
                // Svelte stores don't have transactions — sequential sets
                sWritables.forEach(w => w.set(++sInt))
            },
        )
    })

    test("set 10 atoms with 10 derived each, with subscribers", async () => {
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: 10 }, () => valdresAtom(0))
        const vSelectors = vAtoms.map(a => valdresSelector(get => get(a) * 2))
        vSelectors.forEach(s => vStore.sub(s, () => {}))

        const sWritables = Array.from({ length: 10 }, () => writable(0))
        const sDerived = sWritables.map(w => derived(w, $v => $v * 2))
        sDerived.forEach(d => d.subscribe(() => {}))

        let vInt = 0
        let sInt = 0
        await compare(
            "set 10 atoms + derived subscribers",
            () => {
                vStore.txn(({ set }) => {
                    vAtoms.forEach(a => set(a, ++vInt))
                })
            },
            () => {
                sWritables.forEach(w => w.set(++sInt))
            },
        )
    })
})
