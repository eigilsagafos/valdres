import { describe, test } from "bun:test"
import {
    atom as valdresAtom,
    selector as valdresSelector,
    store as valdresCreateStore,
} from "valdres"
import { atom as nanoAtom, computed as nanoComputed, batched as nanoBatched } from "nanostores"
import { compare } from "./bench-utils"

let sink: any

describe("transaction vs nanostores batched", () => {
    test("set 10 atoms individually", async () => {
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: 10 }, () => valdresAtom(0))

        const nAtoms = Array.from({ length: 10 }, () => nanoAtom(0))

        let vInt = 0
        let nInt = 0
        await compare(
            "set 10 atoms individually",
            () => { vAtoms.forEach(a => vStore.set(a, ++vInt)) },
            () => { nAtoms.forEach(a => a.set(++nInt)) },
        )
    })

    test("set 10 atoms in transaction (valdres) vs sequential (nanostores)", async () => {
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: 10 }, () => valdresAtom(0))

        const nAtoms = Array.from({ length: 10 }, () => nanoAtom(0))

        let vInt = 0
        let nInt = 0
        await compare(
            "set 10 atoms in txn vs sequential",
            () => {
                vStore.txn(({ set }) => {
                    vAtoms.forEach(a => set(a, ++vInt))
                })
            },
            () => {
                nAtoms.forEach(a => a.set(++nInt))
            },
        )
    })

    test("set 10 atoms with derived + subscribers", async () => {
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: 10 }, () => valdresAtom(0))
        const vSelectors = vAtoms.map(a => valdresSelector(get => get(a) * 2))
        vSelectors.forEach(s => vStore.sub(s, () => {}))

        const nAtoms = Array.from({ length: 10 }, () => nanoAtom(0))
        const nComputed = nAtoms.map(a => nanoComputed(a, v => v * 2))
        nComputed.forEach(c => c.subscribe(() => {}))

        let vInt = 0
        let nInt = 0
        await compare(
            "set 10 atoms + derived subscribers",
            () => {
                vStore.txn(({ set }) => {
                    vAtoms.forEach(a => set(a, ++vInt))
                })
            },
            () => {
                nAtoms.forEach(a => a.set(++nInt))
            },
        )
    })

    test("batched derived from multiple atoms", async () => {
        const vStore = valdresCreateStore()
        const vA = valdresAtom(0)
        const vB = valdresAtom(0)
        const vC = valdresAtom(0)
        const vSel = valdresSelector(get => get(vA) + get(vB) + get(vC))
        vStore.sub(vSel, () => {})

        const nA = nanoAtom(0)
        const nB = nanoAtom(0)
        const nC = nanoAtom(0)
        const nBatched = nanoBatched([nA, nB, nC], (a, b, c) => a + b + c)
        nBatched.subscribe(() => {})

        let vInt = 0
        let nInt = 0
        await compare(
            "update 3 atoms feeding 1 batched derived",
            () => {
                vStore.txn(({ set }) => {
                    set(vA, ++vInt)
                    set(vB, ++vInt)
                    set(vC, ++vInt)
                })
            },
            () => {
                nA.set(++nInt)
                nB.set(++nInt)
                nC.set(++nInt)
            },
        )
    })
})
