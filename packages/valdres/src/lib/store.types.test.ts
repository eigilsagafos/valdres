import { expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { getStoreData } from "./getStoreData"
import { store } from "../store"
import type { SetAtom, Store } from "../index"

type Expect<T extends true> = T
type Equal<X, Y> =
    (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
        ? true
        : false

test("store set returns the written value", () => {
    const root = store()
    const count = atom(0)
    const items = atomFamily<string, [string]>("")

    const countResult = root.set(count, current => current + 1)
    const itemResult = root.set(items("first"), "value")

    expect(countResult).toBe(1)
    expect(itemResult).toBe("value")

    type _CountResult = Expect<Equal<typeof countResult, number>>
    type _ItemResult = Expect<Equal<typeof itemResult, string>>
    type _PublicSetContract = Expect<Equal<Store["set"], SetAtom>>
})

test("batched store set returns the staged value", () => {
    const batched = store({ batchUpdates: true })
    const count = atom(0)

    const result = batched.set(count, current => current + 1)

    expect(result).toBe(1)
    type _Result = Expect<Equal<typeof result, number>>

    batched.dispose()
})

test("callback scopes expose a borrowed store without lifecycle ownership", () => {
    const root = store()
    const lease = root.scope("child")

    root.scope("child", borrowed => {
        expect("detach" in borrowed).toBe(false)
        if (false) {
            // @ts-expect-error callback scopes do not own a detach lease
            borrowed.detach()
            // @ts-expect-error callback scopes do not own store disposal
            borrowed.dispose()
        }
    })

    lease.detach()
    expect(getStoreData(root).scopes.has("child")).toBe(false)
})
