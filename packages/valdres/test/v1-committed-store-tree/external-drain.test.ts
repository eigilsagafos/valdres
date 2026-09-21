import {
    createInternalExternalAtom,
    configureInternalExternalBounds,
} from "../../src/v1-internal/committed-store-tree/external-atom"
import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    RuntimeMismatchError,
    SubscriberNotificationError,
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    ExternalSourceOperationError,
    ExternalSourceNonConvergenceError,
    ExternalSourceDeliveryLimitError,
    InvalidExternalCleanupError,
} from "../../src/v1-internal/committed-store-tree/external-atom"

function fixture() {
    const counters = createInternalStoreTreeInstrumentation()
    const domain = createCommittedStoreTreeDomain(counters),
        store = domain.createStoreTree()
    const source = () => {
        let value = 0,
            invalidation: () => void = () => {},
            samples = 0,
            cleanups = 0
        const ext = createInternalExternalAtom(domain, {
            getSnapshot() {
                samples++
                return value
            },
            subscribe(fn) {
                invalidation = fn
                return () => {
                    cleanups++
                }
            },
        })
        return {
            ext,
            set(next: number) {
                value = next
            },
            invalidate: () => invalidation(),
            samples: () => samples,
            cleanups: () => cleanups,
        }
    }
    return { domain, store, counters, source }
}
const thrown = (fn: () => unknown) => {
    try {
        fn()
    } catch (error) {
        return error
    }
    throw new Error("Expected failure")
}

describe("external operation completion", () => {
    test.each([false, true])(
        "cleanup thenables are contained once and cannot starve disposal (thrown=%s)",
        throws => {
            const f = fixture()
            let contained = 0,
                secondCleanup = 0,
                samples = 0,
                stale!: () => void
            const thenable = {
                then(_resolve: unknown, reject: (error: unknown) => void) {
                    contained++
                    reject(new Error("contained"))
                },
            }
            const first = createInternalExternalAtom(f.domain, {
                getSnapshot() {
                    samples++
                    return 1
                },
                subscribe(fn) {
                    stale = fn
                    return () => {
                        if (throws) throw thenable
                        return thenable
                    }
                },
            })
            const second = createInternalExternalAtom(f.domain, {
                getSnapshot: () => 2,
                subscribe: () => () => {
                    secondCleanup++
                    return true
                },
            })
            f.store.sub(first, () => {})
            f.store.scope().sub(second, () => {})
            expect(thrown(() => f.store.dispose())).toBeInstanceOf(
                InvalidExternalCleanupError,
            )
            expect([contained, secondCleanup, samples]).toEqual([1, 1, 2])
            stale()
            f.store.dispose()
            expect([contained, secondCleanup, samples]).toEqual([1, 1, 2])
        },
    )

    test("a thrown setup thenable is contained without publishing a new projection or retaining admission", () => {
        const f = fixture()
        let contained = 0
        const ext = createInternalExternalAtom(f.domain, {
            getSnapshot: () => 1,
            subscribe() {
                throw {
                    then(_resolve: unknown, reject: (error: unknown) => void) {
                        contained++
                        reject(new Error("setup"))
                    },
                }
            },
        })
        expect(thrown(() => f.store.sub(ext, () => {}))).toBeInstanceOf(
            InvalidExternalCleanupError,
        )
        expect(contained).toBe(1)
        expect(f.counters.read("activeSubscriptions")).toBe(0)
        expect(f.counters.read("adapterCleanups")).toBe(0)
    })
    test("catch-up propagates through already evaluated ancestors before the frozen snapshot", () => {
        const f = fixture(),
            gate = f.domain.atom(false)
        let value = 1
        const ext = createInternalExternalAtom(f.domain, {
            getSnapshot: () => value,
            subscribe() {
                value = 5
                return () => {}
            },
        })
        const leaf = f.domain.selector(get => (get(gate) ? get(ext) : 0))
        const parent = f.domain.selector(get => get(leaf) + 1)
        const top = f.domain.selector(get => get(parent) * 2)
        const seen: number[] = []
        f.store.sub(top, () => seen.push(f.store.get(top)))
        f.store.set(gate, true)
        expect(seen).toEqual([12])
        expect(f.store.get(top)).toBe(12)
    })

    test("forbidden captured commands cannot admit a frame or retry dormant attachment", () => {
        const f = fixture(),
            other = f.domain.createStoreTree(),
            gate = f.domain.atom(false),
            trigger = f.domain.atom(0)
        let attempts = 0
        const ext = createInternalExternalAtom(f.domain, {
            getSnapshot: () => 1,
            subscribe() {
                attempts++
                if (attempts === 1) throw new Error("setup")
                return () => {}
            },
        })
        other.sub(
            f.domain.selector(get => (get(gate) ? get(ext) : 0)),
            () => {},
        )
        thrown(() => other.set(gate, true))
        f.store.sub(trigger, () => {
            for (const operation of [
                () => other.set(trigger, 1),
                () => other.txn(() => {}),
                () => other.dispose(),
            ])
                expect(thrown(operation)).toBeInstanceOf(
                    CallbackCapabilityError,
                )
        })
        f.store.set(trigger, 1)
        expect(attempts).toBe(1)
    })
    test("dynamic first attachment resettles an already evaluated selector before notification", () => {
        const f = fixture(),
            mode = f.domain.atom(false)
        let value = 0,
            runs = 0
        const ext = createInternalExternalAtom(f.domain, {
            getSnapshot: () => value,
            subscribe() {
                value = 5
                return () => {}
            },
        })
        const selector = f.domain.selector(get => {
            runs++
            return get(mode) ? get(ext) : 0
        })
        const seen: number[] = []
        f.store.sub(selector, () => seen.push(f.store.get(selector)))
        f.store.set(mode, true)
        expect(seen).toEqual([5])
        expect(runs).toBe(3)
        expect(f.store.get(selector)).toBe(5)
        expect(runs).toBe(3)
    })

    test("cached unretained selector closures over active sources take constant work and become dormant on detach", () => {
        const f = fixture(),
            a = f.source()
        const stop = f.store.sub(a.ext, () => {})
        let node = f.domain.selector(get => get(a.ext))
        f.store.get(node)
        for (let index = 0; index < 100; index++) {
            const prior = node
            node = f.domain.selector(get => get(prior))
            f.store.get(node)
        }
        const visits = f.counters.read("externalClosureVisits"),
            samples = a.samples()
        a.set(7)
        for (let index = 0; index < 20; index++)
            expect(f.store.get(node)).toBe(0)
        expect(f.counters.read("externalClosureVisits")).toBe(visits)
        expect(a.samples()).toBe(samples)
        stop()
        expect(f.store.get(node)).toBe(7)
        expect(a.samples()).toBe(samples + 1)
    })

    test("a later read retries a failed dynamic attachment and returns the final post-drain target", () => {
        const f = fixture(),
            mode = f.domain.atom(false),
            setupError = new Error("setup")
        let attempts = 0,
            value = 0,
            invalidate!: () => void
        const ext = createInternalExternalAtom(f.domain, {
            getSnapshot: () => value,
            subscribe(fn) {
                attempts++
                if (attempts === 1) throw setupError
                invalidate = fn
                value = 1
                return () => {}
            },
        })
        const selector = f.domain.selector(get => (get(mode) ? get(ext) : 0))
        const seen: number[] = []
        f.store.sub(selector, () => {
            const current = f.store.get(selector)
            seen.push(current)
            if (current === 1) {
                value = 2
                invalidate()
            }
        })
        expect(
            (
                thrown(() =>
                    f.store.set(mode, true),
                ) as ExternalSourceOperationError
            ).cause,
        ).toBe(setupError)
        expect(f.store.get(selector)).toBe(2)
        expect(attempts).toBe(2)
        expect(seen).toEqual([1, 2])
    })

    test("getter, initializer, comparator and transaction callbacks cannot invalidate", () => {
        const f = fixture(),
            a = f.source()
        f.store.sub(a.ext, () => {})
        a.set(1)
        const errors: unknown[] = []
        const attempt = () => {
            errors.push(thrown(a.invalidate))
            return 0
        }
        f.store.get(f.domain.selector(() => attempt()))
        f.store.get(f.domain.atomLazy(attempt))
        const atom = f.domain.atom(0, {
            equal: () => {
                attempt()
                return false
            },
        })
        f.store.set(atom, 1)
        f.store.txn(() => attempt())
        expect(errors.length).toBe(4)
        for (const error of errors)
            expect(error).toBeInstanceOf(CallbackCapabilityError)
        expect(f.store.get(a.ext)).toBe(0)
        expect(a.samples()).toBe(2)
    })

    test("combined dirty sources settle one final selector in first-invalidation order", () => {
        const f = fixture(),
            a = f.source(),
            b = f.source(),
            trigger = f.domain.atom(0)
        let runs = 0
        const selector = f.domain.selector(get => {
            runs++
            return get(a.ext) + get(b.ext)
        })
        const seen: number[] = []
        f.store.sub(selector, () => seen.push(f.store.get(selector)))
        f.store.sub(trigger, () => {
            b.set(2)
            b.invalidate()
            a.set(1)
            a.invalidate()
            b.invalidate()
        })
        f.store.set(trigger, 1)
        expect(seen).toEqual([3])
        expect(runs).toBe(2)
        expect([a.samples(), b.samples()]).toEqual([3, 3])
        expect(f.counters.read("dirtyRounds")).toBe(1)
    })

    test("notification errors cannot starve ordered all-run cleanup or later dirty delivery", () => {
        const f = fixture(),
            trigger = f.domain.atom(0),
            c = f.source(),
            events: string[] = []
        const callback = new Error("callback"),
            first = new Error("first cleanup"),
            second = new Error("second cleanup")
        const external = (label: string, error: Error) =>
            createInternalExternalAtom(f.domain, {
                getSnapshot: () => 0,
                subscribe: () => () => {
                    events.push(label)
                    throw error
                },
            })
        const stopA = f.store.sub(external("cleanup-a", first), () => {}),
            stopB = f.store.sub(external("cleanup-b", second), () => {})
        f.store.sub(c.ext, () => events.push("external"))
        f.store.sub(trigger, () => {
            events.push("callback-a")
            stopA()
            c.set(1)
            c.invalidate()
            throw callback
        })
        f.store.sub(trigger, () => {
            events.push("callback-b")
            stopB()
        })
        const error = thrown(() =>
            f.store.set(trigger, 1),
        ) as ExternalSourceOperationError
        expect(error.causes).toEqual([callback, first, second])
        expect(events).toEqual([
            "callback-a",
            "callback-b",
            "cleanup-a",
            "cleanup-b",
            "external",
        ])
        expect(error.failures.map(failure => failure.phase)).toEqual([
            "notifying",
            "cleanup",
            "cleanup",
        ])
        expect(f.store.get(c.ext)).toBe(1)
    })

    test("active mismatch installs its exact committed error and remains recoverable", () => {
        const f = fixture(),
            alien = createCommittedStoreTreeDomain().atom(0)
        let fail = false,
            mismatch: unknown,
            invalidate!: () => void
        const notification = new Error("notification")
        const ext = createInternalExternalAtom(f.domain, {
            getSnapshot() {
                if (fail) {
                    try {
                        f.store.get(alien)
                    } catch (error) {
                        mismatch = error
                        throw error
                    }
                }
                return 1
            },
            subscribe(fn) {
                invalidate = fn
                return () => {}
            },
        })
        const selected = f.domain.selector(get => get(ext) + 1)
        f.store.sub(selected, () => {
            if (fail) throw notification
        })
        fail = true
        const error = thrown(invalidate) as ExternalSourceOperationError
        expect(mismatch).toBeInstanceOf(RuntimeMismatchError)
        expect(error.causes).toEqual([mismatch, notification])
        expect(thrown(() => f.store.get(selected))).toBe(mismatch)
        expect(error.failures[0]?.committed).toBe(true)
        fail = false
        invalidate()
        expect(f.store.get(selected)).toBe(2)
    })
})

describe("external synchronous bounds", () => {
    test("round exhaustion installs recoverable errors and ignores terminal feedback", () => {
        const f = fixture(),
            a = f.source(),
            seen: unknown[] = []
        configureInternalExternalBounds(f.domain, { rounds: 3 })
        let feedback = true
        f.store.sub(a.ext, () => {
            try {
                seen.push(f.store.get(a.ext))
            } catch (error) {
                seen.push(error)
            }
            if (feedback) {
                a.set(seen.length + 1)
                a.invalidate()
            }
        })
        a.set(1)
        const error = thrown(a.invalidate)
        expect(error).toBeInstanceOf(ExternalSourceNonConvergenceError)
        expect(seen.slice(0, 3)).toEqual([1, 2, 3])
        expect(seen[3]).toBe(error)
        expect(a.samples()).toBe(5)
        expect(a.cleanups()).toBe(0)
        feedback = false
        a.set(10)
        a.invalidate()
        expect(f.store.get(a.ext)).toBe(10)
        expect(seen.at(-1)).toBe(10)
    })

    test("partial work exhaustion publishes sampled and terminal outcomes in one notification", () => {
        const f = fixture(),
            a = f.source(),
            b = f.source(),
            c = f.source(),
            trigger = f.domain.atom(0)
        const selector = f.domain.selector(get => {
            const values: unknown[] = []
            for (const ext of [a.ext, b.ext, c.ext]) {
                try {
                    values.push(get(ext))
                } catch (error) {
                    values.push(error)
                }
            }
            return values
        })
        const seen: unknown[][] = []
        f.store.sub(selector, () => seen.push(f.store.get(selector)))
        configureInternalExternalBounds(f.domain, { samples: 2 })
        f.store.sub(trigger, () => {
            for (const source of [a, b, c]) {
                source.set(1)
                source.invalidate()
            }
        })
        const error = thrown(() => f.store.set(trigger, 1))
        expect(error).toBeInstanceOf(ExternalSourceNonConvergenceError)
        expect(seen).toEqual([
            [
                1,
                1,
                expect.objectContaining({
                    name: "SelectorDependencyError",
                    cause: error,
                }),
            ],
        ])
        expect([a.samples(), b.samples(), c.samples()]).toEqual([3, 3, 2])
        c.invalidate()
        expect(f.store.get(selector)).toEqual([1, 1, 1])
    })

    test("cross-tree depth exhaustion publishes nothing in the unentered tree and later delivery retries", () => {
        const f = fixture(),
            a = f.source(),
            b = f.source(),
            c = f.source()
        const second = f.domain.createStoreTree(),
            third = f.domain.createStoreTree()
        third.sub(c.ext, () => {})
        second.sub(b.ext, () => {
            c.set(3)
            c.invalidate()
        })
        f.store.sub(a.ext, () => {
            b.set(2)
            b.invalidate()
        })
        configureInternalExternalBounds(f.domain, { deliveryDepth: 2 })
        a.set(1)
        const error = thrown(a.invalidate)
        const deepest = (value: unknown): unknown =>
            value instanceof ExternalSourceOperationError ||
            value instanceof SubscriberNotificationError
                ? deepest(value.cause)
                : value
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(deepest(error)).toBeInstanceOf(ExternalSourceDeliveryLimitError)
        expect(third.get(c.ext)).toBe(0)
        expect(c.samples()).toBe(2)
        c.invalidate()
        expect(third.get(c.ext)).toBe(3)
        expect(c.samples()).toBe(3)
    })
})
