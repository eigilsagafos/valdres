/**
 * Verifies the publish pipeline produces valid, publishable packages.
 *
 * Runs: build → build:types → prepack for the certified v1-beta packages, then checks:
 *   1. Exports are types-first and point to real files in dist/
 *   2. Types files exist for each export
 *   3. Legacy main/types and engines metadata is present
 *   4. The isolated core is explicitly side-effect free
 *   5. No workspace: references remain in dependencies (after prepack)
 *   6. No scripts or devDependencies in prepacked package.json
 *   7. version field is present
 *   8. gitHead is omitted so npm records the actual publish checkout
 *
 * Always restores original package.json via postpublish, even on failure.
 *
 * Publishable packages must not use the `workspace:` protocol in
 * dependencies / peerDependencies / optionalDependencies — changesets doesn't
 * rewrite the bare `workspace:^` shortcut, and `changeset publish` shells out
 * to `npm publish` which doesn't understand the protocol, so any leftover
 * `workspace:` would ship verbatim and break consumers. The check below is
 * the regression gate. (devDependencies are stripped by prepack, so they're
 * allowed to use `workspace:^` for ergonomics with non-publishable packages
 * like @valdres/test.)
 */

import { CORE_SIDE_EFFECTS, NODE_ENGINE_RANGE } from "./publish-metadata.ts"

const PUBLIC_PACKAGES = ["packages/valdres", "packages/valdres-react"]

const errors: string[] = []
const warnings: string[] = []

function error(pkg: string, msg: string) {
    errors.push(`[${pkg}] ${msg}`)
}

function warn(pkg: string, msg: string) {
    warnings.push(`[${pkg}] ${msg}`)
}

const rootDir = import.meta.dir + "/.."
const prepackScript = `${import.meta.dir}/prepack.ts`

// Step 1: Build only the certified release cohort.
console.log("Building the v1-beta release cohort...")
const buildResult = Bun.spawnSync(["bun", "run", "build:v1-beta"], {
    cwd: rootDir,
    stdio: ["inherit", "inherit", "inherit"],
})
if (buildResult.exitCode !== 0) {
    console.error("Build failed!")
    process.exit(1)
}

console.log("Building types...")
const typesResult = Bun.spawnSync(["bun", "run", "build:types:v1-beta"], {
    cwd: rootDir,
    stdio: ["inherit", "inherit", "inherit"],
})
if (typesResult.exitCode !== 0) {
    console.error("Type build failed!")
    process.exit(1)
}

// Step 2: For each package: resolve workspace refs → prepack → verify → restore
for (const pkg of PUBLIC_PACKAGES) {
    const pkgDir = `${rootDir}/${pkg}`
    const pkgName = pkg.replace("packages/", "")
    const pkgJsonPath = `${pkgDir}/package.json`

    console.log(`\nVerifying ${pkgName}...`)

    // Save original so we can restore after prepack writes its dist-shaped
    // package.json. Publishable packages must already use plain semver for
    // inter-package deps — prepack only rewrites `exports` and strips
    // scripts/devDependencies; the `workspace:` check below is the gate.
    const originalContent = await Bun.file(pkgJsonPath).text()

    // Run prepack
    const prepackResult = Bun.spawnSync(["bun", "run", prepackScript], {
        cwd: pkgDir,
        stdio: ["inherit", "pipe", "pipe"],
    })

    if (prepackResult.exitCode !== 0) {
        error(pkgName, `prepack failed: ${prepackResult.stderr.toString()}`)
        // Restore original
        await Bun.write(pkgJsonPath, originalContent)
        continue
    }

    try {
        // Read the prepacked package.json
        const packageJson = await Bun.file(pkgJsonPath).json()

        // Check: no scripts
        if (packageJson.scripts) {
            error(pkgName, "scripts should be removed by prepack")
        }

        // Check: no devDependencies
        if (packageJson.devDependencies) {
            error(pkgName, "devDependencies should be removed by prepack")
        }

        // Check: version exists
        if (!packageJson.version) {
            error(pkgName, "missing version field")
        }

        // npm derives gitHead from the checkout being published. A committed
        // value wins over that derivation and leaves immutable registry
        // metadata pointing at an unrelated historical commit.
        if (Object.hasOwn(packageJson, "gitHead")) {
            error(pkgName, "gitHead must be owned by npm, not package.json")
        }

        // Check: no workspace: references in any dependency field
        for (const depField of [
            "dependencies",
            "peerDependencies",
            "optionalDependencies",
        ]) {
            const deps = packageJson[depField]
            if (!deps) continue
            for (const [dep, version] of Object.entries(deps)) {
                if (
                    typeof version === "string" &&
                    version.includes("workspace:")
                ) {
                    error(
                        pkgName,
                        `${depField}.${dep} still has workspace reference: ${version}`,
                    )
                }
            }
        }

        // Check: exports point to real files
        if (packageJson.exports) {
            for (const [exportPath, exportValue] of Object.entries(
                packageJson.exports,
            )) {
                const exp = exportValue as {
                    development?: string
                    import?: string
                    default?: string
                    types?: string
                }

                if (Object.keys(exp)[0] !== "types") {
                    error(
                        pkgName,
                        `export "${exportPath}" must put types first`,
                    )
                }

                if (pkgName === "valdres") {
                    if (!exp.development) {
                        error(
                            pkgName,
                            `export "${exportPath}" missing development field`,
                        )
                    } else {
                        const keys = Object.keys(exp)
                        if (
                            keys.includes("default") &&
                            keys.indexOf("development") >
                                keys.indexOf("default")
                        ) {
                            error(
                                pkgName,
                                `export "${exportPath}" must put development before default`,
                            )
                        }
                        const developmentPath = `${pkgDir}/${exp.development}`
                        const file = Bun.file(developmentPath)
                        if (!(await file.exists())) {
                            error(
                                pkgName,
                                `export "${exportPath}" development entry file missing: ${exp.development}`,
                            )
                        } else if (file.size === 0) {
                            error(
                                pkgName,
                                `export "${exportPath}" development entry file is empty: ${exp.development}`,
                            )
                        }
                    }
                }

                const conditionalRuntime = exp.import
                if (!exp.default) {
                    error(
                        pkgName,
                        `export "${exportPath}" missing default field`,
                    )
                } else if (
                    conditionalRuntime &&
                    exp.default !== conditionalRuntime
                ) {
                    error(
                        pkgName,
                        `export "${exportPath}" default must match its runtime entry`,
                    )
                }

                const runtimeField = exp.import ?? exp.default
                if (runtimeField) {
                    const importPath = `${pkgDir}/${runtimeField}`
                    const file = Bun.file(importPath)
                    if (!(await file.exists())) {
                        error(
                            pkgName,
                            `export "${exportPath}" entry file missing: ${runtimeField}`,
                        )
                    } else if (file.size === 0) {
                        error(
                            pkgName,
                            `export "${exportPath}" entry file is empty: ${runtimeField}`,
                        )
                    }
                } else {
                    error(
                        pkgName,
                        `export "${exportPath}" missing import/default field`,
                    )
                }

                if (exp.types) {
                    const typesPath = `${pkgDir}/${exp.types}`
                    const file = Bun.file(typesPath)
                    if (!(await file.exists())) {
                        error(
                            pkgName,
                            `export "${exportPath}" types file missing: ${exp.types}`,
                        )
                    }
                } else {
                    error(pkgName, `export "${exportPath}" missing types field`)
                }
            }
        } else {
            error(pkgName, "missing exports field")
        }

        const rootExport = packageJson.exports?.["."] as
            | { default?: string; types?: string }
            | undefined

        if (!packageJson.main) {
            error(pkgName, "missing main field")
        } else if (packageJson.main !== rootExport?.default) {
            error(pkgName, "main must match the root default export")
        }

        if (!packageJson.types) {
            error(pkgName, "missing top-level types field")
        } else if (packageJson.types !== rootExport?.types) {
            error(pkgName, "top-level types must match the root types export")
        }

        if (pkgName === "valdres") {
            if (packageJson.sideEffects !== CORE_SIDE_EFFECTS) {
                error(
                    pkgName,
                    "sideEffects must be false for the isolated v1 root",
                )
            }
        }

        if (packageJson.engines?.node !== NODE_ENGINE_RANGE) {
            error(pkgName, `engines.node must be ${NODE_ENGINE_RANGE}`)
        }

        // Check: publishConfig
        if (!packageJson.publishConfig?.access) {
            warn(pkgName, "missing publishConfig.access")
        }
    } finally {
        // postpublish restores from package.tmp.json (which has resolved versions),
        // so we need to clean up the tmp file and restore the true original.
        const tmpFile = Bun.file(`${pkgDir}/package.tmp.json`)
        if (await tmpFile.exists()) {
            await tmpFile.delete()
        }
        await Bun.write(pkgJsonPath, originalContent)
    }
}

// Report
console.log("\n" + "=".repeat(60))

if (warnings.length > 0) {
    console.log(`\n${warnings.length} warning(s):`)
    for (const w of warnings) {
        console.log(`  ${w}`)
    }
}

if (errors.length > 0) {
    console.log(`\n${errors.length} error(s):`)
    for (const e of errors) {
        console.error(`  ${e}`)
    }
    console.log("")
    process.exit(1)
} else {
    console.log(
        `\nAll ${PUBLIC_PACKAGES.length} packages verified successfully`,
    )
    console.log("")
}
