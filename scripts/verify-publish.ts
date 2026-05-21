/**
 * Verifies the publish pipeline produces valid, publishable packages.
 *
 * Runs: build → build:types → prepack for each public package, then checks:
 *   1. Exports point to real files in dist/
 *   2. Types files exist for each export
 *   3. No workspace: references remain in dependencies (after prepack)
 *   4. No scripts or devDependencies in prepacked package.json
 *   5. version field is present
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

const PUBLIC_PACKAGES = [
    "packages/valdres",
    "packages/valdres-react",
    "packages/valdres-angular",
    "packages/valdres-solid",
    "packages/valdres-svelte",
    "packages/valdres-vue",
    "packages/@valdres/bandwidth",
    "packages/@valdres/browser-color-scheme",
    "packages/@valdres/browser-contrast",
    "packages/@valdres/browser-device-motion",
    "packages/@valdres/browser-device-orientation",
    "packages/@valdres/browser-focus",
    "packages/@valdres/browser-geolocation",
    "packages/@valdres/browser-keyboard",
    "packages/@valdres/browser-online",
    "packages/@valdres/browser-presence",
    "packages/@valdres/browser-reduced-data",
    "packages/@valdres/browser-reduced-motion",
    "packages/@valdres/browser-reduced-transparency",
    "packages/@valdres/browser-screen",
    "packages/@valdres/browser-screen-details",
    "packages/@valdres/browser-visibility",
    "packages/@valdres/browser-window",
    "packages/@valdres/color-mode",
    "packages/@valdres/hotkeys",
    "packages/@valdres/public-ip",
    "packages/@valdres-react/color-mode",
    "packages/@valdres-react/draggable",
    "packages/@valdres-react/hotkeys",
    "packages/@valdres-react/jotai",
    "packages/@valdres-react/panable",
    "packages/@valdres-react/recoil",
]

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

    // Save original so we can restore after prepack — prepack itself is now
    // responsible for resolving any workspace: refs to concrete versions.
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

        // Check: no workspace: references in any dependency field
        for (const depField of ["dependencies", "peerDependencies", "optionalDependencies"]) {
            const deps = packageJson[depField]
            if (!deps) continue
            for (const [dep, version] of Object.entries(deps)) {
                if (typeof version === "string" && version.includes("workspace:")) {
                    error(pkgName, `${depField}.${dep} still has workspace reference: ${version}`)
                }
            }
        }

        // Check: exports point to real files
        if (packageJson.exports) {
            for (const [exportPath, exportValue] of Object.entries(packageJson.exports)) {
                const exp = exportValue as { import?: string; types?: string }

                if (exp.import) {
                    const importPath = `${pkgDir}/${exp.import}`
                    const file = Bun.file(importPath)
                    if (!(await file.exists())) {
                        error(pkgName, `export "${exportPath}" import file missing: ${exp.import}`)
                    } else if (file.size === 0) {
                        error(pkgName, `export "${exportPath}" import file is empty: ${exp.import}`)
                    }
                } else {
                    error(pkgName, `export "${exportPath}" missing import field`)
                }

                if (exp.types) {
                    const typesPath = `${pkgDir}/${exp.types}`
                    const file = Bun.file(typesPath)
                    if (!(await file.exists())) {
                        warn(pkgName, `export "${exportPath}" types file missing: ${exp.types}`)
                    }
                } else {
                    error(pkgName, `export "${exportPath}" missing types field`)
                }
            }
        } else {
            error(pkgName, "missing exports field")
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
    console.log(`\nAll ${PUBLIC_PACKAGES.length} packages verified successfully`)
    console.log("")
}
