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
    SETTLE_FLAGS_BY_BITS,
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
                    updatedAtoms: [a],
                    onSets: [[a, 1, data]],
                    errors: createCommitErrors(),
                    settle,
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
                updatedAtoms: [],
                onSets: [],
                errors: createCommitErrors(),
                settle,
                report: undefined,
            })
            expect(settle).toHaveBeenCalledTimes(0)
            expect(commitEnds).toHaveBeenCalledTimes(0)
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
                SETTLE_FLAGS_BY_BITS,
                ...SETTLE_FLAGS_BY_BITS,
            ]) {
                expect(Object.isFrozen(value)).toBe(true)
            }
        })

        test("the flag table is total and faithful to its bit index", () => {
            expect(SETTLE_FLAGS_BY_BITS).toHaveLength(8)
            for (let bits = 0; bits < 8; bits++) {
                const flags = SETTLE_FLAGS_BY_BITS[bits]
                expect(flags.isInitOnly).toBe(Boolean(bits & 4))
                expect(flags.skipFamilyIndexUpdate).toBe(Boolean(bits & 2))
                expect(flags.reportAtoms).toBe(Boolean(bits & 1))
            }
            // The named consts sit at their own bit positions.
            expect(SETTLE_FLAGS_BY_BITS[1]).toBe(SETTLE_DEFAULT)
            expect(SETTLE_FLAGS_BY_BITS[0]).toBe(SETTLE_UNSET)
            expect(SETTLE_FLAGS_BY_BITS[3]).toBe(SETTLE_SKIP_FAMILY_INDEX)
            expect(SETTLE_FLAGS_BY_BITS[5]).toBe(SETTLE_INIT_ONLY)
        })
    })
})
