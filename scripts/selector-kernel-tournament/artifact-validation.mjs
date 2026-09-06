import { recordedRoot } from "./recorded-root.mjs"
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import {
    ROOT,
    manifest,
    json,
    fileHash,
    sha256,
    git,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import { inspectArtifact, command, counterBuildSource } from "./artifact.mjs"
import { evidencePath, strictKeys, same } from "./evidence.mjs"
import { validateProcess } from "./process-evidence.mjs"
const keys = [
    "schemaVersion",
    "counterAdapterPath",
    "mode",
    "gitSha",
    "runtimeTree",
    "repositoryDirty",
    "buildCommand",
    "counterAdapterSha256",
    "counterObserverSha256",
    "counterBuildCommand",
    "bundler",
    "minifier",
    "flags",
    "exportConditions",
    "packageManifestSha256",
    "lockfileSha256",
    "tarballSha256",
    "productionEntrySha256",
    "distTreeSha256",
    "sourceArchiveSha256",
    "buildScriptSha256",
    "startedAt",
    "endedAt",
    "tarball",
]
export const artifactIdentity = a =>
    Object.fromEntries(
        [
            "gitSha",
            "runtimeTree",
            "tarballSha256",
            "productionEntrySha256",
            "distTreeSha256",
        ].map(k => [k, a[k]]),
    )
export function validateArtifactEvidence(root, path, { gitSha, mode }) {
    const metadata = json(evidencePath(root, path))
    strictKeys(metadata, keys, "PROVENANCE-BUILD-METADATA")
    requireGate(
        metadata.schemaVersion === 3 &&
            metadata.gitSha === gitSha &&
            metadata.mode === mode &&
            !metadata.repositoryDirty,
        "PROVENANCE-BUILD-METADATA",
        "wrong revision or build mode",
    )
    requireGate(
        metadata.runtimeTree ===
            git(["rev-parse", `${gitSha}:packages/valdres/src`]),
        "PROVENANCE-RUNTIME-TREE",
        "runtime tree differs",
    )
    requireGate(
        metadata.bundler === `Bun ${Bun.version}` &&
            metadata.minifier === `Bun ${Bun.version} minify`,
        "PROVENANCE-BUILD-VERSION",
        "Bun version differs",
    )
    same(
        metadata.flags,
        [
            "splitting=true",
            "packages=external",
            "minify=true",
            "sourcemap=none",
            "NODE_ENV=production",
        ],
        "PROVENANCE-BUILD-METADATA",
        "build flags differ",
    )
    same(
        metadata.exportConditions,
        ["import", "default"],
        "PROVENANCE-BUILD-METADATA",
        "active export conditions differ",
    )
    requireGate(
        metadata.buildCommand ===
            `bun run build:types && ${mode === "timed" ? "bun run build" : "bun counter-build.mjs"} && bun ../../scripts/prepack.ts && npm pack --ignore-scripts --json`,
        "PROVENANCE-BUILD-METADATA",
        "build command differs",
    )
    requireGate(
        metadata.counterBuildCommand ===
            (mode === "counter" ? "bun counter-build.mjs" : null),
        "PROVENANCE-BUILD-METADATA",
        "counter command differs",
    )
    const directory = dirname(path),
        tarball = evidencePath(root, join(directory, metadata.tarball)),
        archive = evidencePath(root, join(directory, "source.tar"))
    requireGate(
        fileHash(archive) === metadata.sourceArchiveSha256,
        "PROVENANCE-SOURCE-ARCHIVE",
        "archive hash differs",
    )
    const temporary = mkdtempSync(
        join(tmpdir(), "tournament-source-validation-"),
    )
    try {
        const expected = join(temporary, "source.tar")
        command(
            ["git", "archive", "--format=tar", "--output", expected, gitSha],
            ROOT,
        )
        requireGate(
            fileHash(expected) === metadata.sourceArchiveSha256,
            "PROVENANCE-SOURCE-ARCHIVE",
            "archive does not match commit",
        )
    } finally {
        rmSync(temporary, { recursive: true, force: true })
    }
    for (const [key, file] of [
        ["buildScriptSha256", "packages/valdres/build.ts"],
        ["lockfileSha256", "bun.lock"],
    ])
        requireGate(
            metadata[key] ===
                sha256(
                    execFileSync("git", ["show", `${gitSha}:${file}`], {
                        cwd: ROOT,
                    }),
                ),
            "PROVENANCE-BUILD-METADATA",
            file,
        )
    const inspected = inspectArtifact(tarball, metadata, mode)
    try {
        requireGate(
            fileHash(inspected.packageJsonPath) ===
                metadata.packageManifestSha256,
            "PROVENANCE-BUILD-METADATA",
            "packed manifest hash differs",
        )
        const pkg = json(inspected.packageJsonPath)
        for (const [key, base] of [
            [".", "index"],
            ["./adapter-internals/v1", "adapter-internals/v1"],
            ["./equality", "equality"],
            ["./inspect", "inspect"],
        ])
            same(
                pkg.exports[key],
                {
                    types: `./dist/types/${base}.d.ts`,
                    development: `./dist/development/${base}.js`,
                    import: `./dist/${base}.js`,
                    default: `./dist/${base}.js`,
                },
                "ARTIFACT-EXPORTS",
                "export conditions changed",
            )
    } finally {
        inspected.cleanup()
    }
    const processes = readdirSync(evidencePath(root, directory))
        .filter(p => /^build-.*\.process\.json$/.test(p))
        .map(p => json(evidencePath(root, join(directory, p))))
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    requireGate(
        processes.length === 4,
        "PROVENANCE-BUILD-PROCESS",
        "missing build command",
    )
    for (const process of processes) validateProcess(process)
    same(
        processes[0].argv,
        ["bun", "run", "build:types"],
        "PROVENANCE-BUILD-PROCESS",
        "types command",
    )
    if (mode === "timed") {
        same(
            processes[1].argv,
            ["bun", "run", "build"],
            "PROVENANCE-BUILD-PROCESS",
            "shipping build",
        )
        requireGate(
            metadata.counterAdapterPath === null &&
                metadata.counterAdapterSha256 === null &&
                metadata.counterObserverSha256 === null,
            "ARTIFACT-INSTRUMENTATION",
            "timed observer metadata",
        )
    } else {
        same(
            processes[1].argv,
            ["bun", join(root, directory, "counter-build.mjs")],
            "PROVENANCE-BUILD-PROCESS",
            "counter build",
        )
        requireGate(
            /^[a-f0-9]{64}$/.test(metadata.counterAdapterSha256),
            "PROVENANCE-ADAPTER-HASH",
            "missing adapter",
        )
        const isControl = metadata.runtimeTree === manifest.control.runtimeTree
        requireGate(
            typeof metadata.counterAdapterPath === "string" &&
                !metadata.counterAdapterPath.startsWith("/") &&
                !metadata.counterAdapterPath
                    .split("/")
                    .some(p => p === ".." || p === "." || p === "") &&
                !/[\\\r\n\0]/.test(metadata.counterAdapterPath),
            "PROVENANCE-ADAPTER-HASH",
            "canonical archived adapter path required",
        )
        if (isControl)
            requireGate(
                metadata.counterAdapterPath ===
                    "scripts/selector-kernel-tournament/control-instrumentation.mjs",
                "PROVENANCE-ADAPTER-HASH",
                "control adapter path differs",
            )
        else {
            requireGate(
                /^100(?:644|755) blob /.test(
                    git(["ls-tree", gitSha, "--", metadata.counterAdapterPath]),
                ),
                "PROVENANCE-ADAPTER-HASH",
                "adapter must be an archived regular file",
            )
            requireGate(
                sha256(
                    execFileSync(
                        "git",
                        ["show", `${gitSha}:${metadata.counterAdapterPath}`],
                        { cwd: ROOT },
                    ),
                ) === metadata.counterAdapterSha256 &&
                    metadata.counterObserverSha256 === null,
                "PROVENANCE-ADAPTER-HASH",
                "candidate adapter differs from source archive",
            )
        }
        const adapterPath = isControl
            ? join(recordedRoot(), metadata.counterAdapterPath)
            : resolve(processes[1].cwd, "../..", metadata.counterAdapterPath)
        same(
            readFileSync(
                evidencePath(root, join(directory, "counter-build.mjs")),
                "utf8",
            ),
            counterBuildSource(processes[1].cwd, adapterPath, isControl),
            "PROVENANCE-COUNTER-BUILDER",
            "builder differs from frozen options and archived adapter",
        )
        if (isControl)
            requireGate(
                metadata.counterAdapterSha256 ===
                    fileHash(
                        join(
                            ROOT,
                            "scripts/selector-kernel-tournament/control-instrumentation.mjs",
                        ),
                    ) &&
                    metadata.counterObserverSha256 ===
                        fileHash(
                            join(
                                ROOT,
                                "scripts/selector-kernel-tournament/control-observer-runtime.mjs",
                            ),
                        ),
                "PROVENANCE-ADAPTER-HASH",
                "control observer changed",
            )
    }
    same(
        processes[2].argv,
        ["bun", join(processes[2].cwd, "../../scripts/prepack.ts")],
        "PROVENANCE-BUILD-PROCESS",
        "prepack command",
    )
    same(
        processes[3].argv,
        [
            "npm",
            "pack",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            join(root, directory),
        ],
        "PROVENANCE-BUILD-PROCESS",
        "pack command",
    )
    requireGate(
        processes.every(p => p.cwd === processes[0].cwd) &&
            Date.parse(metadata.startedAt) <=
                Date.parse(processes[0].startedAt) &&
            Date.parse(metadata.endedAt) >=
                Date.parse(processes.at(-1).endedAt),
        "PROVENANCE-BUILD-PROCESS",
        "build timeline",
    )
    return metadata
}
