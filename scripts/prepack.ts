import {
    INSTANCE_GUARD_SIDE_EFFECTS,
    NODE_ENGINE_RANGE,
    PUBLISH_EXPORT_CONDITION_ORDER,
} from "./publish-metadata.ts"

const packageJsonFile = await Bun.file("./package.json")
const packageTmpJsonFile = await Bun.file("./package.tmp.json")
if (await packageTmpJsonFile.exists()) {
    throw new Error("Prepack failed: package.tmp.json already exists")
} else {
    await Bun.write("package.tmp.json", packageJsonFile)
    const json = await packageJsonFile.json()
    delete json.scripts
    delete json.devDependencies
    if (
        !json.exports ||
        typeof json.exports !== "object" ||
        Array.isArray(json.exports)
    ) {
        throw new Error(
            `Prepack failed: ${json.name} must declare an exports map`,
        )
    }
    // valdres-svelte ships uncompiled source via @sveltejs/package and already
    // declares its final dist-pointing `exports` (a `{ types, svelte, default }`
    // condition map) in package.json — the `svelte` condition must survive, and
    // the string-splitting rewrite below assumes `./src/...` string values, so
    // skip it for this package. Other packages keep the source→dist rewrite.
    if (json.name !== "valdres-svelte") {
        const exports = Object.fromEntries(
            Object.entries(json.exports).map(([k, value]) => {
                const v = value as string
                const [, , ...rest] = v.split("/")
                const file = rest.pop()
                const folder = ["dist", ...rest].join("/")
                const developmentFolder = ["dist", "development", ...rest].join(
                    "/",
                )
                const productionFolder = ["dist", "production", ...rest].join(
                    "/",
                )
                const typesDir = ["dist", "types", ...rest].join("/")
                const fileName = file.split(".")[0]
                const targets = {
                    types: `./${typesDir}/${fileName}.d.ts`,
                    ...(json.name === "valdres"
                        ? {
                              production: `./${productionFolder}/${fileName}.js`,
                              development: `./${developmentFolder}/${fileName}.js`,
                          }
                        : {}),
                    import: `./${folder}/${fileName}.js`,
                    default: `./${folder}/${fileName}.js`,
                }
                return [
                    k,
                    Object.fromEntries(
                        PUBLISH_EXPORT_CONDITION_ORDER.filter(
                            condition => condition in targets,
                        ).map(condition => [condition, targets[condition]]),
                    ),
                ]
            }),
        )
        json.exports = exports
    }
    const rootExport = json.exports["."]
    if (
        !rootExport ||
        typeof rootExport !== "object" ||
        typeof rootExport.default !== "string" ||
        typeof rootExport.types !== "string"
    ) {
        throw new Error(
            `Prepack failed: ${json.name} must declare root types and default exports`,
        )
    }

    // Legacy Node10-style resolvers ignore `exports`, so mirror the root
    // targets in the long-standing top-level fields.
    json.main = rootExport.default
    json.types = rootExport.types

    // TypeScript's Node10 resolver also needs explicit redirects for exported
    // subpaths because their declarations live below dist/types/.
    const legacyTypeMappings = Object.fromEntries(
        Object.entries(json.exports)
            .filter(([exportPath]) => exportPath !== ".")
            .map(([exportPath, value]) => {
                const exp = value as { types: string }
                return [exportPath.slice(2), [exp.types.slice(2)]]
            }),
    )
    if (Object.keys(legacyTypeMappings).length > 0) {
        json.typesVersions = { "*": legacyTypeMappings }
    }

    // Importing valdres installs the duplicate-instance guard. Mark only the
    // core entry as side-effectful; bindings retain their authored metadata.
    if (json.name === "valdres") {
        json.sideEffects = [...INSTANCE_GUARD_SIDE_EFFECTS]
    }

    // All published entrypoints are ESM. Node 22.12 is the oldest supported
    // floor exercised by the packed-package require(esm) compatibility gate.
    json.engines = { ...json.engines, node: NODE_ENGINE_RANGE }
    await Bun.write("package.json", JSON.stringify(json, null, 4))
}
