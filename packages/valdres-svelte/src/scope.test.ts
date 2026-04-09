import { describe, test, expect } from "bun:test"
import { scope } from "./scope"

describe("scope", () => {
    test("scope is a function", () => {
        expect(typeof scope).toBe("function")
    })

    test("throws outside component context", () => {
        expect(() => scope("test")).toThrow()
    })
})
