/**
 * isRecoilValue tests adapted from Recoil's test suite.
 */
import { describe, test, expect } from "bun:test"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { atomFamily } from "../src/atomFamily"
import { selectorFamily } from "../src/selectorFamily"
import { isRecoilValue } from "../src/isRecoilValue"

let nextKey = 0
function uniqueKey() {
    return `isRecoilValue-test-${nextKey++}`
}

describe("recoil/isRecoilValue", () => {
    test("returns true for atoms", () => {
        const myAtom = atom({ key: uniqueKey(), default: 0 })
        expect(isRecoilValue(myAtom)).toBe(true)
    })

    test("returns true for selectors", () => {
        const mySelector = selector({
            key: uniqueKey(),
            get: () => 0,
        })
        expect(isRecoilValue(mySelector)).toBe(true)
    })

    test("returns true for atomFamily members", () => {
        const myFamily = atomFamily({ key: uniqueKey(), default: 0 })
        expect(isRecoilValue(myFamily("param"))).toBe(true)
    })

    test("returns true for selectorFamily members", () => {
        const myFamily = selectorFamily({
            key: uniqueKey(),
            get:
                (param: string) =>
                () =>
                    param,
        })
        expect(isRecoilValue(myFamily("param"))).toBe(true)
    })

    test("returns false for non-Recoil values", () => {
        expect(isRecoilValue(null)).toBe(false)
        expect(isRecoilValue(undefined)).toBe(false)
        expect(isRecoilValue(0)).toBe(false)
        expect(isRecoilValue("string")).toBe(false)
        expect(isRecoilValue({})).toBe(false)
        expect(isRecoilValue([])).toBe(false)
        expect(isRecoilValue(() => {})).toBe(false)
    })
})
