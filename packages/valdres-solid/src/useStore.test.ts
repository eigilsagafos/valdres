import { describe, test, expect } from "bun:test"
import { createRoot } from "solid-js"
import { useStore } from "./useStore"

describe("useStore", () => {
    test("throws without provider", () => {
        expect(() => {
            createRoot(dispose => {
                useStore()
                dispose()
            })
        }).toThrow("No valdres store found")
    })
})
