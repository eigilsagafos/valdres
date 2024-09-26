import { describe, expect, test } from "bun:test"
import { isSelector } from "./isSelector"
import { atom } from "../atom"
import { selector } from "../selector"

describe("isSelector", () => {
    test("atoms return false", () => {
        expect(isSelector(atom())).toBe(false)
        expect(isSelector(atom(1))).toBe(false)
        expect(isSelector(atom(() => 1))).toBe(false)
    })
    test("selectors return true", () => {
        expect(isSelector(selector(get => {}))).toBe(true)
    })

    test("other values return false", () => {
        expect(isSelector("asdf")).toBe(false)
        expect(isSelector({})).toBe(false)
        expect(isSelector([])).toBe(false)
    })
})
