import { expect, test } from "bun:test"

test("Error", async () => {
    const previous = globalThis.__valdres__
    try {
        globalThis.__valdres__ = "0.0.0"
        await expect(
            import("./index?duplicate-instance-test"),
        ).rejects.toThrowError(
            "valdres: an instance is already loaded. Loaded: 0.0.0 (unknown)",
        )
    } finally {
        globalThis.__valdres__ = previous
    }
})
