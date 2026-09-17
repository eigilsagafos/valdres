import { describe, expect, test } from "bun:test"
import {
    RuntimeMismatchError,
    SubscriberNotificationError,
    createCommittedStoreTreeDomain,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    ExternalSourceDeliveryLimitError,
    ExternalSourceNonConvergenceError,
    ExternalSourceOperationError,
    InvalidExternalCleanupError,
    configureInternalExternalBounds,
    createInternalExternalAtom,
} from "../../src/v1-internal/committed-store-tree/external-atom"

function thrown(operation: () => unknown): unknown {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

function expectNotification(
    error: unknown,
    causes: readonly unknown[],
    source: string,
): void {
    expect(error).toBeInstanceOf(SubscriberNotificationError)
    const notification = error as SubscriberNotificationError
    expect(notification).toMatchObject({
        code: "VALDRES_SUBSCRIBER_NOTIFICATION",
        committed: true,
        phase: "notifying",
        source,
    })
    expect(notification.cause).toBe(causes[0])
    expect(notification.causes).toEqual(causes)
    expect(Object.isFrozen(notification)).toBe(true)
    expect(Object.isFrozen(notification.causes)).toBe(true)
}

describe("external failure occurrence ledger", () => {
    test("an unrelated external plane preserves the owned mutation mismatch notification wrapper", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const mode = domain.atom(false)
        const alien = createCommittedStoreTreeDomain().atom(0)
        const notification = new Error("owned subscriber failure")
        const callbacks: string[] = []
        let mismatch: unknown
        const unrelated = createInternalExternalAtom(domain, {
            getSnapshot: () => 1,
            subscribe: () => () => {},
        })
        expect(tree.get(unrelated)).toBe(1)
        const selected = domain.selector(get => {
            if (!get(mode)) return 0
            try {
                return get(alien)
            } catch (error) {
                mismatch = error
                throw error
            }
        })
        tree.sub(selected, () => {
            callbacks.push("throwing")
            throw notification
        })
        tree.sub(selected, () => callbacks.push("last"))

        const error = thrown(() => tree.set(mode, true))

        expect(mismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(callbacks).toEqual(["throwing", "last"])
        expect(tree.get(mode)).toBe(true)
        expectNotification(error, [mismatch, notification], "owned-mutation")
        expect(thrown(() => tree.get(selected))).toBe(mismatch)
    })

    test("a later owned mutation surfaces an installed external control error after all callbacks", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const mode = domain.atom(false)
        const alien = createCommittedStoreTreeDomain().atom(0)
        const callbacks: string[] = []
        let fail = false,
            invalidate!: () => void,
            mismatch: unknown
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                if (fail) {
                    try {
                        return tree.get(alien)
                    } catch (error) {
                        mismatch = error
                        throw error
                    }
                }
                return 1
            },
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        tree.sub(external, () => {})
        const selected = domain.selector(get => (get(mode) ? get(external) : 0))
        tree.sub(selected, () => callbacks.push("first"))
        tree.sub(selected, () => callbacks.push("last"))
        fail = true
        expect(thrown(invalidate)).toBe(mismatch)
        expect(mismatch).toBeInstanceOf(RuntimeMismatchError)
        let mutationFailure: unknown

        try {
            tree.set(mode, true)
        } catch (error) {
            mutationFailure = error
        }

        expect(tree.get(mode)).toBe(true)
        expect(callbacks).toEqual(["first", "last"])
        expect(mutationFailure).toBe(mismatch)
        expect(thrown(() => tree.get(selected))).toBe(mismatch)
    })

    test("a cold nested selector chain propagates one control failure occurrence", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const alien = createCommittedStoreTreeDomain().atom(0)
        let value = 0,
            invalidate!: () => void,
            original: unknown,
            leafRuns = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        const leaf = domain.selector(() => {
            leafRuns++
            try {
                return tree.get(alien)
            } catch (error) {
                original = error
                throw error
            }
        })
        const middle = domain.selector(get => get(leaf))
        const top = domain.selector(get => (get(external) ? get(middle) : 0))
        const stop = tree.sub(top, () => {})
        expect(leafRuns).toBe(0)
        value = 1

        const error = thrown(invalidate)

        expect(original).toBeInstanceOf(RuntimeMismatchError)
        expect(error).toBe(original)
        expect(leafRuns).toBe(1)
        expect(thrown(() => tree.get(top))).toBe(original)
        stop()
    })

    test("preserves two setup occurrences that throw the same application error", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const cause = new Error("shared setup failure")
        const attempts: string[] = []
        const source = (label: string) =>
            createInternalExternalAtom(domain, {
                getSnapshot: () => 0,
                subscribe() {
                    attempts.push(label)
                    throw cause
                },
            })
        const a = source("a"),
            b = source("b")
        const combined = domain.selector(get => get(a) + get(b))

        const error = thrown(() =>
            tree.sub(combined, () => {}),
        ) as ExternalSourceOperationError

        expect([...attempts].sort()).toEqual(["a", "b"])
        expect(error).toBeInstanceOf(ExternalSourceOperationError)
        expect(error.causes).toEqual([cause, cause])
        expect(error.failures).toEqual([
            {
                cause,
                committed: false,
                phase: "admitting",
                source: "external-startup",
            },
            {
                cause,
                committed: false,
                phase: "admitting",
                source: "external-startup",
            },
        ])
        expect(Object.isFrozen(error)).toBe(true)
        expect(Object.isFrozen(error.causes)).toBe(true)
        expect(Object.isFrozen(error.failures)).toBe(true)
        for (const failure of error.failures)
            expect(Object.isFrozen(failure)).toBe(true)
        expect(Object.isFrozen(cause)).toBe(false)
    })

    test("preserves two cleanup occurrences and revokes both generations before returning", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const cause = new Error("shared cleanup failure")
        const cleanups: string[] = []
        const invalidators: (() => void)[] = []
        let samples = 0
        const source = (label: string) =>
            createInternalExternalAtom(domain, {
                getSnapshot() {
                    samples++
                    return 0
                },
                subscribe(invalidate) {
                    invalidators.push(invalidate)
                    return () => {
                        cleanups.push(label)
                        throw cause
                    }
                },
            })
        const a = source("a"),
            b = source("b")
        const combined = domain.selector(get => get(a) + get(b))
        const stop = tree.sub(combined, () => {})

        const error = thrown(stop) as ExternalSourceOperationError

        expect([...cleanups].sort()).toEqual(["a", "b"])
        expect(error).toBeInstanceOf(ExternalSourceOperationError)
        expect(error.causes).toEqual([cause, cause])
        expect(error.failures).toEqual([
            {
                cause,
                committed: false,
                phase: "cleanup",
                source: "external-cleanup",
            },
            {
                cause,
                committed: false,
                phase: "cleanup",
                source: "external-cleanup",
            },
        ])
        const samplesBeforeStaleCallbacks = samples
        for (const invalidate of invalidators) invalidate()
        stop()
        expect(samples).toBe(samplesBeforeStaleCallbacks)
        expect([...cleanups].sort()).toEqual(["a", "b"])
        expect(Object.isFrozen(cause)).toBe(false)
    })

    test("preserves identical causes across setup failure and rollback cleanup", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const cause = new Error("shared setup and cleanup failure")
        const events: string[] = []
        const a = createInternalExternalAtom(domain, {
            getSnapshot: () => 0,
            subscribe: () => () => {
                events.push("cleanup")
                throw cause
            },
        })
        const b = createInternalExternalAtom(domain, {
            getSnapshot: () => 0,
            subscribe() {
                events.push("setup")
                throw cause
            },
        })
        const combined = domain.selector(get => get(a) + get(b))

        const error = thrown(() =>
            tree.sub(combined, () => {}),
        ) as ExternalSourceOperationError

        expect(events).toEqual(["setup", "cleanup"])
        expect(error).toBeInstanceOf(ExternalSourceOperationError)
        expect(error.causes).toEqual([cause, cause])
        expect(
            error.failures.map(failure => [failure.phase, failure.source]),
        ).toEqual([
            ["admitting", "external-startup"],
            ["cleanup", "external-cleanup"],
        ])
        expect(Object.isFrozen(cause)).toBe(false)
    })
})

describe("external subscriber notification contract", () => {
    test("startup notification keeps SubscriberNotificationError and rolls back admission", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const cause = new Error("startup subscriber")
        let value = 0,
            cleanups = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe() {
                value = 1
                return () => {
                    cleanups++
                }
            },
        })

        const error = thrown(() =>
            tree.sub(external, () => {
                throw cause
            }),
        )

        expectNotification(error, [cause], "external-startup")
        expect(cleanups).toBe(1)
        expect(tree.get(external)).toBe(1)
    })

    test("idle invalidation retains repeated callback causes and runs the entire snapshot", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const cause = new Error("shared notification failure")
        const seen: string[] = []
        let value = 0,
            invalidate!: () => void
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        tree.sub(external, () => {
            seen.push("first")
            throw cause
        })
        tree.sub(external, () => {
            seen.push("second")
            throw cause
        })
        tree.sub(external, () => seen.push("last"))
        value = 1

        const error = thrown(invalidate)

        expectNotification(error, [cause, cause], "external-invalidation")
        expect(seen).toEqual(["first", "second", "last"])
        expect(tree.get(external)).toBe(1)
        expect(Object.isFrozen(cause)).toBe(false)
    })

    test("callback-triggered external delivery identifies the drain as its notification source", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const trigger = domain.atom(0)
        const cause = new Error("drain subscriber")
        let value = 0,
            invalidate!: () => void
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        tree.sub(external, () => {
            throw cause
        })
        tree.sub(trigger, () => {
            value = 1
            invalidate()
        })

        const error = thrown(() => tree.set(trigger, 1))

        expectNotification(error, [cause], "external-drain")
        expect(tree.get(trigger)).toBe(1)
        expect(tree.get(external)).toBe(1)
    })

    test("a read retry reports catch-up notification with external-read metadata", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const mode = domain.atom(false)
        const setupError = new Error("first setup")
        const cause = new Error("retry subscriber")
        let value = 0,
            attempts = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe() {
                if (++attempts === 1) throw setupError
                value = 1
                return () => {}
            },
        })
        const selected = domain.selector(get => (get(mode) ? get(external) : 0))
        tree.sub(selected, () => {
            throw cause
        })
        expect(
            (thrown(() => tree.set(mode, true)) as ExternalSourceOperationError)
                .cause,
        ).toBe(setupError)

        const error = thrown(() => tree.get(selected))

        expectNotification(error, [cause], "external-read")
        expect(attempts).toBe(2)
        expect(tree.get(selected)).toBe(1)
    })
})

describe("direct external lifecycle and bound metadata", () => {
    for (const committed of [false, true]) {
        test(`invalid setup cleanup reports the operation's committed=${committed} state`, () => {
            const domain = createCommittedStoreTreeDomain()
            const tree = domain.createStoreTree()
            const mode = domain.atom(false)
            let invalidator!: () => void,
                samples = 0
            const external = createInternalExternalAtom(domain, {
                getSnapshot() {
                    samples++
                    return 0
                },
                subscribe(listener) {
                    invalidator = listener
                    return undefined as unknown as () => void
                },
            })
            const selected = domain.selector(get =>
                get(mode) ? get(external) : 0,
            )
            if (committed) tree.sub(selected, () => {})

            const error = thrown(() =>
                committed ? tree.set(mode, true) : tree.sub(external, () => {}),
            )

            expect(error).toBeInstanceOf(InvalidExternalCleanupError)
            expect(error).toMatchObject({
                code: "VALDRES_INVALID_EXTERNAL_CLEANUP",
                phase: "admitting",
                source: "external-startup",
                committed,
            })
            expect(Object.isFrozen(error)).toBe(true)
            const samplesBeforeStaleCallback = samples
            invalidator()
            expect(samples).toBe(samplesBeforeStaleCallback)
        })
    }

    test("a cleanup thenable reports frozen cleanup metadata on the direct error", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        let contained = 0,
            cleanups = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => 1,
            subscribe: () => () => {
                cleanups++
                return {
                    then(_resolve: unknown, reject: (cause: unknown) => void) {
                        contained++
                        reject(new Error("contained cleanup rejection"))
                    },
                }
            },
        })
        const stop = tree.sub(external, () => {})

        const error = thrown(stop)

        expect(error).toBeInstanceOf(InvalidExternalCleanupError)
        expect(error).toMatchObject({
            code: "VALDRES_INVALID_EXTERNAL_CLEANUP",
            phase: "cleanup",
            source: "external-cleanup",
            committed: false,
        })
        expect(Object.isFrozen(error)).toBe(true)
        expect([contained, cleanups]).toEqual([1, 1])
        stop()
        expect(cleanups).toBe(1)
    })

    test("denied cross-tree delivery reports uncommitted sampling metadata", () => {
        const domain = createCommittedStoreTreeDomain()
        const firstTree = domain.createStoreTree()
        const secondTree = domain.createStoreTree()
        let firstValue = 0,
            secondValue = 0,
            invalidateFirst!: () => void,
            invalidateSecond!: () => void,
            denied: unknown
        const first = createInternalExternalAtom(domain, {
            getSnapshot: () => firstValue,
            subscribe(listener) {
                invalidateFirst = listener
                return () => {}
            },
        })
        const second = createInternalExternalAtom(domain, {
            getSnapshot: () => secondValue,
            subscribe(listener) {
                invalidateSecond = listener
                return () => {}
            },
        })
        secondTree.sub(second, () => {})
        firstTree.sub(first, () => {
            secondValue = 2
            denied = thrown(invalidateSecond)
        })
        configureInternalExternalBounds(domain, { deliveryDepth: 1 })
        firstValue = 1

        invalidateFirst()

        expect(denied).toBeInstanceOf(ExternalSourceDeliveryLimitError)
        expect(denied).toMatchObject({
            code: "VALDRES_EXTERNAL_SOURCE_DELIVERY_LIMIT",
            phase: "sampling",
            source: "external-invalidation",
            committed: false,
        })
        expect(Object.isFrozen(denied)).toBe(true)
        expect(secondTree.get(second)).toBe(0)
        invalidateSecond()
        expect(secondTree.get(second)).toBe(2)
    })

    test("nonconvergence reports the committed terminal drain and retains exact error identity", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        let value = 0,
            feedback = true,
            invalidate!: () => void
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        tree.sub(external, () => {
            if (feedback) {
                value++
                invalidate()
            }
        })
        configureInternalExternalBounds(domain, { rounds: 1 })
        value = 1

        const error = thrown(invalidate)

        expect(error).toBeInstanceOf(ExternalSourceNonConvergenceError)
        expect(error).toMatchObject({
            code: "VALDRES_EXTERNAL_SOURCE_NON_CONVERGENCE",
            phase: "sampling",
            source: "external-drain",
            committed: true,
        })
        expect(Object.isFrozen(error)).toBe(true)
        expect(thrown(() => tree.get(external))).toBe(error)
        feedback = false
        value = 10
        invalidate()
        expect(tree.get(external)).toBe(10)
    })
})
