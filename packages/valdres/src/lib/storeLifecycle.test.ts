import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"
import { createStoreData } from "./createStoreData"
import { disposeStoreData } from "./disposeStoreData"
import { getStoreData } from "./getStoreData"
import { storeFromStoreData } from "./storeFromStoreData"
import { DISPOSED_STORE_PENDING } from "./storeLifecycle"
import {
    DISPOSED_STORE_RESOURCES,
    isStoreDisposed,
    peekStoreResources,
    trackAbortController,
    trackStoreCleanup,
    trackStoreMount,
} from "./storeLifecycle"

describe("store resource sidecar", () => {
    test("resources acquired before a facade exists survive into disposal", () => {
        // Raw StoreData can acquire resources before storeFromStoreData ever
        // runs. That used to need a second "pending lifecycle" slot; now the
        // ledger simply lives on the store data from the start.
        const data = createStoreData("pre-facade")
        expect(data.resources).toBeUndefined()

        const cleanup = mock(() => {})
        trackStoreCleanup(data, cleanup)
        const controller = new AbortController()
        trackAbortController(data, controller)
        expect(peekStoreResources(data)?.cleanups?.size).toBe(1)

        // The facade built afterwards must see the same ledger.
        const facade = storeFromStoreData(data)
        expect(getStoreData(facade)).toBe(data)
        expect(peekStoreResources(data)?.cleanups?.size).toBe(1)

        facade.dispose()
        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(controller.signal.aborted).toBe(true)
        expect(isStoreDisposed(data)).toBe(true)
    })

    test("a disposed store keeps its terminal marker and never resurrects it", () => {
        const store1 = store()
        const a = atom(0)
        store1.sub(a, () => {})
        store1.dispose()

        const data = getStoreData(store1)
        expect(data.resources).toBe(DISPOSED_STORE_RESOURCES)
        expect(isStoreDisposed(data)).toBe(true)

        // Every acquisition path must refuse to allocate a fresh ledger over
        // the sentinel — that would report a dead store as live again.
        const late = mock(() => {})
        trackStoreCleanup(data, late)
        expect(late).toHaveBeenCalledTimes(1) // unwound immediately, not stored
        const controller = new AbortController()
        trackAbortController(data, controller)
        expect(controller.signal.aborted).toBe(true)
        expect(trackStoreMount(data, a)).toBe(false)
        expect(() => store1.txn(() => {})).toThrow(/disposed/i)

        expect(data.resources).toBe(DISPOSED_STORE_RESOURCES)
        expect(isStoreDisposed(data)).toBe(true)
        expect(peekStoreResources(data)).toBeUndefined()
    })

    test("re-disposal is idempotent and leaves the marker in place", () => {
        const store1 = store()
        store1.dispose()
        const data = getStoreData(store1)
        expect(() => store1.dispose()).not.toThrow()
        expect(data.resources).toBe(DISPOSED_STORE_RESOURCES)
    })

    test("the two disposal markers agree across the sidecar boundary", () => {
        // `isStoreDisposed` is the authoritative status (resource sidecar);
        // `pendingOrphanCleanup === DISPOSED_STORE_PENDING` is the single-load
        // guard the facade's hot path uses (graph plane). They live in
        // different sidecars now, so they must be asserted to agree.
        const root = store()
        const child = root.scope("marker-parity")
        const rootData = getStoreData(root)
        const childData = getStoreData(child)

        for (const data of [rootData, childData]) {
            expect(isStoreDisposed(data)).toBe(false)
            expect(data.pendingOrphanCleanup).not.toBe(DISPOSED_STORE_PENDING)
        }

        root.dispose()

        for (const data of [rootData, childData]) {
            expect(isStoreDisposed(data)).toBe(true)
            expect(data.pendingOrphanCleanup).toBe(DISPOSED_STORE_PENDING)
        }
    })

    test("an open transaction is cancelled through the generic cancellable", () => {
        // disposeStoreData knows nothing about TransactionContext — it drains
        // whatever is registered and cancels it through the shared symbol.
        const data = createStoreData("cancellable")
        const facade = storeFromStoreData(data)
        const a = atom(0)
        let captured: { set: (state: any, value: any) => void } | undefined
        expect(() =>
            facade.txn(txn => {
                captured = txn as any
                txn.set(a, 1)
                disposeStoreData(data)
            }),
        ).toThrow(/disposed/i)
        // The context was closed by disposal, so further work is rejected.
        expect(() => captured!.set(a, 2)).toThrow()
        expect(peekStoreResources(data)).toBeUndefined()
    })
})
