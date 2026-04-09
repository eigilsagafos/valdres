import { describe, test } from "bun:test"
import { atom as valdresAtom, store as valdresCreateStore } from "valdres"
import { writable } from "svelte/store"
import { compare } from "./bench-utils"

let sink: any

describe("atom vs writable", () => {
    test("creation", async () => {
        await compare(
            "create atom/writable",
            () => { sink = valdresAtom(1) },
            () => { sink = writable(1) },
        )
    })

    test("get/read current value", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom("hello")
        const sWritable = writable("hello")
        let sValue: string = "hello"
        sWritable.subscribe(v => { sValue = v })

        await compare(
            "read current value",
            () => { sink = vStore.get(vAtom) },
            () => { sink = sValue },
        )
    })

    test("set (new value)", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const sWritable = writable(0)

        let vInt = 0
        let sInt = 0
        await compare(
            "set new value",
            () => vStore.set(vAtom, ++vInt),
            () => sWritable.set(++sInt),
        )
    })

    test("set (updater function)", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const sWritable = writable(0)

        await compare(
            "set via updater fn",
            () => vStore.set(vAtom, (c: number) => c + 1),
            () => sWritable.update(c => c + 1),
        )
    })

    test("set with 1 subscriber", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        vStore.sub(vAtom, () => {})

        const sWritable = writable(0)
        sWritable.subscribe(() => {})

        let vInt = 0
        let sInt = 0
        await compare(
            "set with 1 subscriber",
            () => vStore.set(vAtom, ++vInt),
            () => sWritable.set(++sInt),
        )
    })

    test("set with 10 subscribers", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        for (let i = 0; i < 10; i++) vStore.sub(vAtom, () => {})

        const sWritable = writable(0)
        for (let i = 0; i < 10; i++) sWritable.subscribe(() => {})

        let vInt = 0
        let sInt = 0
        await compare(
            "set with 10 subscribers",
            () => vStore.set(vAtom, ++vInt),
            () => sWritable.set(++sInt),
        )
    })

    test("set with 100 subscribers", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        for (let i = 0; i < 100; i++) vStore.sub(vAtom, () => {})

        const sWritable = writable(0)
        for (let i = 0; i < 100; i++) sWritable.subscribe(() => {})

        let vInt = 0
        let sInt = 0
        await compare(
            "set with 100 subscribers",
            () => vStore.set(vAtom, ++vInt),
            () => sWritable.set(++sInt),
        )
    })

    test("subscribe + unsubscribe", async () => {
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const sWritable = writable(0)

        await compare(
            "subscribe + unsubscribe",
            () => {
                const unsub = vStore.sub(vAtom, () => {})
                unsub()
            },
            () => {
                const unsub = sWritable.subscribe(() => {})
                unsub()
            },
        )
    })
})
