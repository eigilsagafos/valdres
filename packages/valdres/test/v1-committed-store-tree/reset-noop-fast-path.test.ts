import { describe, expect, test } from "bun:test"
import {
    RuntimeMismatchError,
    SelectorCapabilityError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { SelectorGetterError } from "../../src/v1-internal/selector-evaluator/errors"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const counterHarness = (): Readonly<{
    instrumentation: ReturnType<typeof createInternalStoreTreeInstrumentation>
    read(name: string): number
}> => {
    const instrumentation = createInternalStoreTreeInstrumentation()
    return Object.freeze({
        instrumentation,
        read: (name: string): number =>
            instrumentation.read(
                name as Parameters<typeof instrumentation.read>[0],
            ),
    })
}

describe("v1 singleton unowned reset commit pruning", () => {
    test("prunes direct and explicit singleton resets after identical staging", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        let evaluations = 0
        const doubled = domain.selector(get => {
            evaluations++
            return get(count) * 2
        })
        const direct = domain.createStoreTree()
        const transactional = domain.createStoreTree()
        const notifications = [0, 0]
        const snapshot = () => ({
            drafts: counters.read("draftCreations"),
            storage: counters.read("draftStorageAllocations"),
            commitStorage: counters.read("commitWorksetAllocations"),
            preflight: counters.read("finalPreflightVisits"),
            resolution: counters.read("finalResolutionVisits"),
            sourceEpoch: counters.read("sourceEpoch"),
            settlements: counters.read("propagationSettlements"),
            fallbacks: counters.read("fallbackPublications"),
        })
        const delta = (
            before: ReturnType<typeof snapshot>,
            after: ReturnType<typeof snapshot>,
        ) =>
            Object.fromEntries(
                Object.entries(before).map(([name, value]) => [
                    name,
                    after[name as keyof typeof after] - value,
                ]),
            )

        expect(direct.get(doubled)).toBe(0)
        expect(transactional.get(doubled)).toBe(0)
        const unsubscribeDirect = direct.sub(doubled, () => notifications[0]++)
        const unsubscribeTransactional = transactional.sub(
            doubled,
            () => notifications[1]++,
        )

        const beforeDirect = snapshot()
        expect(direct.reset(count)).toBeUndefined()
        const directWork = delta(beforeDirect, snapshot())
        const beforeTransaction = snapshot()
        expect(
            transactional.txn(transaction => transaction.reset(count)),
        ).toBeUndefined()
        const transactionWork = delta(beforeTransaction, snapshot())

        expect(directWork).toEqual({
            drafts: 1,
            storage: 0,
            commitStorage: 0,
            preflight: 0,
            resolution: 0,
            sourceEpoch: 0,
            settlements: 0,
            fallbacks: 0,
        })
        expect(transactionWork).toEqual(directWork)
        expect(direct.get(doubled)).toBe(0)
        expect(transactional.get(doubled)).toBe(0)
        expect(evaluations).toBe(2)
        expect(notifications).toEqual([0, 0])
        unsubscribeDirect()
        unsubscribeTransactional()
    })

    test("keeps direct and transactional children inherited while preserving owned reset routing", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const direct = root.scope("direct")
        const transactional = root.scope("transactional")
        let evaluations = 0
        const doubled = domain.selector(get => {
            evaluations++
            return get(count) * 2
        })
        const notifications = [0, 0]

        root.set(count, 1)
        expect(direct.get(doubled)).toBe(2)
        expect(transactional.get(doubled)).toBe(2)
        const unsubscribeDirect = direct.sub(doubled, () => notifications[0]++)
        const unsubscribeTransactional = transactional.sub(
            doubled,
            () => notifications[1]++,
        )
        const preflight = counters.read("finalPreflightVisits")
        const resolution = counters.read("finalResolutionVisits")
        const sourceEpoch = counters.read("sourceEpoch")

        direct.reset(count)
        root.txn(transaction => transaction.scope(transactional).reset(count))

        expect(counters.read("finalPreflightVisits")).toBe(preflight)
        expect(counters.read("finalResolutionVisits")).toBe(resolution)
        expect(counters.read("sourceEpoch")).toBe(sourceEpoch)
        expect(direct.get(doubled)).toBe(2)
        expect(transactional.get(doubled)).toBe(2)
        expect(evaluations).toBe(2)
        expect(notifications).toEqual([0, 0])

        root.set(count, 2)
        expect(direct.get(doubled)).toBe(4)
        expect(transactional.get(doubled)).toBe(4)
        expect(notifications).toEqual([1, 1])
        direct.set(count, 3)
        root.txn(transaction => transaction.scope(transactional).set(count, 3))
        expect(direct.get(doubled)).toBe(6)
        expect(transactional.get(doubled)).toBe(6)
        expect(notifications).toEqual([2, 2])
        direct.reset(count)
        root.txn(transaction => transaction.scope(transactional).reset(count))
        expect(direct.get(doubled)).toBe(4)
        expect(transactional.get(doubled)).toBe(4)
        expect(notifications).toEqual([3, 3])
        unsubscribeDirect()
        unsubscribeTransactional()
    })

    test("keeps direct and transactional cold lazy publication and error behavior identical", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        let initializations = 0
        const lazy = domain.atomLazy(() => {
            initializations++
            return 7
        })
        const cause = Object.freeze({ kind: "lazy-reset-error" })
        let failedInitializations = 0
        const failed = domain.atomLazy<number>(() => {
            failedInitializations++
            throw cause
        })
        const direct = domain.createStoreTree()
        const transactional = domain.createStoreTree()

        const publications = counters.read("fallbackPublications")
        const preflight = counters.read("finalPreflightVisits")
        direct.reset(lazy)
        expect(initializations).toBe(1)
        expect(counters.read("fallbackPublications") - publications).toBe(1)
        expect(counters.read("finalPreflightVisits") - preflight).toBe(1)
        expect(direct.get(lazy)).toBe(7)

        const transactionalPublications = counters.read("fallbackPublications")
        const transactionalPreflight = counters.read("finalPreflightVisits")
        transactional.txn(transaction => transaction.reset(lazy))
        expect(initializations).toBe(2)
        expect(
            counters.read("fallbackPublications") - transactionalPublications,
        ).toBe(1)
        expect(
            counters.read("finalPreflightVisits") - transactionalPreflight,
        ).toBe(1)
        expect(transactional.get(lazy)).toBe(7)

        const publishedPreflight = counters.read("finalPreflightVisits")
        direct.reset(lazy)
        transactional.txn(transaction => transaction.reset(lazy))
        expect(initializations).toBe(2)
        expect(counters.read("finalPreflightVisits")).toBe(publishedPreflight)

        expect(thrownBy(() => direct.reset(failed))).toBe(cause)
        expect(
            thrownBy(() =>
                transactional.txn(transaction => transaction.reset(failed)),
            ),
        ).toBe(cause)
        expect(failedInitializations).toBe(2)
        expect(thrownBy(() => direct.reset(failed))).toBe(cause)
        expect(
            thrownBy(() =>
                transactional.txn(transaction => transaction.reset(failed)),
            ),
        ).toBe(cause)
        expect(failedInitializations).toBe(4)
        expect(counters.read("fallbackPublications") - publications).toBe(2)
    })

    test("retains validation, comparator, and transactional reset semantics", () => {
        const counters = counterHarness()
        let comparisons = 0
        const local = createCommittedStoreTreeDomain(counters.instrumentation)
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0, {
            equal: (left, right) => {
                comparisons++
                return Object.is(left, right)
            },
        })
        const foreignCount = foreign.atom(0)
        const tree = local.createStoreTree()
        const transactional = local.createStoreTree()

        tree.reset(count)
        expect(comparisons).toBe(0)

        const drafts = counters.read("draftCreations")
        expect(thrownBy(() => tree.reset(foreignCount))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        expect(counters.read("draftCreations")).toBe(drafts)

        const forbidden = local.selector(() => {
            tree.reset(count)
            return 1
        })
        const forbiddenError = thrownBy(() => tree.get(forbidden))
        expect(forbiddenError).toBeInstanceOf(SelectorGetterError)
        expect((forbiddenError as SelectorGetterError).cause).toBeInstanceOf(
            SelectorCapabilityError,
        )
        expect(counters.read("draftCreations")).toBe(drafts)

        tree.set(count, 1)
        transactional.set(count, 1)
        expect(comparisons).toBe(2)
        const notifications = [0, 0]
        const unsubscribeDirect = tree.sub(count, () => notifications[0]++)
        const unsubscribeTransactional = transactional.sub(
            count,
            () => notifications[1]++,
        )
        const snapshot = () => ({
            preflight: counters.read("finalPreflightVisits"),
            resolution: counters.read("finalResolutionVisits"),
            sourceEpoch: counters.read("sourceEpoch"),
            settlements: counters.read("propagationSettlements"),
        })
        const directBefore = snapshot()
        tree.reset(count)
        const directAfter = snapshot()
        const transactionBefore = snapshot()
        transactional.txn(transaction => transaction.reset(count))
        const transactionAfter = snapshot()
        const delta = (
            before: ReturnType<typeof snapshot>,
            after: ReturnType<typeof snapshot>,
        ) => ({
            preflight: after.preflight - before.preflight,
            resolution: after.resolution - before.resolution,
            sourceEpoch: after.sourceEpoch - before.sourceEpoch,
            settlements: after.settlements - before.settlements,
        })

        expect(delta(transactionBefore, transactionAfter)).toEqual(
            delta(directBefore, directAfter),
        )
        expect(tree.get(count)).toBe(0)
        expect(transactional.get(count)).toBe(0)
        expect(comparisons).toBe(2)
        expect(notifications).toEqual([1, 1])
        unsubscribeDirect()
        unsubscribeTransactional()
    })
})
