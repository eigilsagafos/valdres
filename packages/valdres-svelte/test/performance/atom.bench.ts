import { describe, test } from "bun:test"
import { atom as valdresAtom, store as valdresCreateStore } from "valdres"
import { atom as nanoAtom } from "nanostores"
import { compare } from "./bench-utils"

let sink: any

describe("atom vs nanostores atom", () => {
    test("creation", async () => {
        await compare(
            "create atom",
            () => { sink = valdresAtom(1) },
            () => { sink = nanoAtom(1) },
        )
    })

    test("get current value", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom("hello")
        const nAtom = nanoAtom("hello")

        await compare(
            "get current value",
            () => { sink = vStore.get(vAtom) },
            () => { sink = nAtom.get() },
        )
    })

    test("set (new value)", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const nAtom = nanoAtom(0)

        let vInt = 0
        let nInt = 0
        await compare(
            "set new value",
            () => vStore.set(vAtom, ++vInt),
            () => nAtom.set(++nInt),
        )
    })

    test("set (updater function)", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const nAtom = nanoAtom(0)

        await compare(
            "set via updater fn",
            () => vStore.set(vAtom, (c: number) => c + 1),
            // nanostores doesn't have updater — read + set
            () => nAtom.set(nAtom.get() + 1),
        )
    })

    test("set with 1 subscriber", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        vStore.sub(vAtom, () => {})

        const nAtom = nanoAtom(0)
        nAtom.subscribe(() => {})

        let vInt = 0
        let nInt = 0
        await compare(
            "set with 1 subscriber",
            () => vStore.set(vAtom, ++vInt),
            () => nAtom.set(++nInt),
        )
    })

    test("set with 10 subscribers", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        for (let i = 0; i < 10; i++) vStore.sub(vAtom, () => {})

        const nAtom = nanoAtom(0)
        for (let i = 0; i < 10; i++) nAtom.subscribe(() => {})

        let vInt = 0
        let nInt = 0
        await compare(
            "set with 10 subscribers",
            () => vStore.set(vAtom, ++vInt),
            () => nAtom.set(++nInt),
        )
    })

    test("set with 100 subscribers", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        for (let i = 0; i < 100; i++) vStore.sub(vAtom, () => {})

        const nAtom = nanoAtom(0)
        for (let i = 0; i < 100; i++) nAtom.subscribe(() => {})

        let vInt = 0
        let nInt = 0
        await compare(
            "set with 100 subscribers",
            () => vStore.set(vAtom, ++vInt),
            () => nAtom.set(++nInt),
        )
    })

    test("subscribe + unsubscribe", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const nAtom = nanoAtom(0)

        await compare(
            "subscribe + unsubscribe",
            () => {
                const unsub = vStore.sub(vAtom, () => {})
                unsub()
            },
            () => {
                const unsub = nAtom.subscribe(() => {})
                unsub()
            },
        )
    })
})
