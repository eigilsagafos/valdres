import { describe, expect, test } from "bun:test"
import {
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    getCollectionKernel,
    runInternalCollectionTransaction,
    type CommittedStoreTree,
    type RootTransaction,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import type { CollectionDraftKernel } from "../../src/v1-internal/collection-kernel"
import { createCollectionDefinition } from "../../src/v1-internal/collection"

type InternalRead = (state: object) => any

const read = <Value>(store: CommittedStoreTree, state: object): Value =>
    (store.get as unknown as InternalRead)(state) as Value

const readTransaction = <Value>(
    transaction: RootTransaction,
    state: object,
): Value => (transaction.get as unknown as InternalRead)(state) as Value

describe("v1 committed collection membership", () => {
    test("keeps frozen coordinate-local committed identities and transaction-private changed snapshots", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const b = sessions("b")
        const root = domain.createStoreTree()
        const child = root.scope("child")

        const rootEmpty = read<readonly object[]>(root, sessions)
        const childEmpty = read<readonly object[]>(child, sessions)
        expect(rootEmpty).toEqual([])
        expect(Object.isFrozen(rootEmpty)).toBe(true)
        expect(Object.isFrozen(childEmpty)).toBe(true)
        expect(childEmpty).not.toBe(rootEmpty)
        expect(read<readonly object[]>(root, sessions)).toBe(rootEmpty)
        expect(read<readonly object[]>(child, sessions)).toBe(childEmpty)

        runInternalCollectionTransaction(domain, root, transaction => {
            expect(readTransaction<readonly object[]>(transaction, sessions)).toBe(
                rootEmpty,
            )
        })

        let draftRows: readonly object[] | undefined
        runInternalCollectionTransaction(domain, root, (transaction, rows) => {
            rows.set(a, 1)
            draftRows = readTransaction<readonly object[]>(
                transaction,
                sessions,
            )
            expect(draftRows).toEqual([a])
            expect(
                readTransaction<readonly object[]>(transaction, sessions),
            ).toBe(draftRows)
        })
        const committedA = read<readonly object[]>(root, sessions)
        expect(committedA).toEqual([a])
        expect(committedA).not.toBe(rootEmpty)
        expect(committedA).not.toBe(draftRows)
        expect(Object.isFrozen(committedA)).toBe(true)

        runInternalCollectionTransaction(domain, root, (transaction, rows) => {
            rows.set(b, 2)
            rows.update(a, value => (value as number) + 1)
            expect(
                readTransaction<readonly object[]>(transaction, sessions),
            ).toEqual([a, b])
        })
        const committedAB = read<readonly object[]>(root, sessions)
        expect(committedAB).toEqual([a, b])
        runInternalCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.update(a, value => (value as number) + 1),
        )
        expect(read<readonly object[]>(root, sessions)).toBe(committedAB)
    })

    test("restarts placement after a true draft gap and never publishes the scratch array", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const b = sessions("b")
        const root = domain.createStoreTree()
        runInternalCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.set(a, 1)
            rows.set(b, 2)
        })
        const baseline = read<readonly object[]>(root, sessions)
        const epoch = instrumentation.read("sourceEpoch")

        let afterGap: readonly object[] | undefined
        runInternalCollectionTransaction(domain, root, (transaction, rows) => {
            rows.delete(a)
            expect(
                readTransaction<readonly object[]>(transaction, sessions),
            ).toEqual([b])
            rows.set(a, 1)
            afterGap = readTransaction<readonly object[]>(
                transaction,
                sessions,
            )
            expect(afterGap).toEqual([b, a])
            expect(
                readTransaction<readonly object[]>(transaction, sessions),
            ).toBe(afterGap)
        })
        const committed = read<readonly object[]>(root, sessions)
        expect(committed).toEqual([b, a])
        expect(committed).not.toBe(baseline)
        expect(committed).not.toBe(afterGap)
        expect(instrumentation.read("sourceEpoch")).toBe(epoch + 1)

        runInternalCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.delete(b)
            rows.set(b, 2)
        })
        expect(read<readonly object[]>(root, sessions)).toEqual([a, b])
    })

    test("restores the exact committed baseline after an intermediate changed draft read", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const root = domain.createStoreTree()
        const empty = read<readonly object[]>(root, sessions)
        let changed: readonly object[] | undefined

        runInternalCollectionTransaction(domain, root, (transaction, rows) => {
            rows.set(row, 1)
            changed = readTransaction<readonly object[]>(transaction, sessions)
            expect(changed).toEqual([row])
            expect(changed).not.toBe(empty)
            rows.delete(row)
            expect(
                readTransaction<readonly object[]>(transaction, sessions),
            ).toBe(empty)
        })

        expect(read<readonly object[]>(root, sessions)).toBe(empty)
        expect(changed).toBeDefined()
    })

    test("appends a row reinserted by a later commit without mutating old arrays", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const b = sessions("b")
        const root = domain.createStoreTree()
        runInternalCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.set(a, 1)
            rows.set(b, 2)
        })
        const original = read<readonly object[]>(root, sessions)

        runInternalCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.delete(a),
        )
        const removed = read<readonly object[]>(root, sessions)
        expect(removed).toEqual([b])
        expect(original).toEqual([a, b])

        runInternalCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(a, 3),
        )
        const reinserted = read<readonly object[]>(root, sessions)
        expect(reinserted).toEqual([b, a])
        expect(reinserted).not.toBe(original)
        expect(reinserted).not.toBe(removed)
        expect(removed).toEqual([b])
        expect(original).toEqual([a, b])
    })

    test("materializes unread child ownership history and preserves its slot through parent churn", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const b = sessions("b")
        const root = domain.createStoreTree()
        const equalChild = root.scope("equal")
        const unequalChild = root.scope("unequal")
        runInternalCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.set(a, 1)
            rows.set(b, 2)
        })

        runInternalCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.scope(equalChild).set(a, 1)
            rows.scope(unequalChild).set(a, 10)
        })
        runInternalCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.delete(a),
        )
        const equalRows = read<readonly object[]>(equalChild, sessions)
        const unequalRows = read<readonly object[]>(unequalChild, sessions)
        expect(equalRows).toEqual([a, b])
        expect(unequalRows).toEqual([a, b])
        expect(read<readonly object[]>(root, sessions)).toEqual([b])

        runInternalCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(a, 3),
        )
        expect(read<readonly object[]>(root, sessions)).toEqual([b, a])
        expect(read<readonly object[]>(equalChild, sessions)).toBe(equalRows)
        expect(read<readonly object[]>(unequalChild, sessions)).toBe(
            unequalRows,
        )

        runInternalCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.scope(equalChild).reset(a)
            rows.scope(unequalChild).reset(a)
        })
        expect(read<readonly object[]>(equalChild, sessions)).toBe(equalRows)
        expect(read<readonly object[]>(unequalChild, sessions)).toBe(
            unequalRows,
        )
        expect(read<number>(equalChild, a)).toBe(3)
        expect(read<number>(unequalChild, a)).toBe(3)
    })

    test("tombstone reset appends and cross-scope enabling follows statement order", () => {
        for (const rootFirst of [false, true]) {
            const domain = createCommittedStoreTreeDomain()
            const sessions = createCollectionDefinition<string, number>(domain)
            const a = sessions("a")
            const b = sessions("b")
            const root = domain.createStoreTree()
            const child = root.scope("child")
            runInternalCollectionTransaction(domain, root, (_txn, rows) =>
                rows.scope(child).delete(a),
            )

            runInternalCollectionTransaction(domain, root, (_txn, rows) => {
                if (rootFirst) {
                    rows.set(a, 1)
                    rows.set(b, 2)
                    rows.scope(child).reset(a)
                } else {
                    rows.scope(child).reset(a)
                    rows.set(a, 1)
                    rows.set(b, 2)
                }
            })
            expect(read<readonly object[]>(child, sessions)).toEqual(
                rootFirst ? [b, a] : [a, b],
            )
        }

        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const b = sessions("b")
        const root = domain.createStoreTree()
        const child = root.scope("child")
        runInternalCollectionTransaction(domain, root, (_txn, rows) => {
            rows.set(a, 1)
            rows.set(b, 2)
            rows.scope(child).delete(a)
        })
        expect(read<readonly object[]>(child, sessions)).toEqual([b])
        runInternalCollectionTransaction(domain, root, (_txn, rows) =>
            rows.scope(child).reset(a),
        )
        expect(read<readonly object[]>(child, sessions)).toEqual([b, a])
    })

    test("keeps virtual membership planning inert across callback abort and Atom preflight failure", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const abort = new Error("abort")
        const preflight = new Error("preflight")
        const guarded = domain.atom(0, {
            equal: () => {
                throw preflight
            },
        })

        expect(() =>
            runInternalCollectionTransaction(domain, root, (_txn, rows) => {
                rows.scope(child).set(a, 1)
                throw abort
            }),
        ).toThrow(abort)
        expect(instrumentation.read("routeAdds")).toBe(0)

        expect(() =>
            runInternalCollectionTransaction(domain, root, (txn, rows) => {
                rows.scope(child).set(a, 1)
                txn.set(guarded, 1)
            }),
        ).toThrow(preflight)
        expect(instrumentation.read("routeAdds")).toBe(0)
        expect(read<readonly object[]>(child, sessions)).toEqual([])
        expect(instrumentation.read("routeAdds")).toBe(1)
    })

    test("rebuilds each existing MembershipRecord once across overlapping routes", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const b = sessions("b")
        const c = sessions("c")
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const descendant = child.scope("descendant")
        read(root, sessions)
        read(child, sessions)
        read(descendant, sessions)
        const kernel = getCollectionKernel(domain) as CollectionDraftKernel
        const finishTrace = kernel.beginMembershipRebuildTraceForTest()

        runInternalCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.set(a, 1)
            rows.scope(child).set(b, 2)
            rows.scope(descendant).set(c, 3)
        })

        const trace = finishTrace()
        expect(Object.isFrozen(trace)).toBe(true)
        expect(trace).toHaveLength(3)
        expect(new Set(trace).size).toBe(trace.length)
        expect(() => finishTrace()).toThrow("already finished")
        expect(read<readonly object[]>(root, sessions)).toEqual([a])
        expect(read<readonly object[]>(child, sessions)).toEqual([a, b])
        expect(read<readonly object[]>(descendant, sessions)).toEqual([
            a,
            b,
            c,
        ])
    })

    test("plans deep root membership changes in linear placement work", () => {
        const depth = 1_024
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("deep")
        const root = domain.createStoreTree()
        let deepest = root
        for (let index = 0; index < depth; index++) {
            deepest = deepest.scope()
        }
        read(deepest, sessions)
        const kernel = getCollectionKernel(domain) as CollectionDraftKernel
        const measure = (operation: "set" | "delete") => {
            const finishRebuild = kernel.beginMembershipRebuildTraceForTest()
            const finishPlacement =
                kernel.beginMembershipPlacementTraceForTest()
            runInternalCollectionTransaction(
                domain,
                root,
                (_transaction, rows) => {
                    if (operation === "set") rows.set(row, 1)
                    else rows.delete(row)
                },
            )
            const rebuilt = finishRebuild()
            const placement = finishPlacement()
            expect(rebuilt).toHaveLength(depth + 1)
            expect(new Set(rebuilt).size).toBe(depth + 1)
            expect(placement).toEqual({
                coordinates: 1,
                states: depth + 1,
            })
            expect(Object.isFrozen(placement)).toBe(true)
        }

        measure("set")
        expect(read<readonly object[]>(deepest, sessions)).toEqual([row])
        measure("delete")
        expect(read<readonly object[]>(deepest, sessions)).toEqual([])
    })

    test("starts a one-leaf membership change below a 20k-wide route tree", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("leaf")
        const root = domain.createStoreTree()
        const scopes = Array.from({ length: 20_000 }, () => root.scope())
        for (const scope of scopes) read(scope, sessions)
        const routeVisits = instrumentation.read("routeVisits")
        const changed = scopes[scopes.length - 1] as CommittedStoreTree

        runInternalCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope(changed).set(row, 1),
        )

        expect(instrumentation.read("routeVisits")).toBe(routeVisits)
        expect(read<readonly object[]>(scopes[0]!, sessions)).toEqual([])
        expect(read<readonly object[]>(changed, sessions)).toEqual([row])
    }, 15_000)
})
