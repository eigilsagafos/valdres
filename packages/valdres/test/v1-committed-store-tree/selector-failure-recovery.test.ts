import { describe, expect, test } from "bun:test"
import {
    RuntimeMismatchError,
    SubscriberNotificationError,
    createCommittedStoreTreeDomain,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createInternalExternalAtom } from "../../src/v1-internal/committed-store-tree/external-atom"
import { StoreScopeNode } from "../../src/v1-internal/committed-store-tree/scope-node"
import {
    SelectorDependencyError,
    SelectorGetterError,
} from "../../src/v1-internal/selector-evaluator/errors"
import { evaluateSelector } from "../../src/v1-internal/selector-evaluator/evaluate"

/*
 * Selector failures that escape evaluation outside settle handlers. Faults are
 * injected through the internal evaluation seam, either before the evaluator
 * runs or after it returns but before its proposal is installed. That is
 * internal fault injection, not a public selector throw; the ordinary-throw
 * controls cover the public path. Every chain is materialized and cached
 * before the write, and callbacks read the cached downstream selector first,
 * before any read could repair an upstream node.
 */
type Fault = "before evaluation" | "after evaluation"
const FAULTS = ["before evaluation", "after evaluation"] as const

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const faultyTree = (fault: Fault) => {
    const domain = createCommittedStoreTreeDomain()
    const cause = new Error(fault)
    const armed = new Map<string, { remaining: number; error: unknown }>()
    const attempts = new Map<string, number>()
    let scope: StoreScopeNode | undefined
    const tree = domain.createStoreTree(
        undefined,
        Object.assign(() => {}, {
            evaluate: ((...args: Parameters<typeof evaluateSelector>) => {
                const name = args[0].name as string
                if (args[1] instanceof StoreScopeNode) scope = args[1]
                attempts.set(name, (attempts.get(name) ?? 0) + 1)
                const injection = armed.get(name)
                if (injection !== undefined && injection.remaining > 0) {
                    injection.remaining--
                    if (fault === "after evaluation") evaluateSelector(...args)
                    throw injection.error
                }
                return evaluateSelector(...args)
            }) as typeof evaluateSelector,
        }),
    )
    const read = <Value>(
        state: Parameters<typeof tree.get<Value>>[0],
    ): unknown => {
        try {
            return tree.get(state)
        } catch (error) {
            return error
        }
    }
    return {
        domain,
        tree,
        cause,
        read,
        /** Fail the next `times` evaluations of the named selector. */
        arm: (name: string, times = 1, error: unknown = cause) =>
            void armed.set(name, { remaining: times, error }),
        attempts: (name: string) => attempts.get(name) ?? 0,
        dependencies: (state: object) =>
            scope
                ?.getSelectorRecord(state as never)
                ?.dependencies.map(dependency => dependency.node),
    }
}

/** `SelectorGetterError <- SelectorDependencyError <- ...` down to `cause`. */
const expectDependencyChain = (
    value: unknown,
    cause: unknown,
    depth: number,
) => {
    let current = value
    for (let level = 0; level < depth; level++) {
        expect(current).toBeInstanceOf(SelectorGetterError)
        const dependency = (current as SelectorGetterError).cause
        expect(dependency).toBeInstanceOf(SelectorDependencyError)
        current = (dependency as SelectorDependencyError).cause
    }
    expect(current).toBe(cause)
}

type Trigger = "owned set" | "owned transaction" | "external invalidation"

const chain = (fault: Fault, trigger: Trigger) => {
    const t = faultyTree(fault)
    const { domain, tree } = t
    let value = 0
    let invalidate = () => {}
    const source =
        trigger === "external invalidation"
            ? createInternalExternalAtom(domain, {
                  getSnapshot: () => value,
                  subscribe(next) {
                      invalidate = next
                      return () => {}
                  },
              })
            : domain.atom(0)
    const unrelated = domain.atom(0)
    const derived = domain.selector(get => get(source) * 10, {
        name: "derived",
    })
    const combined = domain.selector(get => get(derived) + 1, {
        name: "combined",
    })
    const tail = domain.selector(get => get(combined) * 2, { name: "tail" })
    const publish = (next: number) => {
        if (trigger === "external invalidation") {
            value = next
            invalidate()
        } else if (trigger === "owned set")
            tree.set(source as ReturnType<typeof domain.atom<number>>, next)
        else
            tree.txn(tx =>
                tx.set(source as ReturnType<typeof domain.atom<number>>, next),
            )
    }
    // `tail` stays cached but unsubscribed.
    expect(tree.get(tail)).toBe(2)
    const observations: unknown[][] = []
    const calls = { derived: 0, combined: 0 }
    tree.sub(source, () => {
        observations.push([t.read(tail), t.read(combined), t.read(derived)])
    })
    tree.sub(derived, () => void calls.derived++)
    tree.sub(combined, () => void calls.combined++)
    return {
        ...t,
        source,
        unrelated,
        derived,
        combined,
        tail,
        publish,
        observations,
        calls,
    }
}

const expectFailedChain = (
    values: readonly unknown[] | undefined,
    cause: unknown,
) => {
    const [tail, combined, derived] = values!
    expectDependencyChain(tail, cause, 2)
    expectDependencyChain(combined, cause, 1)
    expect(derived).toBe(cause)
}

describe("escaped selector failures outside settle handlers", () => {
    for (const trigger of [
        "owned set",
        "owned transaction",
        "external invalidation",
    ] as const)
        for (const fault of FAULTS)
            test(`${trigger}, failure ${fault}: no cached descendant is served stale`, () => {
                const c = chain(fault, trigger)
                c.arm("derived")

                // The applied write is retained and the exact failure reported
                // after the branch settled and notified.
                expect(thrownBy(() => c.publish(1))).toBe(c.cause)
                expect(c.read(c.source)).toBe(1)
                expect(c.observations).toHaveLength(1)
                expectFailedChain(c.observations[0], c.cause)
                expect(c.calls).toEqual({ derived: 1, combined: 1 })
                expectFailedChain(
                    [c.read(c.tail), c.read(c.combined), c.read(c.derived)],
                    c.cause,
                )
                // The failure keeps its dependency edge.
                expect(c.dependencies(c.derived)).toEqual([c.source])

                // Unrelated work and an equal write keep the failure current
                // without re-evaluating or notifying.
                const attempts = c.attempts("derived")
                c.tree.set(c.unrelated, 1)
                c.publish(1)
                expect(c.attempts("derived")).toBe(attempts)
                expect(c.observations).toHaveLength(1)
                expect(c.calls).toEqual({ derived: 1, combined: 1 })
                expect(c.read(c.derived)).toBe(c.cause)

                // A changed input re-evaluates the branch once and recovers it,
                // including the unsubscribed cached tail.
                c.publish(3)
                expect(c.attempts("derived")).toBe(attempts + 1)
                expect(c.observations[1]).toEqual([62, 31, 30])
                expect(c.calls).toEqual({ derived: 2, combined: 2 })
                // Returning to the last successful value still notifies.
                c.publish(0)
                expect(c.observations[2]).toEqual([2, 1, 0])
                expect(c.calls).toEqual({ derived: 3, combined: 3 })
                c.tree.dispose()
            })

    for (const fault of FAULTS)
        test(`owned write, failure ${fault}: subscriber failures are isolated and aggregated after the escaped failure`, () => {
            const c = chain(fault, "owned set")
            const observerFailure = new Error("observer")
            let failed = false
            c.tree.sub(c.combined, () => {
                if (failed) return
                failed = true
                throw observerFailure
            })
            c.arm("derived")

            const error = thrownBy(() => c.publish(1))

            expect(error).toBeInstanceOf(SubscriberNotificationError)
            expect(error).toMatchObject({
                causes: [c.cause, observerFailure],
                committed: true,
                source: "owned-mutation",
            })
            expect(c.calls).toEqual({ derived: 1, combined: 1 })
            expectFailedChain(c.observations[0], c.cause)
            c.publish(2)
            expect(c.observations[1]).toEqual([42, 21, 20])
        })

    test("independent escaped failures in one write are all reported in settlement order", () => {
        const t = faultyTree("before evaluation")
        const input = t.domain.atom(0)
        const first = t.domain.selector(get => get(input) + 1, {
            name: "first",
        })
        const second = t.domain.selector(get => get(input) + 2, {
            name: "second",
        })
        t.tree.sub(first, () => {})
        t.tree.sub(second, () => {})
        const secondCause = new Error("second")
        t.arm("first")
        t.arm("second", 1, secondCause)

        const error = thrownBy(() => t.tree.set(input, 1))

        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(error).toMatchObject({
            causes: [t.cause, secondCause],
            committed: true,
            source: "owned-mutation",
        })
        expect(t.read(first)).toBe(t.cause)
        expect(t.read(second)).toBe(secondCause)
        t.tree.set(input, 2)
        expect([t.read(first), t.read(second)]).toEqual([3, 4])
    })

    for (const fault of FAULTS)
        test(`dormant external read, failure ${fault}: the failed pull leaves no stale cached descendant`, () => {
            const t = faultyTree(fault)
            let value = 1
            const source = createInternalExternalAtom(t.domain, {
                getSnapshot: () => value,
                subscribe: () => () => {},
            })
            const derived = t.domain.selector(get => get(source) * 10, {
                name: "derived",
            })
            const combined = t.domain.selector(get => get(derived) + 1, {
                name: "combined",
            })
            const tail = t.domain.selector(get => get(combined) * 2, {
                name: "tail",
            })
            expect(t.read(tail)).toBe(22)
            value = 2
            t.arm("derived")

            expect(t.read(tail)).toBe(t.cause)
            // Later reads of the same sample must not serve combined = 11.
            expectDependencyChain(t.read(combined), t.cause, 1)
            expect(t.read(derived)).toBe(t.cause)
            expectDependencyChain(t.read(tail), t.cause, 2)
            value = 3
            expect([t.read(tail), t.read(combined), t.read(derived)]).toEqual([
                62, 31, 30,
            ])
        })

    test("a persistent escaped failure is re-attempted once per relevant change and recovers when it clears", () => {
        const c = chain("before evaluation", "owned set")
        c.arm("derived", Number.POSITIVE_INFINITY)
        const materialized = c.attempts("derived")

        expect(thrownBy(() => c.publish(1))).toBe(c.cause)
        const attempts = c.attempts("derived")
        expect(attempts).toBe(materialized + 1)
        // Reads serve the published failure without re-running the selector.
        expect(c.read(c.derived)).toBe(c.cause)
        expectDependencyChain(c.read(c.tail), c.cause, 2)
        c.tree.set(c.unrelated, 1)
        c.publish(1)
        expect(c.attempts("derived")).toBe(attempts)
        // Each changed input re-attempts exactly once and republishes.
        expect(thrownBy(() => c.publish(2))).toBe(c.cause)
        expect(c.attempts("derived")).toBe(attempts + 1)
        expectFailedChain(c.observations[1], c.cause)
        expect(c.calls).toEqual({ derived: 2, combined: 2 })

        c.arm("derived", 0)
        c.publish(3)
        expect(c.attempts("derived")).toBe(attempts + 2)
        expect(c.observations[2]).toEqual([62, 31, 30])
    })

    for (const trigger of ["settle commit", "owned set"] as const)
        test(`${trigger}: a latched control fault plus an escaped evaluation publishes the control error through cached descendants`, () => {
            const t = faultyTree("after evaluation")
            const foreign = createCommittedStoreTreeDomain().atom(10)
            const flag = t.domain.atom(false)
            const input = t.domain.atom(2)
            const start = t.domain.atom(0)
            const middle = t.domain.selector(
                get => (get(flag) ? get(foreign) : get(input)),
                { name: "middle" },
            )
            const tail = t.domain.selector(get => get(middle) * 10, {
                name: "tail",
            })
            expect(t.read(tail)).toBe(20)
            const seen: unknown[] = []
            let tailNotifications = 0
            t.tree.sub(tail, () => void tailNotifications++)
            const notify = () => void seen.push(t.read(tail))
            if (trigger === "settle commit")
                t.tree.sub(start, { settle: tx => tx.set(flag, true), notify })
            else t.tree.sub(start, notify)
            t.arm("middle")

            const error = thrownBy(() =>
                trigger === "settle commit"
                    ? t.tree.set(start, 1)
                    : t.tree.txn(tx => {
                          tx.set(start, 1)
                          tx.set(flag, true)
                      }),
            )

            // The write is kept, the authoritative control fault leads the
            // report, and the escaped error is still reported after it.
            expect(t.read(flag)).toBe(true)
            expect(error).toBeInstanceOf(SubscriberNotificationError)
            const causes = (error as SubscriberNotificationError).causes
            expect(causes[0]).toBeInstanceOf(RuntimeMismatchError)
            expect(causes[1]).toBe(t.cause)
            // No pre-write value survives: the first downstream read and the
            // cached tail both serve the control error, and tail notified.
            expect(seen[0]).toBeInstanceOf(RuntimeMismatchError)
            expect(t.read(tail)).toBeInstanceOf(RuntimeMismatchError)
            expect(tailNotifications).toBe(1)
            expect(t.dependencies(middle)).toEqual([flag])

            t.tree.set(flag, false)
            expect(t.read(tail)).toBe(20)
            expect(tailNotifications).toBe(2)
        })

    test("control: an ordinary selector throw publishes a selector error without an operation failure", () => {
        const domain = createCommittedStoreTreeDomain()
        const tree = domain.createStoreTree()
        const cause = new Error("selector")
        const source = domain.atom(0)
        const derived = domain.selector(get => {
            const next = get(source) * 10
            if (next === 10) throw cause
            return next
        })
        const combined = domain.selector(get => get(derived) + 1)
        const tail = domain.selector(get => get(combined) * 2)
        expect(tree.get(tail)).toBe(2)
        const observations: unknown[][] = []
        const read = (state: typeof tail) => {
            try {
                return tree.get(state)
            } catch (error) {
                return error
            }
        }
        tree.sub(source, () =>
            observations.push([read(tail), read(combined), read(derived)]),
        )

        tree.set(source, 1)

        const [tailValue, combinedValue, derivedValue] = observations[0]!
        expect(derivedValue).toBeInstanceOf(SelectorGetterError)
        expect((derivedValue as SelectorGetterError).cause).toBe(cause)
        expectDependencyChain(combinedValue, derivedValue, 1)
        expectDependencyChain(tailValue, derivedValue, 2)
        tree.set(source, 3)
        expect(observations[1]).toEqual([62, 31, 30])
    })
})

describe("a dependency that fails on its first evaluation", () => {
    const branch = (fault: Fault, alreadyOn: boolean) => {
        const t = faultyTree(fault)
        const { domain } = t
        const flag = domain.atom(alreadyOn)
        const input = domain.atom(1)
        const fresh = domain.selector(get => get(input) * 10, {
            name: "fresh",
        })
        const reader = domain.selector(
            get => (get(flag) ? get(fresh) + 1 : -1),
            { name: "reader" },
        )
        const fallback = domain.selector(
            get => {
                if (!get(flag)) return "off"
                try {
                    return get(fresh)
                } catch {
                    return "fallback"
                }
            },
            { name: "fallback" },
        )
        return { ...t, flag, input, fresh, reader, fallback }
    }

    const expectFirstFailure = (b: ReturnType<typeof branch>) => {
        expectDependencyChain(b.read(b.reader), b.cause, 1)
        expect(
            (
                (b.read(b.reader) as SelectorGetterError)
                    .cause as SelectorDependencyError
            ).dependency,
        ).toBe(b.fresh)
        // A caught read still establishes the dependency, and every reader in
        // the boundary sees the same failure.
        expect(b.read(b.fallback)).toBe("fallback")
        expect(b.read(b.fresh)).toBe(b.cause)
        expect(b.dependencies(b.reader)).toEqual([b.flag, b.fresh])
        expect(b.dependencies(b.fallback)).toEqual([b.flag, b.fresh])
    }

    for (const where of ["newly read during a write", "cold read"] as const) {
        const setup = (fault: Fault) => {
            const b = branch(fault, where === "cold read")
            const seen: unknown[] = []
            b.arm("fresh")
            let error: unknown
            if (where === "newly read during a write") {
                b.tree.sub(b.reader, () => seen.push(b.read(b.reader)))
                b.tree.sub(b.fallback, () => seen.push(b.read(b.fallback)))
                error = thrownBy(() => b.tree.set(b.flag, true))
            } else {
                error = b.read(b.reader)
                b.tree.sub(b.reader, () => seen.push(b.read(b.reader)))
                b.tree.sub(b.fallback, () => seen.push(b.read(b.fallback)))
            }
            return { b, seen, error }
        }

        test(`${where}, failure after evaluation: the reader records the edge and recovers when the dependency's input changes`, () => {
            const { b, seen, error } = setup("after evaluation")

            if (where === "newly read during a write") {
                // Reported by the write whose settlement it escaped.
                expect(error).toBe(b.cause)
                expect(seen).toHaveLength(2)
            } else {
                // A plain read serves the reader's coherent outcome.
                expectDependencyChain(error, b.cause, 1)
            }
            expectFirstFailure(b)
            expect(b.dependencies(b.fresh)).toEqual([b.input])

            const count = seen.length
            b.tree.set(b.input, 2)
            expect([b.read(b.reader), b.read(b.fallback)]).toEqual([21, 20])
            expect(seen.slice(count)).toEqual([21, 20])
        })

        test(`${where}, failure before evaluation: the reader records the edge and a dependent's re-evaluation re-attempts the failure`, () => {
            const { b, seen, error } = setup("before evaluation")

            if (where === "newly read during a write")
                expect(error).toBe(b.cause)
            else expectDependencyChain(error, b.cause, 1)
            expectFirstFailure(b)
            // The failure escaped before `fresh` read anything, so no input of
            // it is known; its own input cannot re-attempt it.
            expect(b.dependencies(b.fresh)).toEqual([])
            const attempts = b.attempts("fresh")
            const count = seen.length
            b.tree.set(b.input, 2)
            expect(b.attempts("fresh")).toBe(attempts)
            expect(b.read(b.fresh)).toBe(b.cause)
            expect(seen).toHaveLength(count)

            // The next settlement in which a dependent reads it again
            // re-attempts it once, and every dependent holding the edge
            // recovers.
            b.tree.set(b.flag, false)
            expect([b.read(b.reader), b.read(b.fallback)]).toEqual([-1, "off"])
            b.tree.set(b.flag, true)
            expect(b.attempts("fresh")).toBe(attempts + 1)
            expect([b.read(b.reader), b.read(b.fallback)]).toEqual([21, 20])
            expect(b.dependencies(b.fresh)).toEqual([b.input])
        })
    }

    test("another dependent's settlement re-attempts the failure and recovers a reader whose own inputs never changed", () => {
        const b = branch("before evaluation", true)
        const other = b.domain.atom(false)
        const sibling = b.domain.selector(
            get => (get(other) ? get(b.fresh) : 0),
            { name: "sibling" },
        )
        b.tree.sub(sibling, () => {})
        b.arm("fresh")
        expectDependencyChain(b.read(b.reader), b.cause, 1)
        const seen: unknown[] = []
        b.tree.sub(b.reader, () => seen.push(b.read(b.reader)))

        b.tree.set(other, true)

        expect(b.read(sibling)).toBe(10)
        expect(b.read(b.reader)).toBe(11)
        expect(seen).toEqual([11])
    })

    test("a persistent first-evaluation failure is re-attempted only when a later settlement re-reads it", () => {
        const b = branch("before evaluation", false)
        b.tree.sub(b.reader, () => {})
        b.tree.sub(b.fallback, () => {})
        b.arm("fresh", Number.POSITIVE_INFINITY)

        expect(thrownBy(() => b.tree.set(b.flag, true))).toBe(b.cause)
        // Both readers share one attempt within the boundary.
        expect(b.attempts("fresh")).toBe(1)
        expect(b.read(b.fallback)).toBe("fallback")
        // Reads and unrelated settlements never re-attempt it.
        b.read(b.fresh)
        b.read(b.reader)
        b.tree.set(b.input, 2)
        expect(b.attempts("fresh")).toBe(1)
        // Dependents that stop reading it neither re-attempt nor report it.
        b.tree.set(b.flag, false)
        expect(b.attempts("fresh")).toBe(1)
        // Re-reading it re-attempts it once and reports the new occurrence.
        expect(thrownBy(() => b.tree.set(b.flag, true))).toBe(b.cause)
        expect(b.attempts("fresh")).toBe(2)

        b.arm("fresh", 0)
        b.tree.set(b.flag, false)
        b.tree.set(b.flag, true)
        expect(b.attempts("fresh")).toBe(3)
        expect([b.read(b.reader), b.read(b.fallback)]).toEqual([21, 20])
    })

    test("lifecycle catch-up waves of one settlement re-attempt a dependency-less failure at most once", () => {
        const t = faultyTree("before evaluation")
        const input = t.domain.atom(1)
        const trigger = t.domain.atom(false)
        // Each source changes when first subscribed, so reaching them one by
        // one adds a catch-up wave to the same settlement.
        const sources = Array.from({ length: 3 }, () => {
            let snapshot = 0
            return createInternalExternalAtom(t.domain, {
                getSnapshot: () => snapshot,
                subscribe() {
                    snapshot = 1
                    return () => {}
                },
            })
        })
        const fresh = t.domain.selector(get => get(input), { name: "fresh" })
        let parentRuns = 0
        const parent = t.domain.selector(
            get => {
                parentRuns++
                let base: number
                try {
                    base = get(fresh)
                } catch {
                    base = 100
                }
                if (!get(trigger)) return base
                let count = base
                for (const source of sources) {
                    if (get(source) === 0) break
                    count++
                }
                return count
            },
            { name: "parent" },
        )
        t.arm("fresh", Number.POSITIVE_INFINITY)
        let notifications = 0
        t.tree.sub(parent, () => notifications++)
        expect(t.read(parent)).toBe(100)
        const attempts = t.attempts("fresh")
        const runs = parentRuns

        expect(thrownBy(() => t.tree.set(trigger, true))).toBe(t.cause)

        // The parent re-read the failure in every wave; it was re-attempted
        // and reported once.
        expect(parentRuns - runs).toBeGreaterThan(2)
        expect(t.attempts("fresh")).toBe(attempts + 1)
        expect(t.read(parent)).toBe(103)
        expect(notifications).toBe(1)
    })

    test("a top-level first evaluation that fails before evaluation stays uncached and retries on the next read", () => {
        const b = branch("before evaluation", true)
        b.arm("fresh")
        expect(b.read(b.fresh)).toBe(b.cause)
        expect(b.dependencies(b.fresh)).toBeUndefined()
        expect(b.read(b.fresh)).toBe(10)
    })

    for (const fault of FAULTS)
        test(`a previously successful dependency, failure ${fault}: a newly reading parent records the edge and recovers`, () => {
            const b = branch(fault, false)
            expect(b.read(b.fresh)).toBe(10)
            b.tree.sub(b.fresh, () => {})
            b.tree.sub(b.reader, () => {})
            b.tree.sub(b.fallback, () => {})
            b.arm("fresh")

            // Changing the input and the flag together makes `fresh` dirty
            // when the readers newly read it.
            const error = thrownBy(() =>
                b.tree.txn(tx => {
                    tx.set(b.input, 2)
                    tx.set(b.flag, true)
                }),
            )

            expect(error).toBe(b.cause)
            expectFirstFailure(b)
            expect(b.dependencies(b.fresh)).toEqual([b.input])
            b.tree.set(b.input, 3)
            expect([b.read(b.reader), b.read(b.fallback)]).toEqual([31, 30])
        })
})
