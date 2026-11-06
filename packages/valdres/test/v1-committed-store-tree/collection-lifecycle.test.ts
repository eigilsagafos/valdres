import { describe, expect, test } from "bun:test"
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

describe("v1 committed collection row lifecycle", () => {
    test("Present and Absent ownership restores inherited state on reset", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const row = sessions("owned")
        runCollectionTransaction(domain, root, (_tx, rows) => rows.set(row, 1))
        expect(read(root, row)).toBe(1)
        expect(read(child, row)).toBe(1)
        runCollectionTransaction(domain, root, (_tx, rows) => rows.scope(child).delete(row))
        expect(read(child, row)).toBeUndefined()
        expect(read(root, row)).toBe(1)
        runCollectionTransaction(domain, root, (_tx, rows) => rows.scope(child).reset(row))
        expect(read(child, row)).toBe(1)
        runCollectionTransaction(domain, root, (_tx, rows) => rows.reset(row))
        expect(read(root, row)).toBeUndefined()
        expect(read(child, row)).toBeUndefined()
    })

    test("scope disposal detaches MembershipRecord routes exactly once", () => {
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
        row = undefined

        child.dispose()
        expect(instrumentation.read("routeRemoves")).toBe(
            routeRemovesBefore + 1,
        )
        child.dispose()
        expect(instrumentation.read("routeRemoves")).toBe(
            routeRemovesBefore + 1,
        )
    }, 15_000)

    test("cold RowViews remain empty across inherited reset", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        ;(() => {
            let row: ReturnType<typeof sessions> | undefined = sessions("cold")
            expect(read(child, row)).toBeUndefined()
            row = undefined
        })()

        runCollectionTransaction(domain, root, (_tx, rows) => rows.set(sessions("cold"), 1))
        expect(read(child, sessions("cold"))).toBe(1)
        runCollectionTransaction(domain, root, (_tx, rows) => rows.reset(sessions("cold")))
        expect(read(root, sessions("cold"))).toBeUndefined()
        expect(read(child, sessions("cold"))).toBeUndefined()
        expect(root).toBeDefined()
        expect(child).toBeDefined()
    })

    test("closed collection cursors reject writes after the row is reset", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, object>(domain)
        const row = sessions("retained-draft")
        const store = domain.createStoreTree()
        let transaction: RootTransaction | undefined
        let writer: RootTransaction | undefined
        ;(() => {
            let value: object | undefined = Object.freeze({ private: true })
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
        })()

        expect(read(store, row)).toBeUndefined()
        expect(transaction).toBeDefined()
        expect(() => writer!.set(row, {})).toThrow(TransactionClosedError)
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
