import { describe, expect, test } from "bun:test"
import {
    RuntimeMismatchError,
    StoreDisposedError,
    SubscriberNotificationError,
    TransactionClosedError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    type CommittedStoreTree,
    type RootTransaction,
    type State,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    createCollectionDefinition,
    getCollectionPresence,
} from "../../src/v1-internal/collection"
import { runCollectionTransaction } from "./collection-test-transaction"

const read = (store: CommittedStoreTree, state: State<any>): any =>
    store.get(state)

const readTransaction = (
    transaction: RootTransaction,
    state: State<any>,
): any => transaction.get(state)

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 committed collection rows", () => {
    test("supports root upsert, update, delete, reset, and committed collection reads", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, object>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        const first = Object.freeze({ version: 1 })
        const second = Object.freeze({ version: 2 })

        expect(read(store, row)).toBeUndefined()
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.set(row, first),
        )
        expect(read(store, row)).toBe(first)

        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.update(row, current => {
                expect(current).toBe(first)
                return second
            }),
        )
        expect(read(store, row)).toBe(second)

        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.delete(row),
        )
        expect(read(store, row)).toBeUndefined()
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.reset(row),
        )
        expect(read(store, row)).toBeUndefined()
        expect(read(store, sessions)).toEqual([])
    })

    test("keeps child tombstones, equal shadows, reset inheritance, and siblings independent", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const presence = getCollectionPresence(domain, row)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const sibling = root.scope("sibling")

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(row, 1),
        )
        expect(read(root, row)).toBe(1)
        expect(read(child, row)).toBe(1)
        expect(read(sibling, row)).toBe(1)
        expect(child.get(presence)).toBe(true)

        let childNotifications = 0
        const childValue = domain.selector(
            get => get(row) as number | undefined,
        )
        child.sub(childValue, () => childNotifications++)
        expect(child.get(childValue)).toBe(1)

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope(child).set(row, 1),
        )
        expect(childNotifications).toBe(0)
        expect(read(child, row)).toBe(1)

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(row, 2),
        )
        expect(read(child, row)).toBe(1)
        expect(childNotifications).toBe(0)
        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope(child).reset(row),
        )
        expect(read(child, row)).toBe(2)
        expect(childNotifications).toBe(1)
        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.set(row, 3),
        )
        expect(read(child, row)).toBe(3)
        expect(childNotifications).toBe(2)

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope("child").delete(row),
        )
        expect(read(child, row)).toBeUndefined()
        expect(child.get(presence)).toBe(false)
        expect(read(root, row)).toBe(3)
        expect(read(sibling, row)).toBe(3)

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope(child).reset(row),
        )
        expect(read(child, row)).toBe(3)
        expect(child.get(presence)).toBe(true)
        expect(childNotifications).toBe(4)
    })

    test("resolves both cross-scope statement orders from a child tombstone", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, string>(domain)
        const row = sessions("a")
        const root = domain.createStoreTree()
        const child = root.scope("child")

        runCollectionTransaction(domain, root, (_transaction, rows) =>
            rows.scope(child).delete(row),
        )
        runCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.scope(child).reset(row)
            rows.set(row, "first")
        })
        expect(read(child, row)).toBe("first")

        runCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.delete(row)
            rows.scope(child).delete(row)
        })
        runCollectionTransaction(domain, root, (_transaction, rows) => {
            rows.set(row, "second")
            rows.scope(child).reset(row)
        })
        expect(read(child, row)).toBe("second")
    })

    test("makes scratch membership independent of discovery order and replays late history", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, string>(domain)
        const row = sessions("a")
        const root = domain.createStoreTree()
        const child = root.scope("child")

        runCollectionTransaction(domain, root, (transaction, rows) => {
            rows.set(row, "one")
            const childTransaction = transaction.scope(child)
            const first = readTransaction(childTransaction, sessions)
            expect(first).toEqual([row])
            expect(readTransaction(childTransaction, row)).toBe("one")
            expect(readTransaction(childTransaction, sessions)).toBe(first)
        })

        runCollectionTransaction(domain, root, (transaction, rows) => {
            rows.delete(row)
            rows.set(row, "two")
            const childTransaction = transaction.scope(child)
            const membership = readTransaction(childTransaction, sessions)
            expect(membership).toEqual([row])
            expect(readTransaction(childTransaction, row)).toBe("two")
        })
        expect(read(child, row)).toBe("two")
    })

    test("settles mixed Atom and row writes atomically in Atom-then-row source order", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const count = domain.atom(0)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        const atomValue = domain.selector(get => get(count))
        const rowValue = domain.selector(get => get(row) as number | undefined)
        let combinedEvaluations = 0
        const combined = domain.selector(get => {
            combinedEvaluations++
            return `${get(count)}:${get(row) as number | undefined}`
        })
        const order: string[] = []
        store.sub(rowValue, () => order.push("row"))
        store.sub(atomValue, () => order.push("atom"))
        expect(store.get(atomValue)).toBe(0)
        expect(store.get(rowValue)).toBeUndefined()
        expect(store.get(combined)).toBe("0:undefined")
        const combinedBefore = combinedEvaluations
        const sourceEpochBefore = instrumentation.read("sourceEpoch")
        const settlementsBefore = instrumentation.read("propagationSettlements")
        const snapshotsBefore = instrumentation.read("notificationSnapshots")

        runCollectionTransaction(domain, store, (transaction, rows) => {
            rows.set(row, 2)
            transaction.set(count, 1)
        })

        expect(store.get(atomValue)).toBe(1)
        expect(store.get(rowValue)).toBe(2)
        expect(store.get(combined)).toBe("1:2")
        expect(combinedEvaluations).toBe(combinedBefore + 1)
        expect(order).toEqual(["atom", "row"])
        expect(instrumentation.read("sourceEpoch")).toBe(sourceEpochBefore + 1)
        expect(instrumentation.read("propagationSettlements")).toBe(
            settlementsBefore + 1,
        )
        expect(instrumentation.read("notificationSnapshots")).toBe(
            snapshotsBefore + 1,
        )
    })

    test("prunes already-absent root delete and reset as source no-ops", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("absent")
        const store = domain.createStoreTree()
        expect(read(store, row)).toBeUndefined()
        const sourceEpoch = instrumentation.read("sourceEpoch")
        const settlements = instrumentation.read("propagationSettlements")

        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.delete(row),
        )
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.reset(row),
        )
        expect(read(store, row)).toBeUndefined()
        expect(instrumentation.read("sourceEpoch")).toBe(sourceEpoch)
        expect(instrumentation.read("propagationSettlements")).toBe(settlements)
    })

    test("uses Object.is for row publication and retains committed errors", () => {
        const domain = createCommittedStoreTreeDomain()
        const numbers = createCollectionDefinition<string, number>(domain)
        const row = numbers("a")
        const store = domain.createStoreTree()
        const selected = domain.selector(get => get(row) as number | undefined)
        let notifications = 0
        store.sub(selected, () => notifications++)
        expect(store.get(selected)).toBeUndefined()

        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.set(row, Number.NaN),
        )
        expect(notifications).toBe(1)
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.set(row, Number.NaN),
        )
        expect(notifications).toBe(1)
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.set(row, -0),
        )
        runCollectionTransaction(domain, store, (_transaction, rows) =>
            rows.set(row, 0),
        )
        expect(notifications).toBe(3)

        const subscriberFailure = new Error("subscriber failed")
        store.sub(selected, () => {
            throw subscriberFailure
        })
        let retainedWriter: RootTransaction | undefined
        const committedError = thrownBy(() =>
            runCollectionTransaction(domain, store, (_transaction, rows) => {
                retainedWriter = rows
                rows.set(row, 3)
            }),
        )
        expect(committedError).toBeInstanceOf(SubscriberNotificationError)
        expect((committedError as SubscriberNotificationError).committed).toBe(
            true,
        )
        expect(read(store, row)).toBe(3)
        expect(() => retainedWriter!.set(row, 4)).toThrow(
            TransactionClosedError,
        )
        expect(() => retainedWriter!.scope(store)).toThrow(
            TransactionClosedError,
        )

        const foreignDomain = createCommittedStoreTreeDomain()
        const foreignStore = foreignDomain.createStoreTree()
        const foreignRows = createCollectionDefinition<string, number>(
            foreignDomain,
        )
        expect(() => retainedWriter!.scope(foreignStore)).toThrow(
            RuntimeMismatchError,
        )
        expect(() => retainedWriter!.set(foreignRows("a"), 1)).toThrow(
            RuntimeMismatchError,
        )
    })

    test("keeps row admission failure atomic with an Atom write", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()

        expect(() =>
            runCollectionTransaction(domain, store, (transaction, rows) => {
                transaction.set(count, 1)
                Reflect.apply(rows.set, rows, [row, undefined])
            }),
        ).toThrow("cannot be undefined")
        expect(store.get(count)).toBe(0)
        expect(read(store, row)).toBeUndefined()

        const inspectionFailure = new Error("owner inspection failed")
        let inspections = 0
        const hostile = new Proxy(
            {},
            {
                getOwnPropertyDescriptor: () => {
                    inspections++
                    throw inspectionFailure
                },
            },
        )
        expect(
            thrownBy(() =>
                runCollectionTransaction(domain, store, (_transaction, rows) =>
                    rows.scope(hostile as CommittedStoreTree),
                ),
            ),
        ).toBe(inspectionFailure)
        expect(inspections).toBe(1)
    })

    test("checks Store liveness before the internal callback shape", () => {
        const domain = createCommittedStoreTreeDomain()
        const store = domain.createStoreTree()
        store.dispose()

        expect(() =>
            runCollectionTransaction(domain, store, undefined as never),
        ).toThrow(StoreDisposedError)
    })

    test("keeps mixed owners committed and preserves authoritative mismatch ledger", () => {
        const domain = createCommittedStoreTreeDomain()
        const foreignDomain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const foreign = foreignDomain.atom(0)
        const sessions = createCollectionDefinition<string, number>(domain)
        const row = sessions("a")
        const store = domain.createStoreTree()
        const selected = domain.selector(get => {
            const current = get(row) as number | undefined
            if (current === 2) {
                return get(foreign)
            }
            return get(count) + (current ?? 0)
        })
        expect(store.get(selected)).toBe(0)
        const subscriberFailure = new Error("subscriber ledger")
        store.sub(selected, () => {
            throw subscriberFailure
        })

        const error = thrownBy(() =>
            runCollectionTransaction(domain, store, (transaction, rows) => {
                rows.set(row, 2)
                transaction.set(count, 1)
            }),
        )
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        const notification = error as SubscriberNotificationError
        expect(notification.committed).toBe(true)
        expect(notification.cause).toBeInstanceOf(RuntimeMismatchError)
        expect(notification.causes).toEqual([
            notification.cause,
            subscriberFailure,
        ])
        expect(store.get(count)).toBe(1)
        expect(read(store, row)).toBe(2)
    })

    test("isolates committed rows between Stores sharing one definition", () => {
        const domain = createCommittedStoreTreeDomain()
        const sessions = createCollectionDefinition<string, object>(domain)
        const row = sessions("a")
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        const value = Object.freeze({ owner: "first" })

        runCollectionTransaction(domain, first, (_transaction, rows) =>
            rows.set(row, value),
        )
        expect(read(first, row)).toBe(value)
        expect(read(second, row)).toBeUndefined()
    })
})
