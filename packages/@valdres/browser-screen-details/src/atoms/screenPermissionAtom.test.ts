import { beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { screenPermissionAtom } from "./screenPermissionAtom"

describe("screenPermissionAtom", () => {
    beforeEach(() => {
        delete (window as { getScreenDetails?: unknown }).getScreenDetails
        screenPermissionAtom.resetSelf()
    })

    test("defaults to 'unsupported' when getScreenDetails is missing", () => {
        const s = store()
        expect(s.get(screenPermissionAtom)).toBe("unsupported")
    })
})
