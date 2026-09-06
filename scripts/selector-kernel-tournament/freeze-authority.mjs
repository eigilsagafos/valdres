// Maintainer-only authority refresh. Changing this manifest invalidates every
// earlier run; candidate protected paths forbid this command's output changes.
import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const directory = resolve(
    root,
    "packages/valdres/test/selector-kernel-tournament",
)
const path = resolve(directory, "fixture-manifest.v3.json")
const manifest = JSON.parse(readFileSync(path, "utf8"))
manifest.spec.sha256 = createHash("sha256")
    .update(readFileSync(resolve(root, manifest.spec.path)))
    .digest("hex")
function schema(value, path = "") {
    if (path === "spec.sha256")
        return { type: "string", pattern: "^[a-f0-9]{64}$" }
    if (Array.isArray(value))
        return value.length
            ? {
                  type: "array",
                  minItems: value.length,
                  maxItems: value.length,
                  prefixItems: value.map((v, i) => schema(v, `${path}.${i}`)),
                  items: false,
              }
            : { type: "array", maxItems: 0, items: false }
    if (value && typeof value === "object")
        return {
            type: "object",
            additionalProperties: false,
            required: Object.keys(value),
            properties: Object.fromEntries(
                Object.entries(value).map(([k, v]) => [
                    k,
                    schema(v, path ? path + "." + k : k),
                ]),
            ),
        }
    return { const: value }
}
writeFileSync(path, JSON.stringify(manifest, null, 4) + "\n")
writeFileSync(
    resolve(directory, "fixture-manifest.schema.json"),
    JSON.stringify(
        {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            $id: "https://valdres.dev/selector-kernel-tournament/fixture-manifest.v3.schema.json",
            title: "Frozen selector-kernel tournament v3 authority",
            ...schema(manifest),
        },
        null,
        4,
    ) + "\n",
)
