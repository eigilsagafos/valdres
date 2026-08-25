/**
 * Verifies the publish pipeline produces valid, publishable packages.
 *
 * The package set comes from scripts/public-packages.ts — the same derivation
 * ci-publish.sh prepacks from — so a newly added package is verified here
 * without anyone remembering to list it.
 *
 * Runs: build → build:types → prepack for each public package, then checks:
 *   1. Exports are types-first and point to real files in dist/
 *   2. Types files exist for each export
 *   3. Legacy main/types and engines metadata is present
 *   4. The core side effect and Svelte's authored sideEffects are preserved
 *   5. No workspace: references remain in dependencies (after prepack)
 *   6. No scripts or devDependencies in prepacked package.json
 *   7. version field is present
 *
 * scripts/lib/with-prepacked.ts owns the mutate-and-restore step, so the
 * authored package.json comes back — and prepack's backup is removed — however
 * the checks or prepack itself end.
 *
 * The `workspace:` protocol rule this enforces on the prepacked manifest is
 * shared with first-publish.ts and documented in
 * scripts/lib/workspace-protocol.ts.
 */

import { describeError } from "./lib/describe-error.ts"
import { withPrepacked } from "./lib/with-prepacked.ts"
import { findWorkspaceProtocolViolations } from "./lib/workspace-protocol.ts"
import {
    INSTANCE_GUARD_SIDE_EFFECTS,
    NODE_ENGINE_RANGE,
} from "./publish-metadata.ts"
import { readPublicPackages, REPO_ROOT } from "./public-packages.ts"

// Same derived set that ci-publish.sh prepacks, so this gate cannot verify a
// narrower list than the one that actually reaches npm.
const PUBLIC_PACKAGES = (await readPublicPackages(REPO_ROOT)).map(
    pkg => pkg.dir,
)

const errors: string[] = []
const warnings: string[] = []

function error(pkg: string, msg: string) {
    errors.push(`[${pkg}] ${msg}`)
}

function warn(pkg: string, msg: string) {
    warnings.push(`[${pkg}] ${msg}`)
}

const rootDir = REPO_ROOT

// Step 1: Build all packages
console.log("Building all packages...")
const buildResult = Bun.spawnSync(["bun", "run", "build"], {
    cwd: rootDir,
    stdio: ["inherit", "inherit", "inherit"],
})
if (buildResult.exitCode !== 0) {
    console.error("Build failed!")
    process.exit(1)
}

console.log("Building types...")
const typesResult = Bun.spawnSync(["bun", "run", "build:types"], {
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

    // withPrepacked owns the restore: it puts the authored manifest back and
    // deletes prepack's backup even when prepack itself throws partway, which
    // the previous inline version did not (it left a gitignored
    // package.tmp.json that broke the next run). Publishable packages must
    // already use plain semver for inter-package deps — prepack only rewrites
    // `exports` and strips scripts/devDependencies; the `workspace:` check
    // below is the gate.
    try {
        await withPrepacked(pkgDir, async () => {
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

            // Check: no workspace: references in any dependency field
            for (const violation of findWorkspaceProtocolViolations(
                packageJson,
            )) {
                error(
                    pkgName,
                    `${violation.field}.${violation.dependency} still has workspace reference: ${violation.range}`,
                )
            }

            // Check: exports point to real files
            if (packageJson.exports) {
                for (const [exportPath, exportValue] of Object.entries(
                    packageJson.exports,
                )) {
                    const exp = exportValue as {
                        development?: string
                        import?: string
                        svelte?: string
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

                    const conditionalRuntime = exp.import ?? exp.svelte
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

                    // The runnable entry is `import` for the bun-built packages, or
                    // the `svelte`/`default` condition for the svelte-package build.
                    const runtimeField = exp.import ?? exp.svelte ?? exp.default
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
                            `export "${exportPath}" missing import/svelte/default field`,
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
                        error(
                            pkgName,
                            `export "${exportPath}" missing types field`,
                        )
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
                error(
                    pkgName,
                    "top-level types must match the root types export",
                )
            }

            if (pkgName === "valdres") {
                if (packageJson.sideEffects === false) {
                    error(
                        pkgName,
                        "sideEffects:false would remove the instance guard",
                    )
                } else if (
                    JSON.stringify(packageJson.sideEffects) !==
                    JSON.stringify(INSTANCE_GUARD_SIDE_EFFECTS)
                ) {
                    error(
                        pkgName,
                        `sideEffects must be ${JSON.stringify(INSTANCE_GUARD_SIDE_EFFECTS)}`,
                    )
                }
            } else if (
                pkgName === "valdres-svelte" &&
                packageJson.sideEffects !== false
            ) {
                error(pkgName, "prepack must preserve sideEffects:false")
            }

            if (packageJson.engines?.node !== NODE_ENGINE_RANGE) {
                error(pkgName, `engines.node must be ${NODE_ENGINE_RANGE}`)
            }

            // Check: publishConfig
            if (!packageJson.publishConfig?.access) {
                warn(pkgName, "missing publishConfig.access")
            }
        })
    } catch (thrown) {
        // The checks above accumulate into `errors` rather than throwing, so
        // anything landing here is prepack or the restore failing.
        error(pkgName, describeError(thrown))
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
