import { describe, expect, test } from "bun:test"
import {
    RuntimeMismatchError,
    SubscriberNotificationError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    type CommittedStoreTree,
    type State,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    createCollectionDefinition,
    getCollectionPresence,
} from "../../src/v1-internal/collection"
import { runCollectionTransaction } from "./collection-test-transaction"

const read = <Value>(store: CommittedStoreTree, state: State<any>): Value =>
    store.get(state) as Value

const sub = (
    store: CommittedStoreTree,
    state: State<any>,
    callback: () => void,
): (() => void) => store.sub(state, callback)

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 committed collection subscriptions", () => {
    test("delivers Atom, RowView, then MembershipRecord with one propagation snapshot", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const count = domain.atom(0)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        const order: string[] = []

        sub(store, sessions, () => order.push("membership"))
        sub(store, row, () => order.push("row"))
        store.sub(count, () => order.push("atom"))
        const sourceEpoch = instrumentation.read("sourceEpoch")
        const settlements = instrumentation.read("propagationSettlements")
        const snapshots = instrumentation.read("notificationSnapshots")

        runCollectionTransaction(domain, store, (transaction, rows) => {
            rows.set(row, 1)
            transaction.set(count, 1)
        })

        expect(order).toEqual(["atom", "row", "membership"])
        expect(instrumentation.read("sourceEpoch")).toBe(sourceEpoch + 1)
        expect(instrumentation.read("propagationSettlements")).toBe(
            settlements + 1,
        )
        expect(instrumentation.read("notificationSnapshots")).toBe(
            snapshots + 1,
        )
        expect(store.get(count)).toBe(1)
        expect(read<number>(store, row)).toBe(1)
        expect(read<readonly object[]>(store, sessions)).toEqual([row])
    })

    test("keeps a same-value gap row-silent while publishing reordered membership", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const a = sessions("a")
        const b = sessions("b")
        const store = domain.createStoreTree()
        runCollectionTransaction(domain, store, (_transaction, rows) => {
            rows.set(a, 1)
            rows.set(b, 2)
        })
        const order: string[] = []
        sub(store, a, () => order.push("row"))
        sub(store, sessions, () => order.push("membership"))

        runCollectionTransaction(domain, store, (_transaction, rows) => {
            rows.delete(a)
            rows.set(a, 1)
        })

        expect(order).toEqual(["membership"])
        expect(read<readonly object[]>(store, sessions)).toEqual([b, a])
    })

    test("keeps a sole-row gap identity-exact and membership-silent", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.set(row, 1),
        )
        const baseline = store.get(sessions)
        const sourceEpoch = instrumentation.read("sourceEpoch")
        let membershipNotifications = 0
        let rowNotifications = 0
        sub(store, sessions, () => membershipNotifications++)
        sub(store, row, () => rowNotifications++)

        runCollectionTransaction(domain, store, (transaction, rows) => {
            rows.delete(row)
            expect(transaction.get(sessions)).toEqual([])
            rows.set(row, 1)
            expect(transaction.get(sessions)).toBe(baseline)
        })

        expect(store.get(sessions)).toBe(baseline)
        expect(rowNotifications).toBe(0)
        expect(membershipNotifications).toBe(0)
        expect(instrumentation.read("sourceEpoch")).toBe(sourceEpoch)
    })

    test("fires one duplicate callback twice and keeps membership and presence silent on a value update", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const presence = getCollectionPresence(domain, row)
        const store = domain.createStoreTree()
        const duplicateCalls: string[] = []
        const duplicate = () => duplicateCalls.push("same")
        sub(store, sessions, duplicate)
        sub(store, sessions, duplicate)
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.set(row, 1),
        )
        expect(duplicateCalls).toEqual(["same", "same"])

        const membership = read<readonly object[]>(store, sessions)
        const sources: string[] = []
        sub(store, row, () => sources.push("row"))
        sub(store, sessions, () => sources.push("membership"))
        store.sub(presence, () => sources.push("presence"))
        expect(store.get(presence)).toBe(true)
        duplicateCalls.length = 0
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.update(row, () => 2),
        )

        expect(sources).toEqual(["row"])
        expect(duplicateCalls).toEqual([])
        expect(read<readonly object[]>(store, sessions)).toBe(membership)
        expect(store.get(presence)).toBe(true)
    })

    test("keeps equal child shadow and reset routing-only", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const root = domain.createStoreTree()
        const child = root.scope("child")
        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(row, 1),
        )
        const membership = read<readonly object[]>(child, sessions)
        let rowCalls = 0
        let membershipCalls = 0
        sub(child, row, () => rowCalls++)
        sub(child, sessions, () => membershipCalls++)

        const shadowEpoch = instrumentation.read("sourceEpoch")
        const routeRemoves = instrumentation.read("routeRemoves")
        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope(child).set(row, 1),
        )
        expect(read<readonly object[]>(child, sessions)).toBe(membership)
        expect(rowCalls).toBe(0)
        expect(membershipCalls).toBe(0)
        expect(instrumentation.read("sourceEpoch")).toBe(shadowEpoch + 1)
        expect(instrumentation.read("routeRemoves")).toBe(routeRemoves + 1)

        const resetEpoch = instrumentation.read("sourceEpoch")
        const routeAdds = instrumentation.read("routeAdds")
        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope(child).reset(row),
        )
        expect(read<readonly object[]>(child, sessions)).toBe(membership)
        expect(rowCalls).toBe(0)
        expect(membershipCalls).toBe(0)
        expect(instrumentation.read("sourceEpoch")).toBe(resetEpoch + 1)
        expect(instrumentation.read("routeAdds")).toBe(routeAdds + 1)
    })

    test("orders membership routes parent-first by route insertion, not scope or subscription creation", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const root = domain.createStoreTree()
        const firstCreated = root.scope("first")
        const secondCreated = root.scope("second")
        const secondLeaf = secondCreated.scope("leaf")

        read(secondCreated, sessions)
        read(secondLeaf, sessions)
        read(firstCreated, sessions)
        read(firstCreated, row)
        read(secondCreated, row)
        read(secondLeaf, row)
        const order: string[] = []
        sub(secondLeaf, row, () => order.push("row-second-leaf"))
        sub(secondCreated, row, () => order.push("row-second"))
        sub(firstCreated, row, () => order.push("row-first"))
        sub(root, row, () => order.push("row-root"))
        sub(firstCreated, sessions, () => order.push("membership-first"))
        sub(secondLeaf, sessions, () => order.push("membership-second-leaf"))
        sub(secondCreated, sessions, () => order.push("membership-second"))
        sub(root, sessions, () => order.push("membership-root"))

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(row, 1),
        )

        expect(order).toEqual([
            "row-root",
            "row-first",
            "row-second",
            "row-second-leaf",
            "membership-root",
            "membership-second",
            "membership-second-leaf",
            "membership-first",
        ])
    })

    test("retains first row and collection slots and deduplicates overlapping routes", () => {
        const domain = createCommittedStoreTreeDomain()
        const first = createCollectionDefinition<string, number>(domain)
        const second = createCollectionDefinition<string, number>(domain)
        const firstA = first("a")
        const firstC = first("c")
        const secondB = second("b")
        const root = domain.createStoreTree()
        const child = root.scope("child")

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(firstA, 1),
        )
        const collectionOrder: string[] = []
        sub(root, second, () => collectionOrder.push("second"))
        sub(root, first, () => collectionOrder.push("first"))
        runCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.update(firstA, value => (value as number) + 1)
            rows.set(secondB, 2)
            rows.set(firstC, 3)
        })
        expect(collectionOrder).toEqual(["first", "second"])

        const rowOrder: string[] = []
        const rowA = first("row-a")
        const rowB = first("row-b")
        sub(root, rowB, () => rowOrder.push("b"))
        sub(root, rowA, () => rowOrder.push("a"))
        runCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.set(rowA, 1)
            rows.set(rowB, 2)
            rows.update(rowA, value => (value as number) + 1)
        })
        expect(rowOrder).toEqual(["a", "b"])

        const overlap: string[] = []
        const shared = first("shared")
        sub(root, first, () => overlap.push("root"))
        sub(child, first, () => overlap.push("child"))
        runCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.set(shared, 1)
            rows.scope(child).set(shared, 1)
        })
        expect(overlap).toEqual(["root", "child"])
    })

    test("delivers duplicate callbacks in registration order and freezes the subscriber-only ledger", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        const atomFailure = new Error("atom")
        const rowFailure = new Error("row")
        const firstMembershipFailure = new Error("membership-1")
        const secondMembershipFailure = new Error("membership-2")
        const attempted: string[] = []

        sub(store, sessions, () => {
            attempted.push("membership-1")
            throw firstMembershipFailure
        })
        sub(store, sessions, () => {
            attempted.push("membership-2")
            throw secondMembershipFailure
        })
        sub(store, row, () => {
            attempted.push("row")
            throw rowFailure
        })
        store.sub(count, () => {
            attempted.push("atom")
            throw atomFailure
        })

        const error = thrownBy(() =>
            runCollectionTransaction(domain, store, (transaction, rows) => {
                rows.set(row, 1)
                transaction.set(count, 1)
            }),
        )
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        const notification = error as SubscriberNotificationError
        expect(attempted).toEqual([
            "atom",
            "row",
            "membership-1",
            "membership-2",
        ])
        expect(notification.cause).toBe(atomFailure)
        expect(notification.causes).toEqual([
            atomFailure,
            rowFailure,
            firstMembershipFailure,
            secondMembershipFailure,
        ])
        expect(notification.committed).toBe(true)
        expect(notification.name).toBe("SubscriberNotificationError")
        expect(notification.code).toBe("VALDRES_SUBSCRIBER_NOTIFICATION")
        expect(notification.phase).toBe("notifying")
        expect(notification.source).toBe("owned-mutation")
        expect(Object.isFrozen(notification)).toBe(true)
        expect(Object.isFrozen(notification.causes)).toBe(true)
        expect(read<readonly object[]>(store, sessions)).toEqual([row])
    })

    test("keeps membership installed and leads mixed subscriber causes with the authoritative mismatch", () => {
        const domain = createCommittedStoreTreeDomain()
        const foreignDomain = createCommittedStoreTreeDomain()
        const foreign = foreignDomain.atom(0)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        const selected = domain.selector(get => {
            const value = get(row) as number | undefined
            return value === undefined ? 0 : get(foreign)
        })
        expect(store.get(selected)).toBe(0)
        store.sub(selected, () => {})
        const rowFailure = new Error("row subscriber")
        const membershipFailure = new Error("membership subscriber")
        sub(store, row, () => {
            throw rowFailure
        })
        sub(store, sessions, () => {
            throw membershipFailure
        })

        const error = thrownBy(() =>
            runCollectionTransaction(domain, store, (_txn, rows) =>
                rows.set(row, 1),
            ),
        )
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        const notification = error as SubscriberNotificationError
        expect(notification.cause).toBeInstanceOf(RuntimeMismatchError)
        expect(notification.causes).toEqual([
            notification.cause,
            rowFailure,
            membershipFailure,
        ])
        expect(read<number>(store, row)).toBe(1)
        expect(read<readonly object[]>(store, sessions)).toEqual([row])
    })

    test("surfaces the exact authoritative mismatch after a no-throw membership callback", () => {
        const domain = createCommittedStoreTreeDomain()
        const foreignDomain = createCommittedStoreTreeDomain()
        const foreign = foreignDomain.atom(0)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        const selected = domain.selector(get => {
            const value = get(row) as number | undefined
            return value === undefined ? 0 : get(foreign)
        })
        expect(store.get(selected)).toBe(0)
        store.sub(selected, () => {})
        let membershipCalls = 0
        sub(store, sessions, () => membershipCalls++)

        const error = thrownBy(() =>
            runCollectionTransaction(domain, store, (_txn, rows) =>
                rows.set(row, 1),
            ),
        )
        expect(error).toBeInstanceOf(RuntimeMismatchError)
        expect(membershipCalls).toBe(1)
        expect(read<readonly object[]>(store, sessions)).toEqual([row])
    })
})
