import { describe, test, expect } from "bun:test"
import { setValdresContext, getValdresContext } from "./context"

describe("context", () => {
    test("setValdresContext is a function", () => {
        expect(typeof setValdresContext).toBe("function")
    })

    test("getValdresContext is a function", () => {
        expect(typeof getValdresContext).toBe("function")
    })

    test("getValdresContext throws outside component context", () => {
        expect(() => getValdresContext()).toThrow()
    })
})
