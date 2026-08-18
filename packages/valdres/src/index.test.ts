import { expect, test } from "bun:test"

test("a legacy version slot produces an actionable version error", async () => {
    const previous = globalThis.__valdres__
    try {
        globalThis.__valdres__ = "0.0.0"
        await expect(
            import("./index?duplicate-instance-test"),
        ).rejects.toThrowError(
            /version is unknown.*Loaded: 0\.0\.0.*Attempted: unknown.*VALDRES_VERSION/is,
        )
    } finally {
        globalThis.__valdres__ = previous
    }
})
