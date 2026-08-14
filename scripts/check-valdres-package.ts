/**
 * Exercise the published `valdres` artifact with package- and consumer-level
 * compatibility checks. All checks run against the dist-shaped package.json
 * produced by prepack; the Node16 consumer installs the resulting tarball.
 */

import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
    INSTANCE_GUARD_SIDE_EFFECTS,
    MINIMUM_NODE_VERSION,
    NODE_ENGINE_RANGE,
} from "./publish-metadata.ts"

const rootDir = join(import.meta.dir, "..")
const packageDir = join(rootDir, "packages", "valdres")
const packageJsonPath = join(packageDir, "package.json")
const packageBackupPath = join(packageDir, "package.tmp.json")
const failedChecks: string[] = []

async function restorePackageBackup() {
    const backup = Bun.file(packageBackupPath)
    if (!(await backup.exists())) return false
    await Bun.write(packageJsonPath, backup)
    await rm(packageBackupPath)
    return true
}

function check(name: string, command: string[], cwd: string) {
    console.log(`\n> ${command.join(" ")}`)
    const result = Bun.spawnSync(command, {
        cwd,
        stdio: ["inherit", "inherit", "inherit"],
    })
    if (result.exitCode !== 0) failedChecks.push(name)
}

function assertPackedManifest(condition: boolean, message: string) {
    if (condition) return
    console.error(`Packed manifest assertion failed: ${message}`)
    failedChecks.push(`packed manifest: ${message}`)
}

// Recover an interrupted earlier prepack before this run takes ownership of a
// new backup. package.tmp.json is the authoritative source manifest; the live
// package.json may already be the stripped, dist-shaped copy.
if (await restorePackageBackup()) {
    console.log("Recovered package.json from an interrupted prepack")
}

const temporaryDir = await mkdtemp(join(tmpdir(), "valdres-package-compat-"))
let ownsPackageBackup = false
try {
    await mkdir(join(temporaryDir, "consumer"), { recursive: true })

    check(
        "prepack",
        ["bun", "run", join(import.meta.dir, "prepack.ts")],
        packageDir,
    )
    ownsPackageBackup = await Bun.file(packageBackupPath).exists()
    if (failedChecks.length > 0) {
        throw new Error("Cannot check a package that failed to prepack")
    }

    const packResult = Bun.spawnSync(
        [
            "npm",
            "pack",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            temporaryDir,
        ],
        {
            cwd: packageDir,
            stdio: ["inherit", "pipe", "inherit"],
        },
    )
    if (packResult.exitCode !== 0) throw new Error("npm pack failed")

    const packOutput = packResult.stdout.toString()
    const tarballPath = join(temporaryDir, JSON.parse(packOutput)[0].filename)

    const manifestResult = Bun.spawnSync(
        ["tar", "-xOf", tarballPath, "package/package.json"],
        { stdio: ["inherit", "pipe", "inherit"] },
    )
    if (manifestResult.exitCode !== 0) {
        throw new Error("Could not read package.json from packed tarball")
    }
    const packedManifest = JSON.parse(manifestResult.stdout.toString())
    const rootExport = packedManifest.exports?.["."]

    for (const [exportPath, exportValue] of Object.entries(
        packedManifest.exports ?? {},
    )) {
        const exp = exportValue as Record<string, unknown>
        assertPackedManifest(
            Object.keys(exp)[0] === "types",
            `export ${exportPath} must put types first`,
        )
        assertPackedManifest(
            typeof exp.import === "string",
            `export ${exportPath} must include import`,
        )
        assertPackedManifest(
            exp.default === exp.import,
            `export ${exportPath} default must match import`,
        )
    }
    assertPackedManifest(
        packedManifest.main === "./dist/index.js",
        "main must be ./dist/index.js",
    )
    assertPackedManifest(
        packedManifest.types === "./dist/types/index.d.ts",
        "types must be ./dist/types/index.d.ts",
    )
    assertPackedManifest(
        rootExport?.default === "./dist/index.js",
        "root default export must be ./dist/index.js",
    )
    assertPackedManifest(
        JSON.stringify(packedManifest.sideEffects) ===
            JSON.stringify(INSTANCE_GUARD_SIDE_EFFECTS),
        'sideEffects must be ["./dist/index.js"]',
    )
    assertPackedManifest(
        packedManifest.engines?.node === NODE_ENGINE_RANGE,
        `engines.node must be ${NODE_ENGINE_RANGE}`,
    )

    // ATTW and publint each pack the dist-shaped package independently. ATTW
    // discovers both exports from package.json: `.` and
    // `./adapter-internals/v1`. The package is intentionally ESM-only, so the
    // matching ATTW invocation ignores only ATTW's pre-require(esm) warning;
    // Node10 resolution remains enforced for both public entrypoints.
    check(
        "attw",
        [
            "bunx",
            "attw",
            ".",
            "--pack",
            "--profile",
            "strict",
            "--ignore-rules",
            "cjs-resolves-to-esm",
        ],
        packageDir,
    )
    check("publint", ["bunx", "publint", "--strict"], packageDir)

    const consumerDir = join(temporaryDir, "consumer")
    await Bun.write(
        join(consumerDir, "package.json"),
        JSON.stringify({ private: true, type: "module" }),
    )
    await Bun.write(
        join(consumerDir, "index.ts"),
        [
            'export { atom } from "valdres"',
            'export { storeAdapter } from "valdres/adapter-internals/v1"',
            "",
        ].join("\n"),
    )
    await Bun.write(
        join(consumerDir, "tsconfig.json"),
        JSON.stringify(
            {
                compilerOptions: {
                    module: "Node16",
                    moduleResolution: "Node16",
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

    check(
        "consumer install",
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
    )
    if (!failedChecks.includes("consumer install")) {
        check(
            'Current Node require("valdres")',
            ["node", "--input-type=commonjs", "--eval", 'require("valdres")'],
            consumerDir,
        )
        check(
            `Node ${MINIMUM_NODE_VERSION} require("valdres")`,
            [
                "npx",
                "--yes",
                `--package=node@${MINIMUM_NODE_VERSION}`,
                "--",
                "node",
                "--input-type=commonjs",
                "--eval",
                'require("valdres")',
            ],
            consumerDir,
        )
        check(
            "Node16 consumer typecheck",
            [join(rootDir, "node_modules", ".bin", "tsc"), "-p", "."],
            consumerDir,
        )
    }
} finally {
    if (ownsPackageBackup) await restorePackageBackup()
    await rm(temporaryDir, { recursive: true, force: true })
}

if (failedChecks.length > 0) {
    console.error(`\nPackage compatibility failed: ${failedChecks.join(", ")}`)
    process.exitCode = 1
} else {
    console.log("\nPackage compatibility passed")
}
