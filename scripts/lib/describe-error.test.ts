import { expect, test } from "bun:test"
import { describeError } from "./describe-error"

test("uses an Error's message", () => {
    expect(describeError(new Error("prepack failed"))).toBe("prepack failed")
})

test("passes a thrown string through", () => {
    expect(describeError("something broke")).toBe("something broke")
})

test('never renders as "undefined" for non-Error throws', () => {
    for (const thrown of [undefined, null, "", 0, { code: "E404" }]) {
        expect(describeError(thrown)).not.toBe("undefined")
        expect(describeError(thrown).length).toBeGreaterThan(0)
    }
    expect(describeError(undefined)).toMatch(/non-Error value thrown/)
    expect(describeError({ code: "E404" })).toMatch(/E404/)
})
