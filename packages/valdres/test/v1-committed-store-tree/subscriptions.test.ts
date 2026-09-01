import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    RuntimeMismatchError,
    SelectorCapabilityError,
    StoreDisposedError,
    SubscriberNotificationError,
    TransactionPhaseError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    type Selector,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"

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

describe("v1 lifecycle-free synchronous Store subscriptions", () => {
    test("admits cold and warm value/error outcomes without an initial callback", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const ordinary = Object.freeze({ kind: "ordinary" })
        let valueEvaluations = 0
        let errorEvaluations = 0
        const value = domain.selector(get => {
            valueEvaluations++
            return get(count) * 2
        })
        const failure = domain.selector(() => {
            errorEvaluations++
            throw ordinary
        })
        const tree = domain.createStoreTree()
        let calls = 0

        const removeValue = tree.sub(value, () => calls++)
        const removeFailure = tree.sub(failure, () => calls++)
        const removeWarmValue = tree.sub(value, () => calls++)
        const removeWarmFailure = tree.sub(failure, () => calls++)

        expect(calls).toBe(0)
        expect(valueEvaluations).toBe(1)
        expect(errorEvaluations).toBe(1)
        expect(tree.get(value)).toBe(0)
        expect(thrownBy(() => tree.get(failure))).toBeDefined()
        expect(valueEvaluations).toBe(1)
        expect(errorEvaluations).toBe(1)

        removeValue()
        removeFailure()
        removeWarmValue()
        removeWarmFailure()
    })

    test("rejects failed admission before linking or notifying", () => {
        const counters = counterHarness()
        const local = createCommittedStoreTreeDomain(counters.instrumentation)
        const foreign = createCommittedStoreTreeDomain()
        const tree = local.createStoreTree()
        const disposed = local.createStoreTree()
        const count = local.atom(0)
        const foreignCount = foreign.atom(0)
        const invalid = Object.freeze({ kind: "atom" })
        let callbacks = 0
        let useForeign = true
        const control = local.selector(() => {
            if (useForeign) tree.get(foreignCount)
            return 1
        })
        disposed.dispose()

        expect(
            thrownBy(() => tree.sub(foreignCount, () => callbacks++)),
        ).toBeInstanceOf(RuntimeMismatchError)
        expect(
            thrownBy(() => tree.sub(invalid as never, () => callbacks++)),
        ).toBeInstanceOf(TypeError)
        expect(
            thrownBy(() => disposed.sub(count, () => callbacks++)),
        ).toBeInstanceOf(StoreDisposedError)
        expect(thrownBy(() => tree.sub(count, 1 as never))).toBeInstanceOf(
            TypeError,
        )
        expect(
            thrownBy(() => tree.sub(control, () => callbacks++)),
        ).toBeInstanceOf(RuntimeMismatchError)
        expect(counters.read("subscriptionRegistrations")).toBe(0)
        expect(counters.read("activeSubscriptions")).toBe(0)
        expect(callbacks).toBe(0)

        useForeign = false
        const remove = tree.sub(control, () => callbacks++)
        expect(tree.get(control)).toBe(1)
        remove()
    })

    test("delivers changed targets in first-reaching and insertion order", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(0)
        const unrelated = domain.atom(0)
        const equal = domain.selector(get => ({ parity: get(source) & 1 }), {
            equal: (left, right) => left.parity === right.parity,
        })
        const middle = domain.selector(get => get(source) + 1)
        const leaf = domain.selector(get => get(middle) + 1)
        const tree = domain.createStoreTree()
        const order: string[] = []
        const duplicate = (): void => {
            order.push("middle-duplicate")
        }

        tree.sub(leaf, () => order.push("leaf"))
        tree.sub(source, () => order.push("source-a"))
        tree.sub(middle, duplicate)
        tree.sub(source, () => order.push("source-b"))
        tree.sub(middle, duplicate)
        tree.sub(equal, () => order.push("equal"))
        tree.sub(unrelated, () => order.push("unrelated"))

        tree.set(source, 2)
        expect(order).toEqual([
            "source-a",
            "source-b",
            "middle-duplicate",
            "middle-duplicate",
            "leaf",
        ])
        order.length = 0
        tree.set(source, 3)
        expect(order).toEqual([
            "source-a",
            "source-b",
            "middle-duplicate",
            "middle-duplicate",
            "equal",
            "leaf",
        ])
    })

    test("keeps old dependency notification order when a dynamic parent switches branches", () => {
        const domain = createCommittedStoreTreeDomain()
        const parentUsesBranch = domain.atom(false)
        const branchUsesOldChild = domain.atom(true)
        const oldSource = domain.atom(1)
        const safe = domain.atom(7)
        const oldChild = domain.selector(get => get(oldSource))
        const branch = domain.selector(get =>
            get(branchUsesOldChild) ? get(oldChild) : get(safe),
        )
        const parent = domain.selector(get =>
            get(parentUsesBranch) ? get(branch) : 0,
        )
        const tree = domain.createStoreTree()
        const order: string[] = []

        expect(tree.get(branch)).toBe(1)
        expect(tree.get(parent)).toBe(0)
        tree.sub(oldChild, () => order.push("old"))
        tree.sub(branch, () => order.push("branch"))
        tree.sub(parent, () => order.push("parent"))

        tree.txn(transaction => {
            transaction.set(parentUsesBranch, true)
            transaction.set(branchUsesOldChild, false)
            transaction.set(oldSource, 2)
        })

        expect(order).toEqual(["old", "branch", "parent"])
        expect(tree.get(oldChild)).toBe(2)
        expect(tree.get(branch)).toBe(7)
        expect(tree.get(parent)).toBe(7)
    })

    test("notifies direct mutations and one multi-source transaction once per final target", () => {
        const domain = createCommittedStoreTreeDomain()
        const left = domain.atom(0)
        const right = domain.atom(0)
        const total = domain.selector(get => get(left) + get(right))
        const tree = domain.createStoreTree()
        const values: number[] = []
        let leftCalls = 0
        tree.sub(left, () => leftCalls++)
        tree.sub(total, () => values.push(tree.get(total)))

        tree.set(left, 1)
        tree.update(left, value => value + 1)
        tree.reset(left)
        tree.txn(transaction => {
            transaction.set(left, 4)
            transaction.set(right, 5)
            transaction.set(left, 6)
        })

        expect(leftCalls).toBe(4)
        expect(values).toEqual([1, 2, 0, 11])
    })

    test("makes unsubscribe O(1), idempotent, tail-ordered, and unable to edit a frozen snapshot", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const tree = domain.createStoreTree()
        const order: string[] = []
        let removeSecond = (): void => {}
        tree.sub(count, () => {
            order.push("first")
            removeSecond()
        })
        removeSecond = tree.sub(count, () => order.push("second"))
        const removeThird = tree.sub(count, () => order.push("third"))

        tree.set(count, 1)
        expect(order).toEqual(["first", "second", "third"])
        order.length = 0
        tree.set(count, 2)
        expect(order).toEqual(["first", "third"])

        removeSecond()
        removeThird()
        const removeTail = tree.sub(count, () => order.push("tail"))
        order.length = 0
        tree.set(count, 3)
        expect(order).toEqual(["first", "tail"])
        removeTail()
        removeTail()
    })

    test("keeps cross-target callbacks in the frozen notification snapshot", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const derived = domain.selector(get => get(count) + 1)
        const tree = domain.createStoreTree()
        const calls: string[] = []
        let removeDerived = (): void => {}
        tree.sub(count, () => {
            calls.push("count")
            removeDerived()
        })
        removeDerived = tree.sub(derived, () => calls.push("derived"))

        tree.set(count, 1)
        expect(calls).toEqual(["count", "derived"])
        calls.length = 0
        tree.set(count, 2)
        expect(calls).toEqual(["count"])
    })

    test("allows committed reads and unsubscribe while quarantining same-domain commands", () => {
        const counters = counterHarness()
        const local = createCommittedStoreTreeDomain(counters.instrumentation)
        const independent = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const otherCount = independent.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        const other = independent.createStoreTree()
        const errors: unknown[] = []
        const reads: number[] = []
        let removeSelf = (): void => {}
        removeSelf = tree.sub(count, () => {
            reads.push(tree.get(count))
            errors.push(thrownBy(() => sibling.set(count, 10)))
            errors.push(
                thrownBy(() => sibling.update(count, value => value + 1)),
            )
            errors.push(thrownBy(() => sibling.reset(count)))
            errors.push(thrownBy(() => sibling.txn(() => undefined)))
            errors.push(thrownBy(() => sibling.sub(count, () => undefined)))
            errors.push(thrownBy(() => sibling.scope("forbidden")))
            errors.push(thrownBy(() => sibling.dispose()))
            errors.push(thrownBy(() => local.createStoreTree()))
            other.set(otherCount, 1)
            removeSelf()
        })
        const draftsBefore = counters.read("draftCreations")

        tree.set(count, 1)

        expect(reads).toEqual([1])
        expect(errors).toHaveLength(8)
        for (const error of errors) {
            expect(error).toBeInstanceOf(CallbackCapabilityError)
        }
        expect(counters.read("draftCreations") - draftsBefore).toBe(1)
        expect(other.get(otherCount)).toBe(1)
        tree.set(count, 2)
        expect(reads).toEqual([1])
    })

    test("rejects active unsubscribe from selector, guarded, and transaction activities", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const trigger = domain.atom(0)
        const tree = domain.createStoreTree()
        const errors: unknown[] = []
        const remove = tree.sub(count, () => undefined)
        const derived = domain.selector(get => {
            get(trigger)
            errors.push(thrownBy(remove))
            return 1
        })

        expect(tree.get(derived)).toBe(1)
        tree.update(count, value => {
            errors.push(thrownBy(remove))
            return value + 1
        })
        tree.txn(transaction => {
            errors.push(thrownBy(remove))
            transaction.set(count, 2)
        })

        expect(errors[0]).toBeInstanceOf(SelectorCapabilityError)
        expect(errors[1]).toBeInstanceOf(CallbackCapabilityError)
        expect(errors[2]).toBeInstanceOf(TransactionPhaseError)
        remove()
    })

    test("contains returned and thrown thenables once while retaining exact thrown causes", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const tree = domain.createStoreTree()
        const first = Object.freeze({ cause: "first" })
        const last = Object.freeze({ cause: "last" })
        let returnedContainments = 0
        let thrownContainments = 0
        const returnedThenable = Object.freeze({
            then(_resolve: unknown, _reject: unknown): void {
                returnedContainments++
            },
        })
        const thrownThenable = Object.freeze({
            then(_resolve: unknown, _reject: unknown): void {
                thrownContainments++
            },
        })
        const calls: string[] = []
        tree.sub(count, (() => {
            calls.push("returned")
            return returnedThenable
        }) as () => void)
        tree.sub(count, () => {
            calls.push("first")
            throw first
        })
        tree.sub(count, () => {
            calls.push("thenable")
            throw thrownThenable
        })
        tree.sub(count, () => {
            calls.push("last")
            throw last
        })

        const error = thrownBy(() => tree.set(count, 1))
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(calls).toEqual(["returned", "first", "thenable", "last"])
        expect(returnedContainments).toBe(1)
        expect(thrownContainments).toBe(1)
        expect(error).toMatchObject({
            name: "SubscriberNotificationError",
            code: "VALDRES_SUBSCRIBER_NOTIFICATION",
            cause: first,
            causes: [first, thrownThenable, last],
            committed: true,
            phase: "notifying",
            source: "owned-mutation",
        })
        expect(Object.isFrozen(error)).toBe(true)
        expect(
            Object.isFrozen((error as SubscriberNotificationError).causes),
        ).toBe(true)
        expect(tree.get(count)).toBe(1)
    })

    test("keeps post-apply mismatch authoritative across both arbitration rows", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const trigger = local.atom(0)
        const foreignCount = foreign.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        let contaminate = false
        let subscriberThrow: unknown | undefined
        const derived = local.selector(get => {
            const value = get(trigger)
            if (contaminate) {
                try {
                    sibling.get(foreignCount)
                } catch {}
            }
            return value
        })
        const calls: number[] = []
        tree.sub(derived, () => {
            calls.push(tree.get(trigger))
            if (subscriberThrow !== undefined) throw subscriberThrow
        })

        contaminate = true
        const directMismatch = thrownBy(() => tree.set(trigger, 1))
        expect(directMismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(calls).toEqual([1])
        expect(thrownBy(() => tree.get(derived))).toBe(directMismatch)

        contaminate = false
        tree.set(trigger, 2)
        const subscriberError = Object.freeze({ kind: "subscriber" })
        subscriberThrow = subscriberError
        contaminate = true
        const wrapped = thrownBy(() => tree.set(trigger, 3))
        expect(wrapped).toBeInstanceOf(SubscriberNotificationError)
        const mismatch = thrownBy(() => tree.get(derived))
        expect(mismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(wrapped).toMatchObject({
            cause: mismatch,
            causes: [mismatch, subscriberError],
        })
        expect((wrapped as SubscriberNotificationError).cause).toBe(mismatch)
        expect(calls).toEqual([1, 2, 3])
    })

    test("separates scope coordinates and clears registrations during subtree disposal", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const grandchild = child.scope("grandchild")
        const calls: string[] = []
        const stale = child.sub(count, () => calls.push("child"))
        grandchild.sub(count, () => calls.push("grandchild"))
        root.sub(count, () => calls.push("root"))

        root.set(count, 1)
        expect(calls).toEqual(["root", "child", "grandchild"])
        calls.length = 0
        child.dispose()
        stale()
        stale()
        root.set(count, 2)
        expect(calls).toEqual(["root"])
        expect(counters.read("activeSubscriptionScopes")).toBe(1)
        expect(counters.read("activeSubscriptionTargets")).toBe(1)
        expect(counters.read("activeSubscriptions")).toBe(1)
    })

    test("reports exact registration, removal, reach, snapshot, and callback counters", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        let evaluations = 0
        const derived = domain.selector(get => {
            evaluations++
            return get(count)
        })
        const tree = domain.createStoreTree()
        expect(tree.get(derived)).toBe(0)
        const baseline = {
            evaluations,
            propagation: counters.read("propagationSettlements"),
            drafts: counters.read("draftCreations"),
            worksets: counters.read("commitWorksetAllocations"),
            routes: counters.read("routeAdds") + counters.read("routeRemoves"),
        }

        const first = tree.sub(derived, () => undefined)
        const second = tree.sub(derived, () => undefined)
        expect(evaluations).toBe(baseline.evaluations)
        expect(counters.read("propagationSettlements")).toBe(
            baseline.propagation,
        )
        expect(counters.read("draftCreations")).toBe(baseline.drafts)
        expect(counters.read("commitWorksetAllocations")).toBe(
            baseline.worksets,
        )
        expect(counters.read("routeAdds") + counters.read("routeRemoves")).toBe(
            baseline.routes,
        )
        expect(counters.read("subscriptionIndexMapsCreated")).toBe(2)
        expect(counters.read("subscriptionTargetsCreated")).toBe(1)
        expect(counters.read("subscriptionRegistrations")).toBe(2)
        expect(counters.read("unsubscribeClosuresCreated")).toBe(2)
        expect(counters.read("activeSubscriptionScopes")).toBe(1)
        expect(counters.read("activeSubscriptionTargets")).toBe(1)
        expect(counters.read("activeSubscriptions")).toBe(2)

        tree.set(count, 1)
        expect(counters.read("notificationTargetsReached")).toBe(1)
        expect(counters.read("notificationSnapshots")).toBe(1)
        expect(counters.read("subscriberCallbacksAttempted")).toBe(2)
        expect(counters.read("subscriberErrors")).toBe(0)

        first()
        first()
        second()
        expect(counters.read("subscriptionRemovals")).toBe(2)
        expect(counters.read("activeSubscriptionScopes")).toBe(0)
        expect(counters.read("activeSubscriptionTargets")).toBe(0)
        expect(counters.read("activeSubscriptions")).toBe(0)

        for (let index = 0; index < 10_000; index++) {
            tree.sub(derived, () => undefined)()
        }
        expect(counters.read("activeSubscriptionScopes")).toBe(0)
        expect(counters.read("activeSubscriptionTargets")).toBe(0)
        expect(counters.read("activeSubscriptions")).toBe(0)
        expect(evaluations).toBe(baseline.evaluations + 1)
    })

    test("tracks dynamic dependencies, ordinary errors, and cycles without duplicate delivery", () => {
        const domain = createCommittedStoreTreeDomain()
        const chooseLeft = domain.atom(true)
        const left = domain.atom(1)
        const right = domain.atom(10)
        const fail = domain.atom(false)
        const cycleActive = domain.atom(false)
        const ordinary = Object.freeze({ kind: "ordinary" })
        const dynamic = domain.selector(get =>
            get(chooseLeft) ? get(left) : get(right),
        )
        const unstable = domain.selector(get => {
            if (get(fail)) throw ordinary
            return 7
        })
        let cycle!: Selector<number>
        cycle = domain.selector(get => (get(cycleActive) ? get(cycle) : 0))
        const tree = domain.createStoreTree()
        const reached: string[] = []
        tree.sub(dynamic, () => reached.push(`dynamic:${tree.get(dynamic)}`))
        tree.sub(unstable, () => reached.push("unstable"))
        tree.sub(cycle, () => reached.push("cycle"))

        tree.set(right, 11)
        tree.set(left, 2)
        tree.set(chooseLeft, false)
        tree.set(left, 3)
        tree.set(fail, true)
        expect(thrownBy(() => tree.get(unstable))).toBeDefined()
        tree.set(fail, false)
        tree.set(cycleActive, true)
        expect(thrownBy(() => tree.get(cycle))).toBeDefined()
        tree.set(cycleActive, false)

        expect(reached).toEqual([
            "dynamic:2",
            "dynamic:11",
            "unstable",
            "unstable",
            "cycle",
            "cycle",
        ])
    })

    test("keeps inherited and owned scope targets independent across routing-only changes", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        const child = root.scope("child")
        const calls: string[] = []
        root.sub(count, () => calls.push(`root:${root.get(count)}`))
        child.sub(count, () => calls.push(`child:${child.get(count)}`))

        child.set(count, 0)
        child.reset(count)
        expect(calls).toEqual([])
        root.set(count, 1)
        child.set(count, 2)
        root.set(count, 3)
        root.txn(transaction => {
            transaction.set(count, 4)
            transaction.scope(child).set(count, 5)
        })

        expect(calls).toEqual([
            "root:1",
            "child:1",
            "child:2",
            "root:3",
            "root:4",
            "child:5",
        ])
    })

    test("keeps a mismatch caught inside one subscriber sticky but non-authoritative", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const foreignCount = foreign.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        const later = Object.freeze({ kind: "later" })
        const second = Object.freeze({ kind: "second" })
        let caughtMismatch: unknown
        let calls = 0
        tree.sub(count, () => {
            calls++
            try {
                sibling.get(foreignCount)
            } catch (error) {
                caughtMismatch = error
            }
            throw later
        })
        tree.sub(count, () => {
            calls++
            throw second
        })

        const error = thrownBy(() => tree.set(count, 1))
        expect(calls).toBe(2)
        expect(caughtMismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            cause: caughtMismatch,
            causes: [caughtMismatch, second],
        })
        expect((error as SubscriberNotificationError).causes).not.toContain(
            later,
        )
    })

    test("latches a caught installed control outcome into a clean subscriber return", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const trigger = local.atom(0)
        const count = local.atom(0)
        const foreignCount = foreign.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        let contaminate = false
        const installedControl = local.selector(get => {
            get(trigger)
            if (contaminate) sibling.get(foreignCount)
            return 1
        })
        tree.sub(installedControl, () => undefined)

        contaminate = true
        const installedMismatch = thrownBy(() => tree.set(trigger, 1))
        expect(installedMismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(thrownBy(() => tree.get(installedControl))).toBe(
            installedMismatch,
        )

        let caughtMismatch: unknown
        tree.sub(count, () => {
            try {
                tree.get(installedControl)
            } catch (error) {
                caughtMismatch = error
            }
        })

        const error = thrownBy(() => tree.set(count, 1))
        expect(caughtMismatch).toBe(installedMismatch)
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            cause: installedMismatch,
            causes: [installedMismatch],
        })
    })

    test("latches a cold inner-selector mismatch before a later subscriber throw", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const foreignCount = foreign.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        const later = Object.freeze({ kind: "later" })
        const cold = local.selector(() => sibling.get(foreignCount))
        let caughtMismatch: unknown
        tree.sub(count, () => {
            try {
                tree.get(cold)
            } catch (error) {
                caughtMismatch = error
            }
            throw later
        })

        const error = thrownBy(() => tree.set(count, 1))
        expect(caughtMismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            cause: caughtMismatch,
            causes: [caughtMismatch],
        })
        expect((error as SubscriberNotificationError).causes).not.toContain(
            later,
        )
    })

    test("keeps the exact thrown object when its then getter throws during inspection", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const tree = domain.createStoreTree()
        const inspectionError = Object.freeze({ kind: "inspection" })
        let getterCalls = 0
        const thrown = Object.freeze(
            Object.defineProperty({}, "then", {
                get(): never {
                    getterCalls++
                    throw inspectionError
                },
            }),
        )
        tree.sub(count, () => {
            throw thrown
        })

        const error = thrownBy(() => tree.set(count, 1))
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({ cause: thrown, causes: [thrown] })
        expect((error as SubscriberNotificationError).cause).toBe(thrown)
        expect(getterCalls).toBe(1)
    })

    test("keeps a mismatch recognized by thrown-object inspection sticky", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        const count = local.atom(0)
        const foreignCount = foreign.atom(0)
        const tree = local.createStoreTree()
        const sibling = local.createStoreTree()
        let getterCalls = 0
        let recognizedMismatch: unknown
        const thrown = Object.freeze(
            Object.defineProperty({}, "then", {
                get(): unknown {
                    getterCalls++
                    try {
                        return sibling.get(foreignCount)
                    } catch (error) {
                        recognizedMismatch = error
                        throw error
                    }
                },
            }),
        )
        tree.sub(count, () => {
            throw thrown
        })

        const error = thrownBy(() => tree.set(count, 1))
        expect(recognizedMismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            cause: recognizedMismatch,
            causes: [recognizedMismatch],
        })
        expect((error as SubscriberNotificationError).causes).not.toContain(
            thrown,
        )
        expect(getterCalls).toBe(1)
    })

    test("inspects hostile then getters and functions exactly once under quarantine", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const tree = domain.createStoreTree()
        const getterError = Object.freeze({ kind: "getter" })
        let getterCalls = 0
        let returnedThenCalls = 0
        let thrownThenCalls = 0
        let finalCalls = 0
        const hostileGetter = Object.freeze(
            Object.defineProperty({}, "then", {
                get(): never {
                    getterCalls++
                    throw getterError
                },
            }),
        )
        const hostileReturnedFunction = Object.freeze({
            then(): never {
                returnedThenCalls++
                throw new Error("contained returned rejection hookup")
            },
        })
        const hostileThrownFunction = Object.freeze({
            then(): never {
                thrownThenCalls++
                throw new Error("contained thrown rejection hookup")
            },
        })
        tree.sub(count, (() => hostileGetter) as () => void)
        tree.sub(count, (() => hostileReturnedFunction) as () => void)
        tree.sub(count, () => {
            throw hostileThrownFunction
        })
        tree.sub(count, () => {
            finalCalls++
        })

        const error = thrownBy(() => tree.set(count, 1))
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            cause: getterError,
            causes: [getterError, hostileThrownFunction],
        })
        expect(getterCalls).toBe(1)
        expect(returnedThenCalls).toBe(1)
        expect(thrownThenCalls).toBe(1)
        expect(finalCalls).toBe(1)
    })

    test("allocates no subscription structures for unsubscribed mutations", () => {
        const counters = counterHarness()
        const domain = createCommittedStoreTreeDomain(counters.instrumentation)
        const count = domain.atom(0)
        const tree = domain.createStoreTree()

        tree.set(count, 1)
        tree.update(count, value => value + 1)
        tree.reset(count)
        expect(counters.read("subscriptionIndexMapsCreated")).toBe(0)
        expect(counters.read("subscriptionTargetsCreated")).toBe(0)
        expect(counters.read("subscriptionRegistrations")).toBe(0)
        expect(counters.read("unsubscribeClosuresCreated")).toBe(0)
        expect(counters.read("notificationTargetsReached")).toBe(0)
        expect(counters.read("notificationSnapshots")).toBe(0)
        expect(counters.read("subscriberCallbacksAttempted")).toBe(0)
        expect(counters.read("subscriberErrors")).toBe(0)
    })

    test("retains active anonymous coordinates and releases every link after unsubscribe", async () => {
        let retainedUnsubscribe!: () => void
        const references = (() => {
            const domain = createCommittedStoreTreeDomain()
            const state = domain.atom(0)
            const root = domain.createStoreTree()
            const scope = root.scope()
            const callback = (): void => {}
            retainedUnsubscribe = scope.sub(state, callback)
            return [
                new WeakRef(root as object),
                new WeakRef(scope as object),
                new WeakRef(state as object),
                new WeakRef(callback as object),
            ]
        })()

        for (let round = 0; round < 5; round++) {
            await Bun.sleep(0)
            Bun.gc(true)
        }
        expect(
            references.every(reference => reference.deref() !== undefined),
        ).toBe(true)

        retainedUnsubscribe()
        let retained = references.length
        for (let round = 0; round < 20 && retained !== 0; round++) {
            await Bun.sleep(0)
            Bun.gc(true)
            retained = references.filter(
                reference => reference.deref() !== undefined,
            ).length
        }
        expect(retained).toBe(0)
        retainedUnsubscribe()
    })

    test("recreates a disposed name while a stale unsubscribe retains no old coordinate", async () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const root = domain.createStoreTree()
        let staleUnsubscribe!: () => void
        const references = (() => {
            const oldScope = root.scope("same-name")
            const oldCallback = (): void => {}
            staleUnsubscribe = oldScope.sub(count, oldCallback)
            oldScope.dispose()
            return [
                new WeakRef(oldScope as object),
                new WeakRef(oldCallback as object),
            ]
        })()
        const replacement = root.scope("same-name")
        let replacementCalls = 0
        replacement.sub(count, () => replacementCalls++)

        staleUnsubscribe()
        replacement.set(count, 1)
        expect(replacementCalls).toBe(1)

        let retained = references.length
        for (let round = 0; round < 20 && retained !== 0; round++) {
            await Bun.sleep(0)
            Bun.gc(true)
            retained = references.filter(
                reference => reference.deref() !== undefined,
            ).length
        }
        expect(retained).toBe(0)
        staleUnsubscribe()
    })

    test("keeps the two-argument zero-value-callback declaration exact", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const tree = domain.createStoreTree()
        tree.sub(count, () => undefined)()
        if (false) {
            // @ts-expect-error Subscriber callbacks receive no settled value.
            tree.sub(count, (value: number) => value)
            // @ts-expect-error The beta deep-equality flag is absent.
            tree.sub(count, () => undefined, false)
            // @ts-expect-error Store.sub requires a readable State.
            tree.sub({}, () => undefined)
        }
    })
})
