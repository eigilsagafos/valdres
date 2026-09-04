import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    realpathSync,
    symlinkSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import {
    extractPackedArtifact,
    hashTree,
} from "../../packages/valdres/test/performance/core-load/artifact.mjs"
import {
    ROOT,
    assertClean,
    assertControl,
    checkInputs,
    fileHash,
    git,
    json,
    manifest,
    requireGate,
    sha256,
} from "./inputs.mjs"

export const EVIDENCE_MARKER = "VALDRES_TOURNAMENT_COUNTER_ARTIFACT_V1"
export function command(argv, cwd, options = {}) {
    const result = spawnSync(argv[0], argv.slice(1), {
        cwd,
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NODE_ENV: "production" },
        ...options,
    })
    requireGate(
        !result.error && result.status === 0,
        "ARTIFACT-COMMAND",
        `${JSON.stringify(argv)}: ${result.error?.message ?? result.stderr ?? result.stdout}`,
    )
    return result.stdout
}
export function inspectArtifact(tarball, metadata, mode = "timed") {
    requireGate(["timed", "counter"].includes(mode), "ARTIFACT-MODE", mode)
    requireGate(
        metadata.mode === mode && metadata.repositoryDirty === false,
        "ARTIFACT-MODE",
        "mode or clean status mismatch",
    )
    requireGate(
        fileHash(tarball) === metadata.tarballSha256,
        "ARTIFACT-HASH",
        tarball,
    )
    const artifact = extractPackedArtifact(tarball)
    try {
        const pkg = json(artifact.packageJsonPath)
        requireGate(
            JSON.stringify(Object.keys(pkg.exports).sort()) ===
                JSON.stringify(
                    [
                        ".",
                        "./adapter-internals/v1",
                        "./equality",
                        "./inspect",
                    ].sort(),
                ),
            "ARTIFACT-EXPORTS",
            "export map changed",
        )
        requireGate(
            !pkg.gitHead || pkg.gitHead === metadata.gitSha,
            "ARTIFACT-GITHEAD",
            "packed gitHead differs",
        )
        requireGate(
            artifact.entrySha256 === metadata.productionEntrySha256 &&
                artifact.distTreeSha256 === metadata.distTreeSha256,
            "ARTIFACT-DIST-HASH",
            "dist identity mismatch",
        )
        let hasMarker = false
        for (const path of readdirSync(join(artifact.packageRoot, "dist"), {
            recursive: true,
        }).filter(path => path.endsWith(".js"))) {
            const source = readFileSync(
                join(artifact.packageRoot, "dist", path),
                "utf8",
            )
            requireGate(
                !/(?:from|import\s*\()\s*["'][^"']*(?:\/src\/|v1-model|selector-oracle|test\/)/.test(
                    source,
                ),
                "ARTIFACT-SOURCE-IMPORT",
                path,
            )
            hasMarker ||= source.includes(EVIDENCE_MARKER)
        }
        requireGate(
            hasMarker === (mode === "counter"),
            "ARTIFACT-INSTRUMENTATION",
            "counter build must never be timed",
        )
        return artifact
    } catch (error) {
        artifact.cleanup()
        throw error
    }
}

// Uses the shipping build and prepack scripts from the selected immutable
// commit. The archive is an isolated build directory, not a candidate branch.
export async function packArtifact({ commit, output, mode = "timed" }) {
    assertClean()
    checkInputs()
    requireGate(
        /^[a-f0-9]{40}$/.test(commit),
        "ARTIFACT-COMMIT",
        "full commit SHA required",
    )
    requireGate(["timed", "counter"].includes(mode), "ARTIFACT-MODE", mode)
    requireGate(!existsSync(output), "ARTIFACT-IMMUTABLE", output)
    requireGate(
        git(["rev-parse", `${commit}^{commit}`]) === commit,
        "ARTIFACT-COMMIT",
        commit,
    )
    const runtimeTree = git(["rev-parse", `${commit}:packages/valdres/src`])
    if (commit === manifest.control.gitSha) assertControl(runtimeTree)
    mkdirSync(output, { recursive: true })
    const build = mkdtempSync(join(tmpdir(), "valdres-tournament-build-"))
    const archive = join(output, "source.tar")
    command(
        ["git", "archive", "--format=tar", "--output", archive, commit],
        ROOT,
    )
    command(["tar", "-xf", archive, "-C", build], ROOT)
    symlinkSync(join(ROOT, "node_modules"), join(build, "node_modules"), "dir")
    const pkg = join(build, "packages/valdres")
    const run = argv => {
        const result = command(argv, pkg)
        writeFileSync(
            join(output, `build-${fileHashString(argv).slice(0, 12)}.log`),
            result,
        )
        return result
    }
    const startedAt = new Date().toISOString()
    run(["bun", "run", "build:types"])
    if (mode === "timed") run(["bun", "run", "build"])
    else {
        // The marker is attached at build time only, with no source edits or
        // public exports. F2's control evidence adapter uses this separate build.
        const builder = join(output, "counter-build.mjs")
        writeFileSync(
            builder,
            `import { readFileSync } from 'node:fs';\nimport { buildOptions, developmentBuildOptions } from ${JSON.stringify(join(pkg, "build.ts"))};\nfor (const options of [buildOptions, developmentBuildOptions]) {\n const result = await Bun.build({ ...options, plugins: [{ name: 'tournament-counter', setup(build) { build.onLoad({ filter: /public-domain\\.ts$/ }, args => ({ contents: readFileSync(args.path, 'utf8') + '\\nglobalThis[Symbol.for(${JSON.stringify(EVIDENCE_MARKER)})] = {mode: \\"counter\\"};', loader: 'ts' })); } }] });\n if (!result.success) throw new Error(result.logs.join('\\n'));\n}\n`,
        )
        run(["bun", builder])
    }
    run(["bun", join(build, "scripts/prepack.ts")])
    const [{ filename }] = JSON.parse(
        run([
            "npm",
            "pack",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            output,
        ]),
    )
    const tarball = join(output, filename)
    const inspected = extractPackedArtifact(tarball)
    const metadata = {
        mode,
        gitSha: commit,
        runtimeTree,
        repositoryDirty: false,
        buildCommand:
            "bun run build:types && bun run build && bun ../../scripts/prepack.ts && npm pack --ignore-scripts --json",
        counterBuildCommand:
            mode === "counter" ? "bun counter-build.mjs" : null,
        bundler: `Bun ${Bun.version}`,
        minifier: `Bun ${Bun.version} minify`,
        flags: [
            "splitting=true",
            "packages=external",
            "minify=true",
            "sourcemap=none",
            "NODE_ENV=production",
        ],
        exportConditions: ["import", "default"],
        packageManifestSha256: fileHash(join(pkg, "package.json")),
        lockfileSha256: fileHash(join(build, "bun.lock")),
        tarballSha256: fileHash(tarball),
        productionEntrySha256: inspected.entrySha256,
        distTreeSha256: inspected.distTreeSha256,
        sourceArchiveSha256: fileHash(archive),
        buildScriptSha256: fileHash(join(pkg, "build.ts")),
        startedAt,
        endedAt: new Date().toISOString(),
    }
    inspected.cleanup()
    writeFileSync(
        join(output, "artifact.json"),
        JSON.stringify({ ...metadata, tarball: filename }, null, 2) + "\n",
    )
    const verified = inspectArtifact(tarball, metadata, mode)
    verified.cleanup()
    return { ...metadata, tarball }
}
const fileHashString = value => sha256(JSON.stringify(value))

export function installArtifact(tarball, metadata, output, mode = "timed") {
    const verified = inspectArtifact(tarball, metadata, mode)
    verified.cleanup()
    requireGate(!existsSync(output), "ARTIFACT-IMMUTABLE", output)
    mkdirSync(output, { recursive: true })
    writeFileSync(
        join(output, "package.json"),
        JSON.stringify({
            name: "tournament-consumer",
            private: true,
            type: "module",
        }),
    )
    command(
        [
            "npm",
            "install",
            "--ignore-scripts",
            "--no-package-lock",
            "--no-audit",
            "--no-fund",
            tarball,
        ],
        output,
    )
    const installed = join(output, "node_modules/valdres")
    requireGate(
        hashTree(join(installed, "dist")) === metadata.distTreeSha256,
        "ARTIFACT-INSTALL-HASH",
        installed,
    )
    return output
}
export function smokeArtifact(artifactDirectory, runtime) {
    const metadata = json(join(artifactDirectory, "artifact.json"))
    const target = join(artifactDirectory, `consumer-${runtime}`)
    installArtifact(
        join(artifactDirectory, metadata.tarball),
        metadata,
        target,
        metadata.mode,
    )
    cpSync(
        join(ROOT, "scripts/selector-kernel-tournament/packed-smoke.mjs"),
        join(target, "smoke.mjs"),
    )
    const output = command([runtime, "smoke.mjs"], target)
    writeFileSync(join(artifactDirectory, `smoke-${runtime}.json`), output)
    return JSON.parse(output)
}
if (import.meta.main) {
    const [action, arg, output, mode] = process.argv.slice(2)
    if (action === "pack")
        console.log(
            JSON.stringify(
                await packArtifact({
                    commit: arg,
                    output: resolve(output),
                    mode: mode ?? "timed",
                }),
            ),
        )
    else if (action === "smoke")
        for (const runtime of ["node", "bun"])
            console.log(JSON.stringify(smokeArtifact(resolve(arg), runtime)))
    else
        throw new Error(
            "usage: artifact.mjs pack <commit> <output> [timed|counter] | smoke <artifact-directory>",
        )
}
