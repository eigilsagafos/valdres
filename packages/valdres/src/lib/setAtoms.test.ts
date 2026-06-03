import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { setAtoms } from "./setAtoms"

describe("setAtoms", () => {
    test("invokes atom.onSet for each updated atom by default", () => {
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
        setAtoms(pairs, store1.data, new Set())

        expect(onSetA).toHaveBeenCalledTimes(1)
        expect(onSetA).toHaveBeenCalledWith(2, store1.data)
        expect(onSetB).toHaveBeenCalledTimes(1)
        expect(onSetB).toHaveBeenCalledWith("b", store1.data)
    })

    test("skipOnSet=true suppresses atom.onSet invocations", () => {
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
        setAtoms(pairs, store1.data, new Set(), true)

        expect(onSetA).toHaveBeenCalledTimes(0)
        expect(onSetB).toHaveBeenCalledTimes(0)
        // Values still get written
        expect(store1.data.values.get(atomA)).toBe(2)
        expect(store1.data.values.get(atomB)).toBe("b")
    })
})
