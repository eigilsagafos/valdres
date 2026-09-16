import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    RuntimeMismatchError,
    createCommittedStoreTreeDomain,
    createInternalExternalAtom,
    createInternalStoreTreeInstrumentation,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { ExternalSourceOperationError } from "../../src/v1-internal/committed-store-tree/external-atom"
import type { ExternalSource } from "../../src/v1-internal/committed-store-tree/types"

function thrownBy(operation: () => unknown): unknown {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

function fixture() {
    const counters = createInternalStoreTreeInstrumentation()
    const domain = createCommittedStoreTreeDomain(counters)
    const tree = domain.createStoreTree()
    return { counters, domain, tree }
}

describe("internal external attachment contract", () => {
    for (const invalidations of [0, 1, 7]) {
        for (const changed of [false, true]) {
            test(`${invalidations} startup invalidations take one mandatory second sample with ${changed ? "one catch-up callback" : "no unchanged callback"}`, () => {
                const { domain, tree } = fixture()
                const events: string[] = []
                let value = 0
                let returned = false
                let cleanups = 0
                const external = createInternalExternalAtom(domain, {
                    getSnapshot() {
                        events.push(`sample:${value}`)
                        return value
                    },
                    subscribe(invalidate) {
                        events.push("subscribe:begin")
                        for (let index = 0; index < invalidations; index++) {
                            if (changed) value = index + 1
                            invalidate()
                            events.push(`startup:${index}`)
                        }
                        // Even with no invalidation, attachment must see this.
                        if (changed) value = 10
                        events.push("subscribe:end")
                        return () => {
                            cleanups++
                        }
                    },
                })
                const stop = tree.sub(external, () => {
                    expect(returned).toBe(false)
                    events.push(`callback:${tree.get(external)}`)
                })
                returned = true
                expect(events).toEqual([
                    "sample:0",
                    "subscribe:begin",
                    ...Array.from(
                        { length: invalidations },
                        (_, index) => `startup:${index}`,
                    ),
                    "subscribe:end",
                    `sample:${changed ? 10 : 0}`,
                    ...(changed ? ["callback:10"] : []),
                ])
                stop()
                stop()
                expect(cleanups).toBe(1)
            })
        }
    }

    test("retained reads and additional subscriptions neither poll nor reattach", () => {
        const { domain, tree } = fixture()
        let value = 1
        let samples = 0
        let subscriptions = 0
        let cleanups = 0
        let invalidate!: () => void
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(listener) {
                subscriptions++
                invalidate = listener
                return () => {
                    cleanups++
                }
            },
        })
        const first: number[] = []
        const second: number[] = []
        const stopFirst = tree.sub(external, () =>
            first.push(tree.get(external)),
        )
        expect([samples, subscriptions]).toEqual([2, 1])
        value = 2
        for (let index = 0; index < 20; index++)
            expect(tree.get(external)).toBe(1)
        const stopSecond = tree.sub(external, () =>
            second.push(tree.get(external)),
        )
        expect([samples, subscriptions]).toEqual([2, 1])
        expect([first, second]).toEqual([[], []])
        invalidate()
        expect([first, second]).toEqual([[2], [2]])
        expect([samples, subscriptions]).toEqual([3, 1])
        stopFirst()
        expect(cleanups).toBe(0)
        stopSecond()
        expect(cleanups).toBe(1)
    })

    test("compares the subscribed selector target rather than the changed external node", () => {
        const { domain, tree } = fixture()
        let value = 0
        let samples = 0
        let evaluations = 0
        let notifications = 0
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe() {
                value = 2
                return () => {}
            },
        })
        const parity = domain.selector(get => {
            evaluations++
            return get(external) % 2
        })
        const stop = tree.sub(parity, () => notifications++)
        expect(samples).toBe(2)
        expect(evaluations).toBe(2)
        expect(notifications).toBe(0)
        expect(tree.get(parity)).toBe(0)
        expect(tree.get(external)).toBe(2)
        expect(samples).toBe(2)
        stop()
    })

    test("a throwing setup revokes admission and preserves the prior committed projection", () => {
        const { counters, domain, tree } = fixture()
        const setupError = new Error("setup failed")
        let value = 1
        let reject = true
        let samples = 0
        let attempts = 0
        let cleanups = 0
        let callbacks = 0
        const invalidators: (() => void)[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(invalidate) {
                attempts++
                invalidators.push(invalidate)
                if (reject) {
                    value = 2
                    throw setupError
                }
                return () => {
                    cleanups++
                }
            },
        })
        const selected = domain.selector(get => get(external))
        expect(tree.get(selected)).toBe(1)
        const publications = counters.read("projectionPublications")
        const epoch = counters.read("sourceEpoch")
        const error = thrownBy(() =>
            tree.sub(selected, () => callbacks++),
        ) as ExternalSourceOperationError
        // Gate 0 proposal: arbitrary lifecycle throws receive immutable metadata
        // without amending the original application-owned error object.
        expect(error).toBeInstanceOf(ExternalSourceOperationError)
        expect(error.cause).toBe(setupError)
        expect(error.committed).toBe(false)
        expect(counters.read("activeSubscriptions")).toBe(0)
        expect(counters.read("projectionPublications")).toBe(publications)
        expect(counters.read("sourceEpoch")).toBe(epoch)
        expect([samples, attempts, cleanups, callbacks]).toEqual([2, 1, 0, 0])
        invalidators[0]!()
        expect(samples).toBe(2)
        reject = false
        const stop = tree.sub(selected, () => callbacks++)
        expect(tree.get(selected)).toBe(2)
        expect([samples, attempts, callbacks]).toEqual([4, 2, 0])
        invalidators[0]!()
        expect(samples).toBe(4)
        stop()
        expect(cleanups).toBe(1)
    })

    for (const invalidKind of [
        "undefined",
        "null",
        "number",
        "thenable",
        "thenable-function",
    ] as const) {
        test(`rejects ${invalidKind} cleanup admission, contains thenables, and allows a new generation`, () => {
            const { counters, domain, tree } = fixture()
            let valid = false
            let containments = 0
            let cleanups = 0
            let samples = 0
            let callbacks = 0
            const invalidators: (() => void)[] = []
            const then = (
                _resolve: unknown,
                reject: (error: unknown) => void,
            ) => {
                containments++
                reject(new Error("contained setup result"))
            }
            const invalid = {
                undefined,
                null: null,
                number: 42,
                thenable: { then },
                "thenable-function": Object.assign(() => {}, { then }),
            }[invalidKind]
            const source = {
                getSnapshot() {
                    samples++
                    return 1
                },
                subscribe(invalidate: () => void): unknown {
                    invalidators.push(invalidate)
                    invalidate()
                    return valid
                        ? () => {
                              cleanups++
                          }
                        : invalid
                },
            } as unknown as ExternalSource<number>
            const external = createInternalExternalAtom(domain, source)
            const error = thrownBy(() => tree.sub(external, () => callbacks++))
            expect(error).toMatchObject({
                name: "InvalidExternalCleanupError",
                code: "VALDRES_INVALID_EXTERNAL_CLEANUP",
            })
            expect(containments).toBe(
                invalidKind.startsWith("thenable") ? 1 : 0,
            )
            expect(counters.read("activeSubscriptions")).toBe(0)
            expect(samples).toBe(1)
            invalidators[0]!()
            expect(samples).toBe(1)
            valid = true
            const stop = tree.sub(external, () => callbacks++)
            expect(samples).toBe(3)
            expect(callbacks).toBe(0)
            invalidators[0]!()
            expect(samples).toBe(3)
            stop()
            expect(cleanups).toBe(1)
        })
    }

    test("revokes and runs acquired cleanup when the post-subscribe sample has a sticky control fault", () => {
        const { counters, domain, tree } = fixture()
        const foreign = createCommittedStoreTreeDomain()
        const foreignAtom = foreign.atom(0)
        let samples = 0
        let cleanups = 0
        let callbacks = 0
        let caught: unknown
        let invalidate!: () => void
        const events: string[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                events.push(`sample:${++samples}`)
                if (samples === 2) {
                    try {
                        tree.get(foreignAtom)
                    } catch (error) {
                        caught = error
                    }
                }
                return 1
            },
            subscribe(listener) {
                invalidate = listener
                events.push("subscribe")
                return () => {
                    cleanups++
                    events.push("cleanup")
                    listener()
                }
            },
        })
        const failure = thrownBy(() => tree.sub(external, () => callbacks++))
        expect(failure).toBe(caught)
        expect(failure).toBeInstanceOf(RuntimeMismatchError)
        expect(events).toEqual(["sample:1", "subscribe", "sample:2", "cleanup"])
        expect([cleanups, callbacks]).toEqual([1, 0])
        expect(counters.read("activeSubscriptions")).toBe(0)
        invalidate()
        expect(samples).toBe(2)
        expect(tree.get(external)).toBe(1)
        expect(samples).toBe(3)
    })

    test("ordinary post-subscribe snapshot errors remain attached and recover on invalidation", () => {
        const { domain, tree } = fixture()
        const error = new Error("temporarily unavailable")
        let failing = false
        let samples = 0
        let cleanups = 0
        let invalidate!: () => void
        const observations: unknown[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                if (failing) throw error
                return 3
            },
            subscribe(listener) {
                invalidate = listener
                failing = true
                return () => {
                    cleanups++
                }
            },
        })
        const stop = tree.sub(external, () => {
            try {
                observations.push(tree.get(external))
            } catch (error) {
                observations.push(error)
            }
        })
        expect(observations).toEqual([error])
        expect(observations[0]).toBe(error)
        expect(thrownBy(() => tree.get(external))).toBe(error)
        expect([samples, cleanups]).toEqual([2, 0])
        failing = false
        invalidate()
        expect(observations).toEqual([error, 3])
        expect(samples).toBe(3)
        stop()
        expect(cleanups).toBe(1)
    })

    test("startup feedback settles fully while the new callback spends only one admission notification", () => {
        const { domain, tree } = fixture()
        let value = 0
        let samples = 0
        let invalidate!: () => void
        const values: number[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(listener) {
                invalidate = listener
                value = 1
                return () => {}
            },
        })
        const stop = tree.sub(external, () => {
            const current = tree.get(external)
            values.push(current)
            if (current === 1) {
                value = 2
                invalidate()
            }
        })
        expect(values).toEqual([1])
        expect(samples).toBe(3)
        expect(tree.get(external)).toBe(2)
        expect(samples).toBe(3)
        value = 3
        invalidate()
        expect(values).toEqual([1, 3])
        expect(samples).toBe(4)
        stop()
    })

    test("a throwing startup callback releases its unreachable registration before sub returns", () => {
        const { counters, domain, tree } = fixture()
        const callbackError = new Error("startup callback failed")
        let value = 0
        let samples = 0
        let cleanups = 0
        const invalidators: (() => void)[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(invalidate) {
                invalidators.push(invalidate)
                value = 1
                return () => {
                    cleanups++
                    invalidate()
                }
            },
        })
        const failure = thrownBy(() =>
            tree.sub(external, () => {
                throw callbackError
            }),
        ) as { readonly cause: unknown }
        expect(failure.cause).toBe(callbackError)
        expect(counters.read("activeSubscriptions")).toBe(0)
        expect(cleanups).toBe(1)
        expect(samples).toBe(2)
        invalidators[0]!()
        expect(samples).toBe(2)
        let callbacks = 0
        const stop = tree.sub(external, () => callbacks++)
        expect([samples, callbacks]).toEqual([4, 0])
        value = 2
        invalidators[1]!()
        expect(callbacks).toBe(1)
        stop()
        expect(cleanups).toBe(2)
    })
})

describe("internal external settlement ordering and generations", () => {
    test("direct and transitive subscriptions across scopes share one attachment and final cleanup", () => {
        const { domain, tree } = fixture()
        const child = tree.scope()
        const sibling = tree.scope()
        let value = 1
        let subscriptions = 0
        let cleanups = 0
        let samples = 0
        let invalidate!: () => void
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(listener) {
                subscriptions++
                invalidate = listener
                return () => {
                    cleanups++
                }
            },
        })
        const selected = domain.selector(get => get(external) + 10)
        const rootValues: number[] = [],
            childValues: number[] = [],
            siblingValues: number[] = []
        const rootStop = tree.sub(external, () =>
            rootValues.push(tree.get(external)),
        )
        const childStop = child.sub(selected, () =>
            childValues.push(child.get(selected)),
        )
        const siblingStop = sibling.sub(external, () =>
            siblingValues.push(sibling.get(external)),
        )
        expect([subscriptions, samples]).toEqual([1, 2])
        value = 2
        invalidate()
        expect([rootValues, childValues, siblingValues]).toEqual([
            [2],
            [12],
            [2],
        ])
        expect(samples).toBe(3)
        rootStop()
        childStop()
        expect(cleanups).toBe(0)
        siblingStop()
        expect(cleanups).toBe(1)
    })

    test("a callback-triggered invalidation drains only after the complete frozen owned snapshot", () => {
        const { domain, tree } = fixture()
        const owned = domain.atom(0)
        let value = 0
        let samples = 0
        let invalidate!: () => void
        const events: string[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        const stopExternal = tree.sub(external, () =>
            events.push(`external:${tree.get(external)}`),
        )
        const stopFirst = tree.sub(owned, () => {
            events.push("owned:first")
            value = 1
            invalidate()
            events.push(`owned:after-invalidate:${tree.get(external)}`)
            expect(samples).toBe(2)
        })
        const stopSecond = tree.sub(owned, () =>
            events.push(`owned:second:${tree.get(external)}`),
        )
        tree.set(owned, 1)
        expect(events).toEqual([
            "owned:first",
            "owned:after-invalidate:0",
            "owned:second:0",
            "external:1",
        ])
        expect(samples).toBe(3)
        expect(tree.get(external)).toBe(1)
        stopFirst()
        stopSecond()
        stopExternal()
    })

    test("subscriber throws cannot starve later callbacks or the required dirty drain", () => {
        const { domain, tree } = fixture()
        const owned = domain.atom(0)
        const callbackError = new Error("owned callback failed")
        let value = 0
        let invalidate!: () => void
        const events: string[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        const stopExternal = tree.sub(external, () =>
            events.push(`external:${tree.get(external)}`),
        )
        const stopFirst = tree.sub(owned, () => {
            events.push("owned:first")
            value = 1
            invalidate()
            throw callbackError
        })
        const stopSecond = tree.sub(owned, () => events.push("owned:second"))
        const failure = thrownBy(() => tree.set(owned, 1))
        expect((failure as { readonly cause: unknown }).cause).toBe(
            callbackError,
        )
        expect(events).toEqual(["owned:first", "owned:second", "external:1"])
        expect(tree.get(owned)).toBe(1)
        expect(tree.get(external)).toBe(1)
        stopFirst()
        stopSecond()
        stopExternal()
    })

    test("invalidation during external delivery creates a later round after every current callback", () => {
        const { domain, tree } = fixture()
        let value = 0
        let invalidate!: () => void
        const events: string[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot: () => value,
            subscribe(listener) {
                invalidate = listener
                return () => {}
            },
        })
        const first = tree.sub(external, () => {
            const current = tree.get(external)
            events.push(`first:${current}`)
            if (current === 1) {
                value = 2
                invalidate()
            }
        })
        const second = tree.sub(external, () =>
            events.push(`second:${tree.get(external)}`),
        )
        value = 1
        invalidate()
        expect(events).toEqual(["first:1", "second:1", "first:2", "second:2"])
        first()
        second()
    })

    test("revokes the departed generation before cleanup and ignores its later replacement-era invalidations", () => {
        const { domain, tree } = fixture()
        let value = 1
        let samples = 0
        let cleanups = 0
        const invalidators: (() => void)[] = []
        const seen: number[] = []
        const external = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(invalidate) {
                invalidators.push(invalidate)
                return () => {
                    cleanups++
                    invalidate()
                }
            },
        })
        const stopFirst = tree.sub(external, () =>
            seen.push(tree.get(external)),
        )
        stopFirst()
        stopFirst()
        expect([samples, cleanups]).toEqual([2, 1])
        value = 2
        const stopSecond = tree.sub(external, () =>
            seen.push(tree.get(external)),
        )
        expect([samples, cleanups]).toEqual([4, 1])
        value = 99
        invalidators[0]!()
        expect(tree.get(external)).toBe(2)
        expect(samples).toBe(4)
        expect(seen).toEqual([])
        invalidators[1]!()
        expect(tree.get(external)).toBe(99)
        expect(samples).toBe(5)
        expect(seen).toEqual([99])
        stopSecond()
        expect([samples, cleanups]).toEqual([5, 2])
    })

    for (const phase of ["snapshot", "subscribe", "cleanup"] as const) {
        test(`rejects another active same-domain invalidator during ${phase}`, () => {
            const { domain, tree } = fixture()
            const otherTree = domain.createStoreTree()
            let otherSamples = 0
            let otherInvalidator!: () => void
            const other = createInternalExternalAtom(domain, {
                getSnapshot() {
                    otherSamples++
                    return 0
                },
                subscribe(invalidate) {
                    otherInvalidator = invalidate
                    return () => {}
                },
            })
            const stopOther = otherTree.sub(other, () => {})
            expect(otherSamples).toBe(2)
            const rejections: unknown[] = []
            const rejectOther = () =>
                rejections.push(thrownBy(() => otherInvalidator()))
            const external = createInternalExternalAtom(domain, {
                getSnapshot() {
                    if (phase === "snapshot") rejectOther()
                    return 1
                },
                subscribe(ownInvalidator) {
                    if (phase === "subscribe") rejectOther()
                    ownInvalidator()
                    return () => {
                        ownInvalidator()
                        if (phase === "cleanup") rejectOther()
                    }
                },
            })
            const stop = tree.sub(external, () => {})
            stop()
            expect(rejections).toHaveLength(phase === "snapshot" ? 2 : 1)
            for (const rejection of rejections)
                expect(rejection).toBeInstanceOf(CallbackCapabilityError)
            expect(otherSamples).toBe(2)
            otherInvalidator()
            expect(otherSamples).toBe(3)
            stopOther()
        })
    }
})
