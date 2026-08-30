import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
export const INITIAL_VIEW_CORE_MANIFEST_PATH = resolve(
    HERE,
    "initial-view-core.v1.json",
)

const manifest = JSON.parse(
    readFileSync(INITIAL_VIEW_CORE_MANIFEST_PATH, "utf8"),
)

export const INITIAL_VIEW_CORE_SCENARIO = "initial-view-core"
if (
    manifest.schemaVersion !== 1 ||
    manifest.name !== INITIAL_VIEW_CORE_SCENARIO
) {
    throw new Error("initial-view-core manifest identity is invalid")
}

export const INITIAL_VIEW_CORE = Object.freeze({
    ...manifest,
    expected: Object.freeze({ ...manifest.expected }),
    internal: Object.freeze({ ...manifest.internal }),
})
