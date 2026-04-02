// Note: jest-leak-detector uses node:v8 setFlagsFromString which is not supported in Bun.
// All tests are marked as todo until Bun supports this or an alternative leak detector is used.
import { describe, test } from "bun:test"

describe("memory leaks (get & set only)", () => {
    test.todo("one atom")
    test.todo("two atoms")
    test.todo("should not hold onto dependent atoms that are not mounted")
    test.todo("with a long-lived base atom")
})

describe("memory leaks (with subscribe)", () => {
    test.todo("one atom")
    test.todo("two atoms")
    test.todo("with a long-lived base atom")
})

describe("memory leaks (with dependencies)", () => {
    test.todo("sync dependency")
    test.todo("async dependency")
    test.todo("async await dependency")
})
