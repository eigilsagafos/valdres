import { getStoreData } from "./getStoreData"
import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { cleanUpRejectedPromise } from "./asyncDependencyTracking"
import { deleteFamilyAtom } from "./deleteFamilyAtom"
import { trackStateRevision } from "./stateRevisions"

describe("state revisions", () => {
    test("a repeated direct family deletion only records the real deletion", () => {
        const rootStore = store()
        const family = atomFamily(0)
        const member = family(1)
        rootStore.get(member)
        trackStateRevision(member, getStoreData(rootStore))

        deleteFamilyAtom(member, getStoreData(rootStore))
        expect(getStoreData(rootStore).stateRevisionClock.current).toBe(1)

        deleteFamilyAtom(member, getStoreData(rootStore))
        expect(getStoreData(rootStore).stateRevisionClock.current).toBe(1)
    })

    test("a repeated transaction deletion does not record a no-op", () => {
        const rootStore = store()
        const family = atomFamily(0)
        const member = family(1)
        rootStore.get(member)
        trackStateRevision(member, getStoreData(rootStore))

        rootStore.txn(({ del }) => {
            del(member)
            expect(getStoreData(rootStore).stateRevisionClock.current).toBe(0)
        })
        expect(getStoreData(rootStore).stateRevisionClock.current).toBe(1)

        rootStore.txn(({ del }) => del(member))
        expect(getStoreData(rootStore).stateRevisionClock.current).toBe(1)
    })

    test("global reset does not record a value that was already absent", () => {
        const rootStore = store()
        const valueAtom = atom(0, { global: true })
        rootStore.get(valueAtom)
        trackStateRevision(valueAtom, getStoreData(rootStore))
        getStoreData(rootStore).values.delete(valueAtom)

        valueAtom.resetSelf()

        expect(getStoreData(rootStore).stateRevisionClock.current).toBe(0)
    })

    test("rejected selector cleanup does not record an absent value", () => {
        const rootStore = store()
        const valueSelector = selector(() => 1)
        const rejected = Promise.reject(new Error("expected rejection"))
        rejected.catch(() => {})
        trackStateRevision(valueSelector, getStoreData(rootStore))

        cleanUpRejectedPromise(valueSelector, getStoreData(rootStore), rejected)

        expect(getStoreData(rootStore).stateRevisionClock.current).toBe(0)
    })
})
