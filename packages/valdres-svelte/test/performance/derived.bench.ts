import { describe, test } from "bun:test"
import {
    atom as valdresAtom,
    selector as valdresSelector,
    store as valdresCreateStore,
} from "valdres"
import { writable, derived } from "svelte/store"
import { compare } from "./bench-utils"

let sink: any

describe("selector vs derived", () => {
    test("creation", async () => {
        const vAtom = valdresAtom(0)
        const sWritable = writable(0)

        await compare(
            "create selector/derived",
            () => { sink = valdresSelector(get => get(vAtom) + 1) },
            () => { sink = derived(sWritable, $v => $v + 1) },
        )
    })

    test("set + read derived value", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vSel = valdresSelector(get => get(vAtom) + 1)
        vStore.get(vSel)

        const sWritable = writable(0)
        const sDerived = derived(sWritable, $v => $v + 1)
        let sDerivedValue = 1
        sDerived.subscribe(v => { sDerivedValue = v })

        let vInt = 0
        let sInt = 0
        await compare(
            "set + read derived",
            () => {
                vStore.set(vAtom, ++vInt)
                sink = vStore.get(vSel)
            },
            () => {
                sWritable.set(++sInt)
                sink = sDerivedValue
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

        const sWritable = writable(0)
        const sDerivedStores = Array.from({ length: count }, (_, i) =>
            derived(sWritable, $v => $v + i),
        )
        const sDerivedValues: number[] = new Array(count).fill(0)
        sDerivedStores.forEach((d, i) => d.subscribe(v => { sDerivedValues[i] = v }))

        let vInt = 0
        let sInt = 0
        await compare(
            "set + read 10 derived",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => { sink = vStore.get(s) })
            },
            () => {
                sWritable.set(++sInt)
                sDerivedValues.forEach(v => { sink = v })
            },
        )
    })

    test("chained derived (depth 5)", async () => {
        const vStore = valdresCreateStore()
        const vBase = valdresAtom(0)
        let vPrev: any = vBase
        for (let i = 0; i < 5; i++) {
            const dep = vPrev
            vPrev = valdresSelector(get => get(dep) + 1)
        }
        const vFinal = vPrev
        vStore.get(vFinal)

        const sBase = writable(0)
        let sPrev: any = sBase
        for (let i = 0; i < 5; i++) {
            sPrev = derived(sPrev, ($v: number) => $v + 1)
        }
        const sFinal = sPrev
        let sFinalValue = 5
        sFinal.subscribe((v: number) => { sFinalValue = v })

        let vInt = 0
        let sInt = 0
        await compare(
            "set + read through 5 chained derived",
            () => {
                vStore.set(vBase, ++vInt)
                sink = vStore.get(vFinal)
            },
            () => {
                sBase.set(++sInt)
                sink = sFinalValue
            },
        )
    })

    test("chained derived (depth 20)", async () => {
        const vStore = valdresCreateStore()
        const vBase = valdresAtom(0)
        let vPrev: any = vBase
        for (let i = 0; i < 20; i++) {
            const dep = vPrev
            vPrev = valdresSelector(get => get(dep) + 1)
        }
        const vFinal = vPrev
        vStore.get(vFinal)

        const sBase = writable(0)
        let sPrev: any = sBase
        for (let i = 0; i < 20; i++) {
            sPrev = derived(sPrev, ($v: number) => $v + 1)
        }
        const sFinal = sPrev
        let sFinalValue = 20
        sFinal.subscribe((v: number) => { sFinalValue = v })

        let vInt = 0
        let sInt = 0
        await compare(
            "set + read through 20 chained derived",
            () => {
                vStore.set(vBase, ++vInt)
                sink = vStore.get(vFinal)
            },
            () => {
                sBase.set(++sInt)
                sink = sFinalValue
            },
        )
    })
})
