import { getStoreData } from "./getStoreData"
import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { commitAtoms } from "./setAtoms"
import {
    BULK_NO_EFFECTS_SILENT,
    BULK_WITH_EFFECTS_SILENT,
} from "./commitIntents"

describe("commitAtoms", () => {
    test("invokes atom.onSet for each updated atom with a collecting intent", () => {
        const store1 = store()
        const onSetA = mock(() => {})
        const onSetB = mock(() => {})
        const atomA = atom(1, { onSet: onSetA })
        const atomB = atom("a", { onSet: onSetB })
        store1.get(atomA)
        store1.get(atomB)

        const pairs = new Map<any, any>([
            [atomA, 2],
            [atomB, "b"],
        ])
        commitAtoms(
            pairs,
            getStoreData(store1),
            new Set(),
            BULK_WITH_EFFECTS_SILENT,
        )

        expect(onSetA).toHaveBeenCalledTimes(1)
        expect(onSetA).toHaveBeenCalledWith(2, store1)
        expect(onSetB).toHaveBeenCalledTimes(1)
        expect(onSetB).toHaveBeenCalledWith("b", store1)
    })

    test('onSet: "skip" suppresses atom.onSet invocations', () => {
        const store1 = store()
        const onSetA = mock(() => {})
        const onSetB = mock(() => {})
        const atomA = atom(1, { onSet: onSetA })
        const atomB = atom("a", { onSet: onSetB })
        store1.get(atomA)
        store1.get(atomB)

        const pairs = new Map<any, any>([
            [atomA, 2],
            [atomB, "b"],
        ])
        commitAtoms(
            pairs,
            getStoreData(store1),
            new Set(),
            BULK_NO_EFFECTS_SILENT,
        )

        expect(onSetA).toHaveBeenCalledTimes(0)
        expect(onSetB).toHaveBeenCalledTimes(0)
        // Values still get written
        expect(getStoreData(store1).values.get(atomA)).toBe(2)
        expect(getStoreData(store1).values.get(atomB)).toBe("b")
    })
})
