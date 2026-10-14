import { afterAll, describe, expect, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../../test/src/LeakDetector"
import { flushRetentionCapture } from "../../../test/src/retentionCapture"
afterAll(flushRetentionCapture)
import {
    StoreDisposedError,
    TransactionClosedError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    type CommittedStoreTree,
    type RootTransaction,
    type State,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createCollectionDefinition } from "../../src/v1-internal/collection"
import { runCollectionTransaction } from "./collection-test-transaction"

const read = (store: CommittedStoreTree, state: State<any>): any =>
    store.get(state)

const expectRetained = async (detector: LeakDetector, label?: string): Promise<void> => {
    retentionPhase(label, "retention-await-enter")
    const leaking = await detector.isLeaking(10, label)
    retentionPhase(label, leaking ? "retention-await-return-live" : "retention-await-return-collected")
    expect(leaking).toBe(true)
}

const expectCollected = async (detector: LeakDetector, label?: string): Promise<void> => {
    let leaking = true
    for (let attempt = 0; attempt < 3 && leaking; attempt++) {
        retentionPhase(label, "collection-await-enter", attempt)
        leaking = await detector.isLeaking(undefined, label)
        retentionPhase(label, leaking ? "collection-await-return-live" : "collection-await-return-collected", attempt)
    }
    expect(leaking).toBe(false)
}

describe("v1 committed collection row lifecycle", () => {
    test("pins Present and Absent owners until reset", async () => {
        retentionPhase("collection-test", `start platform=${process.platform} arch=${process.arch} bun=${Bun.version}`)
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const root = domain.createStoreTree()
        const child = root.scope("child")

        const present = (() => {
            let row: ReturnType<typeof sessions> | undefined =
                sessions("present")
            const detector = new LeakDetector(row, "present")
            const reference = new WeakRef(row)
            runCollectionTransaction(domain, root, (_txn, rows) =>
                rows.set(row!, 1),
            )
            row = undefined
            return { detector, reference }
        })()
        retentionPhase("present-owned", "ownership-created")
        await expectRetained(present.detector, "present-owned")
        retentionPhase("present-released", "reset-enter")
        ;(() => {
            const row = sessions("present")
            expect(present.reference.deref()).toBe(row)
            runCollectionTransaction(domain, root, (_txn, rows) =>
                rows.reset(row),
            )
        })()
        retentionPhase("present-released", "reset-return")
        await expectCollected(present.detector, "present-released")

        const absent = (() => {
            let row: ReturnType<typeof sessions> | undefined =
                sessions("absent")
            const detector = new LeakDetector(row, "absent")
            const reference = new WeakRef(row)
            runCollectionTransaction(domain, root, (_txn, rows) =>
                rows.scope(child).delete(row!),
            )
            row = undefined
            return { detector, reference }
        })()
        retentionPhase("absent-owned", "ownership-created")
        await expectRetained(absent.detector, "absent-owned")
        retentionPhase("absent-released", "reset-enter")
        ;(() => {
            const row = sessions("absent")
            expect(absent.reference.deref()).toBe(row)
            runCollectionTransaction(domain, root, (_txn, rows) =>
                rows.scope(child).reset(row),
            )
        })()
        retentionPhase("absent-released", "reset-return")
        await expectCollected(absent.detector, "absent-released")
        retentionPhase("collection-test", "complete")
    }, 15_000)

    test("scope disposal releases pins and detaches MembershipRecord routes exactly once", async () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const sessions = createCollectionDefinition<string, number>(domain)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        let row: ReturnType<typeof sessions> | undefined = sessions("owned")
        expect(read(child, sessions)).toEqual([])
        const membershipRouteAdds = instrumentation.read("routeAdds")

        runCollectionTransaction(domain, root, (_txn, rows) =>
            rows.scope(child).set(row!, 1),
        )
        expect(instrumentation.read("routeAdds")).toBe(membershipRouteAdds)
        expect(read(child, row)).toBe(1)
        expect(instrumentation.read("routeAdds")).toBe(membershipRouteAdds)

        runCollectionTransaction(domain, root, (_txn, rows) =>
            rows.scope(child).reset(row!),
        )
        expect(read(child, row)).toBeUndefined()
        expect(instrumentation.read("routeAdds")).toBe(membershipRouteAdds + 1)

        runCollectionTransaction(domain, root, (_txn, rows) =>
            rows.scope(child).set(row!, 2),
        )
        const routeRemovesBefore = instrumentation.read("routeRemoves")
        const detector = new LeakDetector(row)
        row = undefined
        await expectRetained(detector)

        child.dispose()
        expect(instrumentation.read("routeRemoves")).toBe(
            routeRemovesBefore + 1,
        )
        child.dispose()
        expect(instrumentation.read("routeRemoves")).toBe(
            routeRemovesBefore + 1,
        )
        await expectCollected(detector)
    }, 15_000)

    test("cold RowViews and their inherited route do not retain row definitions", async () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const detector = (() => {
            let row: ReturnType<typeof sessions> | undefined = sessions("cold")
            const detector = new LeakDetector(row)
            expect(read(child, row)).toBeUndefined()
            row = undefined
            return detector
        })()

        await expectCollected(detector)
        expect(root).toBeDefined()
        expect(child).toBeDefined()
    })

    test("releases a successful row lane retained by its closed cursor and writer", async () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, object>(domain)
        const row = sessions("retained-draft")
        const store = domain.createStoreTree()
        let transaction: RootTransaction | undefined
        let writer: RootTransaction | undefined
        const detector = (() => {
            let value: object | undefined = Object.freeze({ private: true })
            const detector = new LeakDetector(value)
            runCollectionTransaction(
                domain,
                store,
                (currentTransaction, rows) => {
                    transaction = currentTransaction
                    writer = rows
                    rows.set(row, value!)
                },
            )
            runCollectionTransaction(domain, store, (_txn, rows) =>
                rows.reset(row),
            )
            value = undefined
            return detector
        })()

        expect(transaction).toBeDefined()
        expect(() => writer!.set(row, {})).toThrow(TransactionClosedError)
        await expectCollected(detector)
    }, 15_000)

    test("keeps same-domain definitions isolated across Store disposal", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("shared")
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        runCollectionTransaction(domain, first, (_txn, rows) =>
            rows.set(row, 1),
        )
        runCollectionTransaction(domain, second, (_txn, rows) =>
            rows.set(row, 2),
        )

        first.dispose()
        expect(() => read(first, row)).toThrow(StoreDisposedError)
        expect(read(second, row)).toBe(2)
        runCollectionTransaction(domain, second, (_txn, rows) =>
            rows.set(row, 3),
        )
        expect(read(second, row)).toBe(3)
    })

    test("materializes, settles, and disposes a deep inheritance chain iteratively", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("deep")
        const root = domain.createStoreTree()
        const scopes: CommittedStoreTree[] = [root]
        for (let index = 0; index < 1_024; index++) {
            scopes.push(scopes[scopes.length - 1]!.scope())
        }
        const leaf = scopes[scopes.length - 1]!

        runCollectionTransaction(domain, root, (_txn, rows) => rows.set(row, 1))
        expect(read(leaf, row)).toBe(1)
        runCollectionTransaction(domain, root, (_txn, rows) => rows.set(row, 2))
        expect(read(leaf, row)).toBe(2)

        root.dispose()
        expect(() => read(leaf, row)).toThrow(StoreDisposedError)
    })
})
