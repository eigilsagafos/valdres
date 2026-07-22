import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { store } from "../store"
import type { SettleFn } from "../types/SettleFn"
import type { TransactionSettleFn } from "../types/TransactionSettleFn"
import {
    createGuardedScalarCommit,
    runCommitPlan,
    runHookedDirectWrite,
} from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import {
    BULK_NO_EFFECTS_SILENT,
    BULK_WITH_EFFECTS_SILENT,
    DIRECT_WRITE,
    SEED_WRITE,
    SETTLE_DEFAULT,
    SETTLE_INIT_ONLY,
    SETTLE_SKIP_FAMILY_INDEX,
    SETTLE_UNSET,
} from "./commitIntents"
import { getStoreData } from "./getStoreData"

describe("commitEngine", () => {
    describe("createGuardedScalarCommit", () => {
        test("admits immediately before apply and suppresses rejected entries", () => {
            const events: string[] = []
            const commit = createGuardedScalarCommit(
                (admitted: boolean) => {
                    events.push(`admit:${admitted}`)
                    return admitted
                },
                () => events.push("apply"),
            )
            const unusedArgs = [
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
            ] as const

            expect(commit(false, ...unusedArgs)).toBe(false)
            expect(commit(true, ...unusedArgs)).toBe(true)
            expect(events).toEqual(["admit:false", "admit:true", "apply"])
        })
    })

    describe("runHookedDirectWrite", () => {
        test("runs the hook, then settles with the shared default flags", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const order: string[] = []
            const a = atom(0, { onSet: () => order.push("onSet") })
            const settle = mock((() => {
                order.push("settle")
            }) as SettleFn)
            runHookedDirectWrite(a, 1, data, [a], "set", settle)
            expect(order).toEqual(["onSet", "settle"])
            expect(settle).toHaveBeenCalledWith(
                [a],
                data,
                undefined,
                "set",
                SETTLE_DEFAULT,
            )
        })

        test("a throwing hook never starves settle; the hook error is rethrown", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const hookError = new Error("hook")
            const a = atom(0, {
                onSet: () => {
                    throw hookError
                },
            })
            const settle = mock((() => {}) as SettleFn)
            expect(() =>
                runHookedDirectWrite(a, 1, data, [a], "set", settle),
            ).toThrow(hookError)
            expect(settle).toHaveBeenCalledTimes(1)
        })

        test("a settle error is rethrown when the hook succeeded", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const settleError = new Error("settle")
            const a = atom(0, { onSet: () => {} })
            const settle = (() => {
                throw settleError
            }) as SettleFn
            expect(() =>
                runHookedDirectWrite(a, 1, data, [a], "set", settle),
            ).toThrow(settleError)
        })

        test("when both throw, the hook error wins", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const hookError = new Error("hook")
            const a = atom(0, {
                onSet: () => {
                    throw hookError
                },
            })
            const settle = (() => {
                throw new Error("settle")
            }) as SettleFn
            expect(() =>
                runHookedDirectWrite(a, 1, data, [a], "set", settle),
            ).toThrow(hookError)
        })
    })

    describe("runCommitPlan", () => {
        test("runs hooks, settles, and rethrows the first captured error", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const hookError = new Error("hook")
            const a = atom(0, {
                onSet: () => {
                    throw hookError
                },
            })
            const settle = mock((() => {
                throw new Error("settle")
            }) as SettleFn)
            expect(() =>
                runCommitPlan({
                    data,
                    settlement: {
                        kind: "update",
                        atoms: [a],
                        settle,
                        flags: SETTLE_DEFAULT,
                    },
                    onSets: [[a, 1, data]],
                    errors: createCommitErrors(),
                    report: undefined,
                }),
            ).toThrow(hookError)
            // The settle error was recorded (not thrown) and settle still ran.
            expect(settle).toHaveBeenCalledTimes(1)
        })

        test("an empty commit never settles: no boundary, no spurious commitEnd", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const commitEnds = mock(() => {})
            store1.onCommitEnd(commitEnds)
            const settle = mock((() => {}) as SettleFn)
            runCommitPlan({
                data,
                settlement: {
                    kind: "update",
                    atoms: [],
                    settle,
                    flags: SETTLE_DEFAULT,
                },
                onSets: [],
                errors: createCommitErrors(),
                report: undefined,
            })
            expect(settle).toHaveBeenCalledTimes(0)
            expect(commitEnds).toHaveBeenCalledTimes(0)
        })

        test("failed admission runs no phase and opens no boundary", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const events: string[] = []
            store1.onCommitEnd(() => events.push("commitEnd"))

            const admitted = runCommitPlan({
                data,
                settlement: { kind: "none" },
                admit: () => false,
                apply: () => events.push("apply"),
                onSets: [],
                errors: createCommitErrors(),
                report: undefined,
                afterSettle: () => events.push("after"),
                beginCommit: root => {
                    events.push("begin")
                    return root
                },
                endCommit: () => events.push("end"),
            })

            expect(admitted).toBe(false)
            expect(events).toEqual([])
        })

        test("a no-settlement plan applies without dispatching observers", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const events: string[] = []

            expect(
                runCommitPlan({
                    data,
                    settlement: { kind: "none" },
                    apply: () => events.push("apply"),
                    onSets: [],
                    errors: createCommitErrors(),
                    report: undefined,
                }),
            ).toBe(true)
            expect(events).toEqual(["apply"])
        })

        test("owns the local pre-report → settle → cleanup → flush → boundary order", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const a = atom(0)
            const order: string[] = []
            const settle = mock((() => order.push("settle")) as SettleFn)

            runCommitPlan({
                data,
                settlement: {
                    kind: "update",
                    atoms: [a],
                    settle,
                    flags: SETTLE_UNSET,
                },
                apply: () => order.push("apply"),
                onSets: [],
                errors: createCommitErrors(),
                report: "unset",
                beforeSettle: () => order.push("report"),
                afterSettle: () => order.push("cleanup"),
                flushReport: () => order.push("flush"),
                beginCommit: root => {
                    order.push("begin")
                    return root
                },
                endCommit: (_root, swallowErrors) =>
                    order.push(`end:${swallowErrors}`),
            })

            expect(order).toEqual([
                "begin",
                "apply",
                "report",
                "settle",
                "cleanup",
                "flush",
                "end:false",
            ])
        })

        test("runs post-boundary finalizers before rethrowing the first error", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const firstError = new Error("hook")
            const order: string[] = []
            const a = atom(0, {
                onSet: () => {
                    order.push("hook")
                    throw firstError
                },
            })
            expect(() =>
                runCommitPlan({
                    data,
                    settlement: {
                        kind: "update",
                        atoms: [a],
                        settle: (() => order.push("settle")) as SettleFn,
                        flags: SETTLE_DEFAULT,
                    },
                    onSets: [[a, 1, data]],
                    errors: createCommitErrors(),
                    report: undefined,
                    beginCommit: root => {
                        order.push("begin")
                        return root
                    },
                    endCommit: () => {
                        order.push("end")
                        throw new Error("end")
                    },
                    afterCommit: () => {
                        order.push("finalize")
                        throw new Error("finalize")
                    },
                }),
            ).toThrow(firstError)
            expect(order).toEqual([
                "begin",
                "hook",
                "settle",
                "end",
                "finalize",
            ])
        })

        test("a short-circuiting cleanup plan preserves its settle error and skips later phases", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const a = atom(0)
            const settleError = new Error("settle")
            const cleanup = mock(() => {})
            const flush = mock(() => {})
            const endStates: boolean[] = []

            expect(() =>
                runCommitPlan({
                    data,
                    settlement: {
                        kind: "update",
                        atoms: [a],
                        settle: (() => {
                            throw settleError
                        }) as SettleFn,
                        flags: SETTLE_UNSET,
                    },
                    onSets: [],
                    errors: createCommitErrors(),
                    report: "unset",
                    afterSettle: cleanup,
                    flushReport: flush,
                    beginCommit: root => root,
                    endCommit: (_root, swallowErrors) =>
                        endStates.push(swallowErrors),
                    continueAfterError: false,
                }),
            ).toThrow(settleError)
            expect(cleanup).toHaveBeenCalledTimes(0)
            expect(flush).toHaveBeenCalledTimes(0)
            expect(endStates).toEqual([true])
        })

        test("a hook error remains first while settlement and deferred flush still run", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const hookError = new Error("hook")
            const a = atom(0, {
                onSet: () => {
                    throw hookError
                },
            })
            const settle = mock((() => {
                throw new Error("settle")
            }) as SettleFn)
            const flush = mock(() => {
                throw new Error("flush")
            })

            expect(() =>
                runCommitPlan({
                    data,
                    settlement: {
                        kind: "update",
                        atoms: [a],
                        settle,
                        flags: SETTLE_DEFAULT,
                    },
                    onSets: [[a, 1, data]],
                    errors: createCommitErrors(),
                    report: undefined,
                    flushReport: flush,
                }),
            ).toThrow(hookError)
            expect(settle).toHaveBeenCalledTimes(1)
            expect(flush).toHaveBeenCalledTimes(1)
        })
    })

    describe("transaction settlement", () => {
        test("dispatches atoms, cleanup lists, report, and errors to the settle fn verbatim", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const a = atom(1)
            const unset = [atom(2)]
            const errors = createCommitErrors()
            const settle = mock((() => {}) as TransactionSettleFn)

            runCommitPlan({
                data,
                settlement: {
                    kind: "transaction",
                    atoms: [a],
                    deleted: undefined,
                    unset,
                    settle,
                },
                onSets: [],
                errors,
                report: "set",
            })

            expect(settle).toHaveBeenCalledTimes(1)
            expect(settle).toHaveBeenCalledWith(
                [a],
                undefined,
                unset,
                data,
                "set",
                errors,
            )
        })

        test("a no-work transaction settlement skips settle but still runs hooks and rethrows their first error", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const hookError = new Error("hook")
            const hooked = atom(0, {
                onSet: () => {
                    throw hookError
                },
            })
            const settle = mock((() => {}) as TransactionSettleFn)

            expect(() =>
                runCommitPlan({
                    data,
                    settlement: {
                        kind: "transaction",
                        atoms: [],
                        deleted: undefined,
                        unset: undefined,
                        settle,
                    },
                    onSets: [[hooked, 1, data]],
                    errors: createCommitErrors(),
                    report: undefined,
                }),
            ).toThrow(hookError)
            expect(settle).not.toHaveBeenCalled()
        })

        test("cleanup-only settlements (deleted or unset, no updated atoms) still settle", () => {
            const store1 = store()
            const data = getStoreData(store1)
            const family = atomFamily<number, [string]>(0)
            const member = family("x")

            const deleteSettle = mock((() => {}) as TransactionSettleFn)
            runCommitPlan({
                data,
                settlement: {
                    kind: "transaction",
                    atoms: [],
                    deleted: [member],
                    unset: undefined,
                    settle: deleteSettle,
                },
                onSets: [],
                errors: createCommitErrors(),
                report: undefined,
            })
            expect(deleteSettle).toHaveBeenCalledTimes(1)

            const unsetSettle = mock((() => {}) as TransactionSettleFn)
            runCommitPlan({
                data,
                settlement: {
                    kind: "transaction",
                    atoms: [],
                    deleted: undefined,
                    unset: [atom(0)],
                    settle: unsetSettle,
                },
                onSets: [],
                errors: createCommitErrors(),
                report: undefined,
            })
            expect(unsetSettle).toHaveBeenCalledTimes(1)
        })
    })

    describe("commitIntents singletons", () => {
        test("every shared intent/flag const is frozen", () => {
            for (const value of [
                DIRECT_WRITE,
                SEED_WRITE,
                BULK_WITH_EFFECTS_SILENT,
                BULK_NO_EFFECTS_SILENT,
                SETTLE_DEFAULT,
                SETTLE_INIT_ONLY,
                SETTLE_SKIP_FAMILY_INDEX,
                SETTLE_UNSET,
            ]) {
                expect(Object.isFrozen(value)).toBe(true)
            }
        })
    })
})
