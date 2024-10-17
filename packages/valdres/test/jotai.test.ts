import {describe, test, expect} from "bun:test"
import {createStore, atom} from "jotai"
import {atomFamily} from "jotai/utils"
import { wait } from "./utils/wait"


describe("jotai", () => {
    test("one", async () => {
        const userIdAtom = atom(1)
        const testAtom = atom(async (get) => {
            get(userIdAtom)
            await wait(1)
            return "foo"
        })
        const store = createStore()
        const res = store.get(testAtom)
        // console.log(res)
        await wait(1)
        // console.log(store.get(testAtom))
        await wait(1)
        // console.log(store.get(testAtom))
        
        const testAtom2 = atom((get) => {
            return get(testAtom)
        })
        // console.log(store.get(testAtom2))
        store.sub(testAtom2, () => {
            console.log(`upd[ate]`)
        })
        await wait(1)
        
    })

    test.only("store sub", () => {
        const store = createStore()
        const atom1 = atom(["1"])
        const family = atomFamily((id) => atom())
        store.set(family("1"), { id: "1"})
        store.sub(atom1, () => {
            store.get(atom1).map(id => store.sub(family(id), () => { console.log(`child callback`, id)}))
            console.log("callback1")
        })
        
        store.set(atom1, curr => [...curr, "2"])
        store.set(family("2"), { id: "2"})
        store.set(atom1, curr => [...curr, "3"])
        store.set(family("3"), { id: "3"})
        store.set(atom1, curr => [...curr, "4"])
        store.set(family("4"), { id: "4"})
        store.set(family("2"), { id: "2"})
        // store.set(family("2"), { id: "1"})

    })
})
