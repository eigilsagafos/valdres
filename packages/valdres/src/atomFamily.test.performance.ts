import { describe, test, expect, mock } from "bun:test"
import { store } from "./store"
import { atomFamily } from "./atomFamily"

describe("atomFamily", () => {
    test("fails of atom does not match family", () => {
        const rootStore = store()
        const userFamily = atomFamily<string, [number]>(id => ({ id }))
        const otherFamliy = atomFamily<string, [number]>(id => ({ id }))

        expect(() => {
            rootStore.txn(txn => {
                txn.batchSetFamilyAtoms(userFamily, [
                    [otherFamliy(1), "user 1"],
                ])
            })
        }).toThrowError("Atom does not belong to the provided family")
    })

    test("set 1000 atoms in txn", () => {
        const rootStore = store()
        const userFamily = atomFamily<string, [number]>(id => ({ id }))

        const start = performance.now()
        rootStore.txn(txn => {
            const pairs = []
            for (let i = 0; i < 100_000; i++) {
                const userAtom = userFamily(i)
                pairs.push([userAtom, `user ${i}`])
            }
            txn.batchSetFamilyAtoms(userFamily, pairs)
        })
        const end = performance.now()
        console.log(`Setting 100,000 atoms took ${end - start} ms`)
        expect(rootStore.get(userFamily)).toHaveLength(100_000)
        expect(rootStore.get(userFamily(1))).toBe("user 1")
    })
})
