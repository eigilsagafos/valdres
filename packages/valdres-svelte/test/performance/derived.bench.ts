import { describe, test } from "bun:test"
import {
    atom as valdresAtom,
    selector as valdresSelector,
    store as valdresCreateStore,
} from "valdres"
import { atom as nanoAtom, computed as nanoComputed } from "nanostores"
import { compare } from "./bench-utils"

let sink: any

describe("selector vs nanostores computed", () => {
    test("creation", async () => {
        const vAtom = valdresAtom(0)
        const nAtom = nanoAtom(0)

        await compare(
            "create selector/computed",
            () => { sink = valdresSelector(get => get(vAtom) + 1) },
            () => { sink = nanoComputed(nAtom, v => v + 1) },
        )
    })

    test("set + read derived value", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vSel = valdresSelector(get => get(vAtom) + 1)
        vStore.get(vSel)

        const nAtom = nanoAtom(0)
        const nComp = nanoComputed(nAtom, v => v + 1)
        nComp.subscribe(() => {}) // activate

        let vInt = 0
        let nInt = 0
        await compare(
            "set + read derived",
            () => {
                vStore.set(vAtom, ++vInt)
                sink = vStore.get(vSel)
            },
            () => {
                nAtom.set(++nInt)
                sink = nComp.get()
            },
        )
    })

    test("set + read 10 derived values", async () => {
        const count = 10

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vSelectors = Array.from({ length: count }, (_, i) =>
            valdresSelector(get => get(vAtom) + i),
        )
        vSelectors.forEach(s => vStore.get(s))

        const nAtom = nanoAtom(0)
        const nComputed = Array.from({ length: count }, (_, i) =>
            nanoComputed(nAtom, v => v + i),
        )
        nComputed.forEach(c => c.subscribe(() => {}))

        let vInt = 0
        let nInt = 0
        await compare(
            "set + read 10 derived",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => { sink = vStore.get(s) })
            },
            () => {
                nAtom.set(++nInt)
                nComputed.forEach(c => { sink = c.get() })
            },
        )
    })

    test("chained computed (depth 5)", async () => {
        const vStore = valdresCreateStore()
        const vBase = valdresAtom(0)
        let vPrev: any = vBase
        for (let i = 0; i < 5; i++) {
            const dep = vPrev
            vPrev = valdresSelector(get => get(dep) + 1)
        }
        const vFinal = vPrev
        vStore.get(vFinal)

        const nBase = nanoAtom(0)
        let nPrev: any = nBase
        for (let i = 0; i < 5; i++) {
            nPrev = nanoComputed(nPrev, (v: number) => v + 1)
        }
        const nFinal = nPrev
        nFinal.subscribe(() => {})

        let vInt = 0
        let nInt = 0
        await compare(
            "set + read through 5 chained computed",
            () => {
                vStore.set(vBase, ++vInt)
                sink = vStore.get(vFinal)
            },
            () => {
                nBase.set(++nInt)
                sink = nFinal.get()
            },
        )
    })

    test("chained computed (depth 20)", async () => {
        const vStore = valdresCreateStore()
        const vBase = valdresAtom(0)
        let vPrev: any = vBase
        for (let i = 0; i < 20; i++) {
            const dep = vPrev
            vPrev = valdresSelector(get => get(dep) + 1)
        }
        const vFinal = vPrev
        vStore.get(vFinal)

        const nBase = nanoAtom(0)
        let nPrev: any = nBase
        for (let i = 0; i < 20; i++) {
            nPrev = nanoComputed(nPrev, (v: number) => v + 1)
        }
        const nFinal = nPrev
        nFinal.subscribe(() => {})

        let vInt = 0
        let nInt = 0
        await compare(
            "set + read through 20 chained computed",
            () => {
                vStore.set(vBase, ++vInt)
                sink = vStore.get(vFinal)
            },
            () => {
                nBase.set(++nInt)
                sink = nFinal.get()
            },
        )
    })
})
