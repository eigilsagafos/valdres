import { describe, expect, test } from "bun:test"
import {
    atom,
    CallbackCapabilityError,
    externalAtom,
    ExternalSourceDeliveryLimitError,
    ExternalSourceNonConvergenceError,
    ExternalSourceOperationError,
    family,
    InvalidExternalCleanupError,
    RuntimeMismatchError,
    store,
} from "../../src/index"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createInternalExternalAtom } from "../../src/v1-internal/committed-store-tree/external-atom"

type Lifecycle = "setup" | "cleanup"

function thrown(operation: () => unknown): unknown {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

function expectLifecycleFailure(
    error: unknown,
    causes: readonly unknown[],
    lifecycle: Lifecycle,
): void {
    expect(error).toBeInstanceOf(ExternalSourceOperationError)
    const failure = error as ExternalSourceOperationError
    const phase = lifecycle === "setup" ? "admitting" : "cleanup"
    const source =
        lifecycle === "setup" ? "external-startup" : "external-cleanup"
    expect(failure.cause).toBe(causes[0])
    expect(failure.causes).toEqual(causes)
    expect(failure).toMatchObject({ phase, source, committed: false })
    expect(failure.failures).toHaveLength(causes.length)
    for (const [index, entry] of failure.failures.entries()) {
        expect(entry.cause).toBe(causes[index])
        expect(entry).toEqual({
            cause: causes[index],
            phase,
            source,
            committed: false,
        })
        expect(Reflect.ownKeys(entry).sort()).toEqual([
            "cause",
            "committed",
            "phase",
            "source",
        ])
        expect(Object.isFrozen(entry)).toBe(true)
    }
    expect(Object.isFrozen(failure)).toBe(true)
    expect(Object.isFrozen(failure.causes)).toBe(true)
    expect(Object.isFrozen(failure.failures)).toBe(true)
}

function failLifecycle(lifecycle: Lifecycle, cause: unknown): unknown {
    const domain = createCommittedStoreTreeDomain()
    const target = domain.createStoreTree()
    const external = createInternalExternalAtom(domain, {
        getSnapshot: () => 1,
        subscribe() {
            if (lifecycle === "setup") throw cause
            return () => {
                throw cause
            }
        },
    })
    try {
        return thrown(() => {
            const stop = target.sub(external, () => {})
            stop()
        })
    } finally {
        target.dispose()
    }
}

const spoofedErrors = [
    ["RuntimeMismatchError", () => new RuntimeMismatchError()],
    ["CallbackCapabilityError", () => new CallbackCapabilityError()],
    ["InvalidExternalCleanupError", () => new InvalidExternalCleanupError()],
    [
        "ExternalSourceDeliveryLimitError",
        () => new ExternalSourceDeliveryLimitError(),
    ],
    [
        "ExternalSourceNonConvergenceError",
        () => new ExternalSourceNonConvergenceError(),
    ],
] as const

describe("external failure occurrence provenance", () => {
    for (const lifecycle of ["setup", "cleanup"] as const) {
        for (const [name, createError] of spoofedErrors) {
            test(`${lifecycle} wraps an application-constructed ${name}`, () => {
                const cause = createError()
                const descriptors = Object.getOwnPropertyDescriptors(cause)
                expectLifecycleFailure(
                    failLifecycle(lifecycle, cause),
                    [cause],
                    lifecycle,
                )
                expect(Object.getOwnPropertyDescriptors(cause)).toEqual(
                    descriptors,
                )
            })
        }

        for (const guard of ["capability", "mismatch"] as const) {
            function genuineFailure(nested = false): unknown {
                const domain = createCommittedStoreTreeDomain()
                const target = domain.createStoreTree()
                const value =
                    guard === "capability"
                        ? domain.atom(1)
                        : createCommittedStoreTreeDomain().atom(1)
                let caught: unknown
                const rejectRead = () => {
                    try {
                        target.get(value)
                    } catch (error) {
                        caught = error
                        throw error
                    }
                }
                const reject = () => {
                    if (!nested) return rejectRead()
                    createInternalExternalAtom(domain, {
                        get getSnapshot() {
                            rejectRead()
                            return () => 1
                        },
                        subscribe: () => () => {},
                    })
                }
                const external = createInternalExternalAtom(domain, {
                    getSnapshot: () => 1,
                    subscribe() {
                        if (lifecycle === "setup") reject()
                        return () => {
                            if (lifecycle === "cleanup") reject()
                        }
                    },
                })
                try {
                    const error = thrown(() => {
                        const stop = target.sub(external, () => {})
                        stop()
                    })
                    expect(error).toBe(caught)
                    expect(error).toBeInstanceOf(
                        guard === "capability"
                            ? CallbackCapabilityError
                            : RuntimeMismatchError,
                    )
                    return error
                } finally {
                    target.dispose()
                }
            }

            test(`${lifecycle} preserves the exact current runtime ${guard} fault`, () => {
                genuineFailure()
            })

            test(`${lifecycle} preserves the exact runtime ${guard} fault from a nested source accessor`, () => {
                genuineFailure(true)
            })

            test(`${lifecycle} preserves the exact runtime ${guard} fault from a nested family factory`, () => {
                const target = store()
                const value =
                    guard === "capability"
                        ? atom(1)
                        : createCommittedStoreTreeDomain().atom(1)
                let caught: unknown
                const members = family((key: number) => {
                    try {
                        target.get(value)
                    } catch (error) {
                        caught = error
                        throw error
                    }
                    return atom(key)
                })
                const external = externalAtom({
                    getSnapshot: () => 1,
                    subscribe() {
                        if (lifecycle === "setup") members(1)
                        return () => {
                            if (lifecycle === "cleanup") members(1)
                        }
                    },
                })
                try {
                    const error = thrown(() => {
                        const stop = target.sub(external, () => {})
                        stop()
                    })
                    expect(error).toBe(caught)
                    expect(error).toBeInstanceOf(
                        guard === "capability"
                            ? CallbackCapabilityError
                            : RuntimeMismatchError,
                    )
                } finally {
                    target.dispose()
                }
            })

            test(`${lifecycle} wraps a runtime ${guard} fault replayed by a later callback`, () => {
                const cause = genuineFailure()
                expectLifecycleFailure(
                    failLifecycle(lifecycle, cause),
                    [cause],
                    lifecycle,
                )
            })
        }

        test(`${lifecycle} can handle a nonsticky capability guard locally`, () => {
            const domain = createCommittedStoreTreeDomain()
            const target = domain.createStoreTree()
            const value = domain.atom(1)
            let caught = 0,
                cleanups = 0
            const handleGuard = () => {
                expect(thrown(() => target.get(value))).toBeInstanceOf(
                    CallbackCapabilityError,
                )
                caught++
            }
            const external = createInternalExternalAtom(domain, {
                getSnapshot: () => 1,
                subscribe() {
                    if (lifecycle === "setup") handleGuard()
                    return () => {
                        cleanups++
                        if (lifecycle === "cleanup") handleGuard()
                    }
                },
            })
            const stop = target.sub(external, () => {})
            expect(target.get(external)).toBe(1)
            stop()
            stop()
            expect(caught).toBe(1)
            expect(cleanups).toBe(1)
            target.dispose()
        })

        test(`${lifecycle} preserves independent occurrences of one spoofed error object`, () => {
            const domain = createCommittedStoreTreeDomain()
            const target = domain.createStoreTree()
            const cause = new RuntimeMismatchError()
            let cleanups = 0
            const createExternal = () =>
                createInternalExternalAtom(domain, {
                    getSnapshot: () => 1,
                    subscribe() {
                        if (lifecycle === "setup") throw cause
                        return () => {
                            cleanups++
                            throw cause
                        }
                    },
                })
            const first = createExternal()
            const second = createExternal()
            const combined = domain.selector(get => get(first) + get(second))
            try {
                const error = thrown(() => {
                    const stop = target.sub(combined, () => {})
                    stop()
                })
                expectLifecycleFailure(error, [cause, cause], lifecycle)
                expect(cleanups).toBe(lifecycle === "setup" ? 0 : 2)
            } finally {
                target.dispose()
            }
        })
    }

    for (const operation of ["construction", "accessor"] as const) {
        test(`setup and cleanup preserve a nested encoder's ${operation} capability fault`, () => {
            for (const lifecycle of ["setup", "cleanup"] as const) {
                const target = store()
                let caught: unknown
                const inner = family((key: number) => atom(key))
                const encoded = family((key: number) => atom(key), {
                    encodeKey(key: number) {
                        try {
                            if (operation === "construction") atom(key)
                            else inner(key)
                        } catch (error) {
                            caught = error
                            throw error
                        }
                        return key
                    },
                })
                const external = externalAtom({
                    getSnapshot: () => 1,
                    subscribe() {
                        if (lifecycle === "setup") encoded(1)
                        return () => {
                            if (lifecycle === "cleanup") encoded(1)
                        }
                    },
                })
                try {
                    const error = thrown(() => {
                        const stop = target.sub(external, () => {})
                        stop()
                    })
                    expect(error).toBe(caught)
                    expect(error).toBeInstanceOf(CallbackCapabilityError)
                } finally {
                    target.dispose()
                }
            }
        })
    }
})

describe("ExternalSourceOperationError public construction", () => {
    test("rejects an empty JavaScript failure list with deliberate validation", () => {
        const error = thrown(() =>
            Reflect.construct(ExternalSourceOperationError, [[]]),
        )
        expect(error).toBeInstanceOf(TypeError)
        expect((error as Error).message).toBe(
            "ExternalSourceOperationError requires at least one failure",
        )
    })

    test("freezes ordered failure metadata while preserving repeated application causes", () => {
        const cause = new Error("shared application failure")
        const first = {
            cause,
            committed: false,
            phase: "admitting" as const,
            source: "external-startup" as const,
        }
        const second = {
            cause,
            committed: true,
            phase: "cleanup" as const,
            source: "external-cleanup" as const,
        }
        const input = [first, second] as const
        const error = new ExternalSourceOperationError(input)
        expect(error).toMatchObject({
            name: "ExternalSourceOperationError",
            code: "VALDRES_EXTERNAL_SOURCE_OPERATION",
            message: "An external source operation failed",
            committed: false,
            phase: "admitting",
            source: "external-startup",
        })
        expect(error.cause).toBe(cause)
        expect(error.causes).toEqual([cause, cause])
        expect(error.causes[0]).toBe(cause)
        expect(error.causes[1]).toBe(cause)
        expect(error.failures).toEqual(input)
        expect(error.failures).not.toBe(input)
        expect(error.failures[0]).not.toBe(first)
        expect(error.failures[1]).not.toBe(second)
        expect(Object.isFrozen(error)).toBe(true)
        expect(Object.isFrozen(error.causes)).toBe(true)
        expect(Object.isFrozen(error.failures)).toBe(true)
        expect(error.failures.every(Object.isFrozen)).toBe(true)
        expect(Object.isFrozen(input)).toBe(false)
        expect(Object.isFrozen(first)).toBe(false)
        expect(Object.isFrozen(second)).toBe(false)
        expect(Object.isFrozen(cause)).toBe(false)
        first.committed = true
        expect(error.failures[0]!.committed).toBe(false)
        expect(error.committed).toBe(false)
    })

    test("accepts a single structurally supplied public failure record", () => {
        const cause = { application: true }
        const error = new ExternalSourceOperationError([
            {
                cause,
                committed: false,
                phase: "cleanup",
                source: "external-cleanup",
            },
        ])
        expectLifecycleFailure(error, [cause], "cleanup")
        expect(Object.isFrozen(cause)).toBe(false)
    })
})
