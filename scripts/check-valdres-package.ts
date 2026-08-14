/**
 * End-to-end contract gate for the published `valdres` artifact.
 *
 * The script builds on request, runs `npm pack` exactly once, and passes that
 * immutable tarball to every validator. With `--self-test`, mutation archives
 * derived from the npm tarball prove every check can go red before the intact
 * artifact is allowed to go green.
 */
import { build as esbuild } from "esbuild"
import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join } from "node:path"
import { build as vite } from "vite"
import webpack from "webpack"
import {
    INSTANCE_GUARD_SIDE_EFFECTS,
    MINIMUM_NODE_VERSION,
    NODE_ENGINE_RANGE,
    PUBLISH_EXPORT_CONDITION_ORDER,
} from "./publish-metadata.ts"

const rootDir = join(import.meta.dir, "..")
const packageDir = join(rootDir, "packages", "valdres")
const packageJsonPath = join(packageDir, "package.json")
const packageBackupPath = join(packageDir, "package.tmp.json")
const sizeScript = join(import.meta.dir, "check-package-size.ts")

const allChecks = [
    "manifest",
    "publint",
    "attw",
    "typecheck-bundler",
    "typecheck-node16",
    "typecheck-node10",
    "smoke-node",
    "smoke-node-minimum",
    "smoke-bun",
    "esbuild",
    "vite",
    "webpack",
    "size",
] as const
type CheckName = (typeof allChecks)[number]

const buildPackage = process.argv.includes("--build")
const selfTest = process.argv.includes("--self-test")
const checksArgument = process.argv.find(argument =>
    argument.startsWith("--checks="),
)
const requestedChecks = new Set<CheckName>(
    checksArgument
        ? checksArgument
              .slice("--checks=".length)
              .split(",")
              .map(name => {
                  if (!allChecks.includes(name as CheckName)) {
                      throw new Error(`Unknown package check: ${name}`)
                  }
                  return name as CheckName
              })
        : allChecks,
)

type CommandResult = {
    exitCode: number
    output: string
}

function run(command: string[], cwd: string, quiet = false): CommandResult {
    if (!quiet) console.log(`\n> ${command.join(" ")}`)
    const result = Bun.spawnSync(command, {
        cwd,
        env: { ...process.env, FORCE_COLOR: "0" },
        stdio: [
            "inherit",
            quiet ? "pipe" : "inherit",
            quiet ? "pipe" : "inherit",
        ],
    })
    return {
        exitCode: result.exitCode,
        output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    }
}

function runOrThrow(command: string[], cwd: string) {
    const result = run(command, cwd)
    if (result.exitCode !== 0) {
        throw new Error(
            `Command failed (${result.exitCode}): ${command.join(" ")}`,
        )
    }
}

async function restoreInterruptedPrepack() {
    if (!(await Bun.file(packageBackupPath).exists())) return
    await Bun.write(packageJsonPath, Bun.file(packageBackupPath))
    await rm(packageBackupPath, { force: true })
    console.log("Recovered package.json from an interrupted prepack")
}

async function createNpmTarball(outputDir: string) {
    await restoreInterruptedPrepack()
    const originalManifest = await readFile(packageJsonPath, "utf8")
    try {
        runOrThrow(
            ["bun", "run", join(import.meta.dir, "prepack.ts")],
            packageDir,
        )
        const result = Bun.spawnSync(
            [
                "npm",
                "pack",
                "--ignore-scripts",
                "--json",
                "--pack-destination",
                outputDir,
            ],
            { cwd: packageDir, stdio: ["inherit", "pipe", "inherit"] },
        )
        if (result.exitCode !== 0) throw new Error("npm pack failed")
        const [{ filename }] = JSON.parse(result.stdout.toString())
        const tarballPath = join(outputDir, filename)
        console.log(`\nPacked once: ${basename(tarballPath)}`)
        return tarballPath
    } finally {
        await writeFile(packageJsonPath, originalManifest)
        await rm(packageBackupPath, { force: true })
    }
}

async function listFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, {
        recursive: true,
        withFileTypes: true,
    })
    return entries
        .filter(entry => entry.isFile())
        .map(entry => join(entry.parentPath, entry.name))
        .sort()
}

function exportSpecifiers(manifest: Record<string, any>) {
    return Object.keys(manifest.exports ?? {}).map(exportPath =>
        exportPath === "."
            ? manifest.name
            : `${manifest.name}/${exportPath.slice(2)}`,
    )
}

function recordCommand(
    check: CheckName,
    command: string[],
    cwd: string,
    failures: Set<CheckName>,
    quiet: boolean,
) {
    const result = run(command, cwd, quiet)
    if (result.exitCode !== 0) {
        failures.add(check)
        if (!quiet) console.error(`✗ ${check}`)
    } else if (!quiet) {
        console.log(`✓ ${check}`)
    }
}

async function readPackedManifest(tarballPath: string) {
    const result = Bun.spawnSync(
        ["tar", "-xOf", tarballPath, "package/package.json"],
        { stdio: ["inherit", "pipe", "pipe"] },
    )
    if (result.exitCode !== 0) {
        throw new Error(`Could not read package.json from ${tarballPath}`)
    }
    return JSON.parse(result.stdout.toString())
}

async function checkManifest(
    tarballPath: string,
    manifest: Record<string, any>,
    quiet: boolean,
) {
    const errors: string[] = []
    const expectedConditions = [...PUBLISH_EXPORT_CONDITION_ORDER]
    const listing = run(["tar", "-tzf", tarballPath], rootDir, true).output
    const packedFiles = new Set(listing.trim().split("\n"))
    for (const [exportPath, value] of Object.entries(manifest.exports ?? {})) {
        const conditions = Object.keys(value as object)
        if (JSON.stringify(conditions) !== JSON.stringify(expectedConditions)) {
            errors.push(
                `export ${exportPath} conditions must be ${expectedConditions.join(
                    " → ",
                )}; received ${conditions.join(" → ")}`,
            )
        }
        const exp = value as Record<string, string>
        if (exp.default !== exp.import) {
            errors.push(`export ${exportPath} default must match import`)
        }
        for (const condition of expectedConditions) {
            if (typeof exp[condition] !== "string") {
                errors.push(`export ${exportPath} is missing ${condition}`)
                continue
            }
            const packedPath = `package/${exp[condition].replace(/^\.\//, "")}`
            if (!packedFiles.has(packedPath)) {
                errors.push(
                    `export ${exportPath} ${condition} target is missing: ${exp[condition]}`,
                )
            }
        }
    }
    if (manifest.main !== "./dist/index.js")
        errors.push("main must be ./dist/index.js")
    if (manifest.types !== "./dist/types/index.d.ts") {
        errors.push("types must be ./dist/types/index.d.ts")
    }
    if (
        manifest.exports?.["."]?.development !== "./dist/development/index.js"
    ) {
        errors.push(
            "root development export must be ./dist/development/index.js",
        )
    }
    if (
        JSON.stringify(manifest.sideEffects) !==
        JSON.stringify(INSTANCE_GUARD_SIDE_EFFECTS)
    ) {
        errors.push(
            `sideEffects must be ${JSON.stringify(INSTANCE_GUARD_SIDE_EFFECTS)}`,
        )
    }
    if (manifest.engines?.node !== NODE_ENGINE_RANGE) {
        errors.push(`engines.node must be ${NODE_ENGINE_RANGE}`)
    }
    if (errors.length > 0 && !quiet) {
        for (const error of errors) console.error(`  ✗ ${error}`)
    }
    return errors.length === 0
}

async function writeConsumerSources(
    consumerDir: string,
    manifest: Record<string, any>,
) {
    const specifiers = exportSpecifiers(manifest)
    const imports = specifiers.map(
        (specifier, index) =>
            `import * as entry${index} from ${JSON.stringify(specifier)}`,
    )
    await writeFile(
        join(consumerDir, "index.ts"),
        `${imports.join("\n")}\nvoid [${specifiers.map((_, index) => `entry${index}`).join(", ")}]\n`,
    )
    const runtimeImports = specifiers
        .map(specifier => `import(${JSON.stringify(specifier)})`)
        .join(", ")
    await writeFile(
        join(consumerDir, "runtime-smoke.mjs"),
        `const modules = await Promise.all([${runtimeImports}])\n` +
            `if (modules.some(module => Object.keys(module).length === 0)) throw new Error("empty export")\n`,
    )
    const requires = specifiers
        .map(specifier => `require(${JSON.stringify(specifier)})`)
        .join(", ")
    await writeFile(
        join(consumerDir, "require-smoke.cjs"),
        `const modules = [${requires}]\n` +
            `if (modules.some(module => Object.keys(module).length === 0)) throw new Error("empty export")\n`,
    )
    const browserImports = imports.join("\n")
    const values = specifiers.map((_, index) => `entry${index}`).join(", ")
    await writeFile(
        join(consumerDir, "browser.mjs"),
        `${browserImports}\n` +
            `globalThis.__valdresBrowserSmoke = [${values}].map(Object.keys)\n` +
            `new Worker(new URL("./worker.mjs", import.meta.url), { type: "module" })\n`,
    )
    await writeFile(
        join(consumerDir, "worker.mjs"),
        `${browserImports}\nself.postMessage([${values}].map(Object.keys))\n`,
    )
}

async function typecheck(
    check: CheckName,
    resolution: "Bundler" | "Node16" | "Node10",
    consumerDir: string,
    failures: Set<CheckName>,
    quiet: boolean,
) {
    const configPath = join(
        consumerDir,
        `tsconfig.${resolution.toLowerCase()}.json`,
    )
    await writeFile(
        configPath,
        JSON.stringify(
            {
                compilerOptions: {
                    module: resolution === "Node16" ? "Node16" : "ESNext",
                    moduleResolution: resolution,
                    noEmit: true,
                    skipLibCheck: false,
                    strict: true,
                    target: "ES2022",
                },
                include: ["index.ts"],
            },
            null,
            4,
        ),
    )
    recordCommand(
        check,
        [join(rootDir, "node_modules", ".bin", "tsc"), "-p", configPath],
        consumerDir,
        failures,
        quiet,
    )
}

async function webpackBuild(consumerDir: string) {
    await new Promise<void>((resolvePromise, reject) => {
        const compiler = webpack([
            {
                mode: "production",
                context: consumerDir,
                entry: "./browser.mjs",
                output: {
                    filename: "browser.js",
                    path: join(consumerDir, "dist-webpack", "browser"),
                },
                target: "web",
            },
            {
                mode: "production",
                context: consumerDir,
                entry: "./worker.mjs",
                output: {
                    filename: "worker.js",
                    path: join(consumerDir, "dist-webpack", "worker"),
                },
                target: "webworker",
            },
        ])
        compiler.run((error, stats) => {
            const buildError =
                error ??
                (stats?.hasErrors()
                    ? new Error(stats.toString({ all: false, errors: true }))
                    : undefined)
            compiler.close(closeError => {
                if (buildError || closeError) reject(buildError ?? closeError)
                else resolvePromise()
            })
        })
    })
}

async function runPackageChecks(
    tarballPath: string,
    checks: Set<CheckName>,
    label: string,
    quiet = false,
) {
    if (!quiet) console.log(`\n━━ ${label} ━━`)
    const failures = new Set<CheckName>()
    const manifest = await readPackedManifest(tarballPath)

    if (checks.has("manifest")) {
        if (!(await checkManifest(tarballPath, manifest, quiet)))
            failures.add("manifest")
        else if (!quiet) console.log("✓ manifest")
    }
    if (checks.has("publint")) {
        recordCommand(
            "publint",
            [
                join(rootDir, "node_modules", ".bin", "publint"),
                tarballPath,
                "--strict",
            ],
            rootDir,
            failures,
            quiet,
        )
    }
    if (checks.has("attw")) {
        recordCommand(
            "attw",
            [
                join(rootDir, "node_modules", ".bin", "attw"),
                tarballPath,
                "--profile",
                "strict",
                "--ignore-rules",
                "cjs-resolves-to-esm",
            ],
            rootDir,
            failures,
            quiet,
        )
    }

    const consumerChecks = new Set<CheckName>([
        "typecheck-bundler",
        "typecheck-node16",
        "typecheck-node10",
        "smoke-node",
        "smoke-node-minimum",
        "smoke-bun",
        "esbuild",
        "vite",
        "webpack",
    ])
    const selectedConsumerChecks = [...checks].filter(check =>
        consumerChecks.has(check),
    )
    if (selectedConsumerChecks.length > 0) {
        const consumerDir = await mkdtemp(join(tmpdir(), "valdres-consumer-"))
        try {
            await writeFile(
                join(consumerDir, "package.json"),
                JSON.stringify({ private: true, type: "module" }),
            )
            const install = run(
                [
                    "npm",
                    "install",
                    "--ignore-scripts",
                    "--no-audit",
                    "--no-fund",
                    "--no-package-lock",
                    tarballPath,
                ],
                consumerDir,
                quiet,
            )
            if (install.exitCode !== 0) {
                throw new Error(
                    `Consumer install failed before validators ran:\n${install.output}`,
                )
            } else {
                await writeConsumerSources(consumerDir, manifest)
                if (checks.has("typecheck-bundler")) {
                    await typecheck(
                        "typecheck-bundler",
                        "Bundler",
                        consumerDir,
                        failures,
                        quiet,
                    )
                }
                if (checks.has("typecheck-node16")) {
                    await typecheck(
                        "typecheck-node16",
                        "Node16",
                        consumerDir,
                        failures,
                        quiet,
                    )
                }
                if (checks.has("typecheck-node10")) {
                    await typecheck(
                        "typecheck-node10",
                        "Node10",
                        consumerDir,
                        failures,
                        quiet,
                    )
                }
                if (checks.has("smoke-node")) {
                    recordCommand(
                        "smoke-node",
                        ["node", "runtime-smoke.mjs"],
                        consumerDir,
                        failures,
                        quiet,
                    )
                    recordCommand(
                        "smoke-node",
                        ["node", "require-smoke.cjs"],
                        consumerDir,
                        failures,
                        quiet,
                    )
                    recordCommand(
                        "smoke-node",
                        [
                            "node",
                            "--conditions=development",
                            "runtime-smoke.mjs",
                        ],
                        consumerDir,
                        failures,
                        quiet,
                    )
                }
                if (checks.has("smoke-node-minimum")) {
                    recordCommand(
                        "smoke-node-minimum",
                        [
                            "npx",
                            "--yes",
                            `--package=node@${MINIMUM_NODE_VERSION}`,
                            "--",
                            "node",
                            "require-smoke.cjs",
                        ],
                        consumerDir,
                        failures,
                        quiet,
                    )
                }
                if (checks.has("smoke-bun")) {
                    recordCommand(
                        "smoke-bun",
                        ["bun", "runtime-smoke.mjs"],
                        consumerDir,
                        failures,
                        quiet,
                    )
                }
                if (checks.has("esbuild")) {
                    try {
                        await esbuild({
                            absWorkingDir: consumerDir,
                            bundle: true,
                            entryPoints: ["browser.mjs", "worker.mjs"],
                            format: "esm",
                            outdir: "dist-esbuild",
                            platform: "browser",
                            write: true,
                        })
                        if (!quiet) console.log("✓ esbuild")
                    } catch (error) {
                        failures.add("esbuild")
                        if (!quiet) console.error(error)
                    }
                }
                if (checks.has("vite")) {
                    try {
                        await vite({
                            root: consumerDir,
                            logLevel: quiet ? "silent" : "warn",
                            build: {
                                emptyOutDir: true,
                                minify: true,
                                outDir: "dist-vite",
                                rollupOptions: {
                                    // Vite recognizes this browser entry's
                                    // `new Worker(new URL(...))` edge and runs
                                    // worker.mjs through its worker pipeline.
                                    input: join(consumerDir, "browser.mjs"),
                                },
                            },
                        })
                        const viteOutputs = await listFiles(
                            join(consumerDir, "dist-vite"),
                        )
                        const emittedWorker = (
                            await Promise.all(
                                viteOutputs
                                    .filter(file => file.endsWith(".js"))
                                    .map(file => readFile(file, "utf8")),
                            )
                        ).some(source => source.includes("postMessage"))
                        if (!emittedWorker) {
                            throw new Error(
                                "Vite did not emit the web worker entry",
                            )
                        }
                        if (!quiet) console.log("✓ vite")
                    } catch (error) {
                        failures.add("vite")
                        if (!quiet) console.error(error)
                    }
                }
                if (checks.has("webpack")) {
                    try {
                        await webpackBuild(consumerDir)
                        if (!quiet) console.log("✓ webpack")
                    } catch (error) {
                        failures.add("webpack")
                        if (!quiet) console.error(error)
                    }
                }
            }
        } finally {
            await rm(consumerDir, { recursive: true, force: true })
        }
    }

    if (checks.has("size")) {
        recordCommand(
            "size",
            ["bun", "run", sizeScript, tarballPath],
            rootDir,
            failures,
            quiet,
        )
    }
    return failures
}

async function createMutation(
    tarballPath: string,
    mutationsDir: string,
    name: string,
    mutate: (packageRoot: string) => Promise<void>,
) {
    const workDir = join(mutationsDir, name)
    await mkdir(workDir, { recursive: true })
    runOrThrow(["tar", "-xzf", tarballPath, "-C", workDir], rootDir)
    await mutate(join(workDir, "package"))
    const mutationPath = join(mutationsDir, `${name}.tgz`)
    runOrThrow(["tar", "-czf", mutationPath, "-C", workDir, "package"], rootDir)
    return mutationPath
}

function deterministicNoise(length: number) {
    const alphabet =
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let state = 0x6d2b79f5
    let output = ""
    for (let index = 0; index < length; index++) {
        state = Math.imul(state ^ (state >>> 15), state | 1)
        state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
        output += alphabet[((state ^ (state >>> 14)) >>> 0) % alphabet.length]
    }
    return output
}

async function proveRed(tarballPath: string, mutationsDir: string) {
    console.log(
        "\n━━ Red phase: proving every validator rejects a broken artifact ━━",
    )
    const probes: Array<{
        name: string
        checks: CheckName[]
        mutate: (packageRoot: string) => Promise<void>
    }> = [
        {
            name: "reordered-conditions",
            checks: ["manifest", "publint"],
            mutate: async packageRoot => {
                const path = join(packageRoot, "package.json")
                const manifest = JSON.parse(await readFile(path, "utf8"))
                for (const [key, value] of Object.entries(manifest.exports)) {
                    const exp = value as Record<string, string>
                    manifest.exports[key] = {
                        default: exp.default,
                        types: exp.types,
                        development: exp.development,
                        import: exp.import,
                    }
                }
                await writeFile(path, JSON.stringify(manifest, null, 4))
            },
        },
        {
            name: "missing-types",
            checks: [
                "attw",
                "typecheck-bundler",
                "typecheck-node16",
                "typecheck-node10",
            ],
            mutate: async packageRoot => {
                const manifest = JSON.parse(
                    await readFile(join(packageRoot, "package.json"), "utf8"),
                )
                const typesTarget = manifest.exports["."].types.replace(
                    /^\.\//,
                    "",
                )
                await rm(join(packageRoot, typesTarget))
            },
        },
        {
            name: "wrong-development-target",
            checks: ["manifest"],
            mutate: async packageRoot => {
                const path = join(packageRoot, "package.json")
                const manifest = JSON.parse(await readFile(path, "utf8"))
                manifest.exports["."].development =
                    manifest.exports["."].default
                await writeFile(path, JSON.stringify(manifest, null, 4))
            },
        },
        {
            name: "invalid-runtime",
            checks: [
                "smoke-node",
                "smoke-node-minimum",
                "smoke-bun",
                "esbuild",
                "vite",
                "webpack",
            ],
            mutate: async packageRoot => {
                const files = (
                    await listFiles(join(packageRoot, "dist"))
                ).filter(file => file.endsWith(".js"))
                await Promise.all(
                    files.map(file => writeFile(file, "export {\n")),
                )
            },
        },
        {
            name: "oversized-fixture",
            checks: ["size"],
            mutate: async packageRoot => {
                const path = join(packageRoot, "dist", "index.js")
                const source = await readFile(path, "utf8")
                await writeFile(
                    path,
                    `${source}\nexport const __oversizedPackageGateFixture=${JSON.stringify(
                        deterministicNoise(200_000),
                    )};\n`,
                )
            },
        },
    ]

    for (const probe of probes) {
        const mutation = await createMutation(
            tarballPath,
            mutationsDir,
            probe.name,
            probe.mutate,
        )
        const failures = await runPackageChecks(
            mutation,
            new Set(probe.checks),
            probe.name,
            true,
        )
        const unexpectedlyGreen = probe.checks.filter(
            check => !failures.has(check),
        )
        if (unexpectedlyGreen.length > 0) {
            throw new Error(
                `Red-phase probe ${probe.name} did not trip: ${unexpectedlyGreen.join(", ")}`,
            )
        }
        console.log(`✓ ${probe.name} tripped ${probe.checks.join(", ")}`)
    }
}

const temporaryDir = await mkdtemp(join(tmpdir(), "valdres-package-gate-"))
try {
    if (buildPackage) {
        runOrThrow(["bun", "--filter", "valdres", "build"], rootDir)
        runOrThrow(["bun", "--filter", "valdres", "build:types"], rootDir)
    }
    const tarballPath = await createNpmTarball(temporaryDir)
    if (selfTest) await proveRed(tarballPath, join(temporaryDir, "mutations"))

    const failures = await runPackageChecks(
        tarballPath,
        requestedChecks,
        "Green phase: validating the exact npm tarball",
    )
    if (failures.size > 0) {
        throw new Error(`Package gate failed: ${[...failures].join(", ")}`)
    }
    console.log("\nPackage gate passed")
} finally {
    await restoreInterruptedPrepack()
    await rm(temporaryDir, { recursive: true, force: true })
}
