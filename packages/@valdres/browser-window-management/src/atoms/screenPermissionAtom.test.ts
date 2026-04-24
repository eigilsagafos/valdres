import { describe, expect, test } from "bun:test"
import { store } from "valdres"
import { screenPermissionAtom } from "./screenPermissionAtom"

describe("screenPermissionAtom", () => {
    test("defaults to 'unsupported' when getScreenDetails is missing", () => {
        const s = store()
        expect(s.get(screenPermissionAtom)).toBe("unsupported")
    })
})
