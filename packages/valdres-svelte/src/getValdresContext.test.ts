import { describe, test, expect } from "bun:test"
import { getValdresContext } from "./getValdresContext"

describe("getValdresContext", () => {
    test("throws outside a component context", () => {
        // Svelte throws lifecycle_outside_component for getContext outside init.
        expect(() => getValdresContext()).toThrow()
    })
})
