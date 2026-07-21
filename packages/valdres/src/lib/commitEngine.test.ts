import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"
import type { SettleFn } from "../types/SettleFn"
import { runCommitPlan, runHookedDirectWrite } from "./commitEngine"
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
