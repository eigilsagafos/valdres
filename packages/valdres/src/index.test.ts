import { expect, test } from "bun:test"
import { version } from "../package.json"

test("Error", async () => {
    globalThis.__valdres__ = "0.0.0"
    expect(() => import(".")).toThrowError("Loaded: 0.0.0")
    globalThis.__valdres__ = version
})
