import { describe, test } from "bun:test"
import { deepFreeze } from "./deepFreeze"

describe("deepFreeze", () => {
    test("null", () => {
        deepFreeze(null)
    })
    test("undefined", () => {
        deepFreeze(undefined)
    })
})
