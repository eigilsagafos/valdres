#!/usr/bin/env bun

import { spawnSync } from "node:child_process"
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = resolve(HERE, "../../..")
const NPM = process.platform === "win32" ? "npm.cmd" : "npm"

export async function packV1Candidate({
    outputDirectory,
    allowDirtySource = false,
}) {
    if (typeof Bun === "undefined" || typeof Bun.build !== "function") {
        throw new Error("the v1 candidate pack must run with Bun")
    }
    if (typeof outputDirectory !== "string" || outputDirectory.length === 0) {
        throw new Error("outputDirectory must be a non-empty path")
    }
    const gitHead = commandOutput("git", ["rev-parse", "HEAD"], PACKAGE_ROOT)
    if (!/^[a-f0-9]{40}$/.test(gitHead)) {
        throw new Error(`git returned an invalid HEAD: ${gitHead}`)
    }
    const repositoryRoot = realpathSync(
        commandOutput("git", ["rev-parse", "--show-toplevel"], PACKAGE_ROOT),
    )
    const repositoryPackagePath = relative(repositoryRoot, PACKAGE_ROOT)
        .split(sep)
        .join("/")
    if (
        repositoryPackagePath.length === 0 ||
        repositoryPackagePath === ".." ||
        repositoryPackagePath.startsWith("../")
    ) {
        throw new Error("Valdres package root is outside the Git repository")
    }
    const sourceStatus = commandOutput(
        "git",
        ["status", "--porcelain=v1", "--untracked-files=all"],
        PACKAGE_ROOT,
    )
    const repositoryDirty = sourceStatus.length > 0
    if (repositoryDirty && !allowDirtySource) {
        throw new Error(
            "candidate source is dirty; commit it before packing, or use --allow-dirty only for an untimed test artifact",
        )
    }
    const sourceManifest = JSON.parse(
        repositoryDirty
            ? readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")
            : commandOutput(
                  "git",
                  ["show", `${gitHead}:${repositoryPackagePath}/package.json`],
                  repositoryRoot,
              ),
    )
    const baseVersion = /^\d+\.\d+\.\d+/.exec(sourceManifest.version)?.[0]
    if (baseVersion === undefined) {
        throw new Error(
            `cannot derive candidate version from ${String(sourceManifest.version)}`,
        )
    }
    const npmVersion = commandOutput(NPM, ["--version"], PACKAGE_ROOT)

    const version = `${baseVersion}-v1-candidate.${gitHead.slice(0, 12)}`
    const buildMetadata = {
        gitSha: gitHead,
        buildCommand: `bun test/performance/core-load/pack-v1-candidate.mjs --output-dir <output-directory>${repositoryDirty ? " --allow-dirty" : ""}`,
        bundler: `Bun.build ${Bun.version}`,
        minifier: `Bun ${Bun.version} minify`,
        packer: `npm ${npmVersion}`,
        repositoryDirty,
        sourceKind: repositoryDirty
            ? "worktree-explicit-diagnostic"
            : "git-archive-head",
        sourceStatusEntries:
            sourceStatus.length === 0 ? 0 : sourceStatus.split("\n").length,
        flags: [
            "target=node",
            "format=esm",
            "packages=external",
            "minify=true",
            "sourcemap=none",
            "process.env.NODE_ENV=production",
        ],
    }
    const packageManifest = {
        name: "valdres",
        version,
        private: true,
        type: "module",
        exports: { ".": "./dist/index.js" },
        files: ["dist", "build-metadata.json"],
        license: sourceManifest.license,
        repository: sourceManifest.repository,
        gitHead,
    }

    mkdirSync(outputDirectory, { recursive: true })
    const outputRoot = realpathSync(outputDirectory)
    const expectedTarball = join(outputRoot, `valdres-${version}.tgz`)
    const metadataPath = join(
        outputRoot,
        `valdres-${version}.build-metadata.json`,
    )
    for (const path of [expectedTarball, metadataPath]) {
        if (existsSync(path)) {
            throw new Error(`${path}: refusing to overwrite candidate output`)
        }
    }

    const temporaryRoot = mkdtempSync(join(tmpdir(), "valdres-v1-candidate-"))
    try {
        const buildPackageRoot = repositoryDirty
            ? PACKAGE_ROOT
            : extractHeadPackage({
                  gitHead,
                  repositoryRoot,
                  repositoryPackagePath,
                  temporaryRoot,
              })
        const buildEntrypoint = join(buildPackageRoot, "src/v1.ts")
        if (!existsSync(buildEntrypoint)) {
            throw new Error(
                `${buildEntrypoint}: v1 candidate entrypoint is missing from ${repositoryDirty ? "the explicitly dirty worktree" : `HEAD ${gitHead}`}`,
            )
        }
        const temporaryPackage = join(temporaryRoot, "package")
        const dist = join(temporaryPackage, "dist")
        mkdirSync(dist, { recursive: true })

        const build = await Bun.build({
            entrypoints: [buildEntrypoint],
            outdir: dist,
            naming: "index.js",
            target: "node",
            format: "esm",
            packages: "external",
            minify: true,
            sourcemap: "none",
            define: {
                "process.env.NODE_ENV": JSON.stringify("production"),
            },
        })
        if (!build.success) {
            throw new Error(
                `candidate build failed:\n${build.logs.map(String).join("\n")}`,
            )
        }
        const entryPath = join(dist, "index.js")
        if (!existsSync(entryPath)) {
            throw new Error("candidate build did not emit dist/index.js")
        }

        writeFileSync(
            join(temporaryPackage, "package.json"),
            `${JSON.stringify(packageManifest, null, 2)}\n`,
        )
        writeFileSync(
            join(temporaryPackage, "build-metadata.json"),
            `${JSON.stringify(buildMetadata, null, 2)}\n`,
        )

        const packed = spawnSync(
            NPM,
            [
                "pack",
                "--json",
                "--ignore-scripts",
                "--pack-destination",
                outputRoot,
            ],
            {
                cwd: temporaryPackage,
                encoding: "utf8",
                maxBuffer: 16 * 1024 * 1024,
                env: { ...process.env, NODE_ENV: "production" },
            },
        )
        if (packed.error) throw packed.error
        if (packed.status !== 0) {
            throw new Error(`npm pack failed:\n${packed.stderr.trim()}`)
        }
        const npmResult = JSON.parse(packed.stdout)
        if (!Array.isArray(npmResult) || npmResult.length !== 1) {
            throw new Error("npm pack did not report exactly one artifact")
        }
        const tarball = realpathSync(join(outputRoot, npmResult[0].filename))
        if (tarball !== expectedTarball) {
            throw new Error(
                `npm pack emitted ${basename(tarball)}, expected ${basename(expectedTarball)}`,
            )
        }
        writeFileSync(
            metadataPath,
            `${JSON.stringify(buildMetadata, null, 2)}\n`,
        )

        return {
            kind: "valdres-v1-candidate-pack",
            gitHead,
            version,
            tarball,
            buildMetadata: realpathSync(metadataPath),
        }
    } finally {
        rmSync(temporaryRoot, { recursive: true, force: true })
    }
}

function extractHeadPackage({
    gitHead,
    repositoryRoot,
    repositoryPackagePath,
    temporaryRoot,
}) {
    const archivePath = join(temporaryRoot, "source.tar")
    const sourceRoot = join(temporaryRoot, "source")
    mkdirSync(sourceRoot)
    runCommand(
        "git",
        [
            "archive",
            "--format=tar",
            `--output=${archivePath}`,
            gitHead,
            `${repositoryPackagePath}/src`,
            `${repositoryPackagePath}/package.json`,
        ],
        repositoryRoot,
        "snapshot candidate source from HEAD",
    )
    runCommand(
        "tar",
        ["-xf", archivePath, "-C", sourceRoot],
        repositoryRoot,
        "extract candidate source snapshot",
    )
    return join(sourceRoot, ...repositoryPackagePath.split("/"))
}

function commandOutput(command, args, cwd) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(" ")} failed: ${result.stderr.trim()}`,
        )
    }
    return result.stdout.trim()
}

function runCommand(command, args, cwd, description) {
    const result = spawnSync(command, args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0) {
        throw new Error(`${description} failed: ${result.stderr.trim()}`)
    }
}

function parseArguments(args) {
    let outputDirectory
    let allowDirtySource = false
    for (let index = 0; index < args.length; index++) {
        const flag = args[index]
        if (flag === "--allow-dirty") {
            if (allowDirtySource) throw new Error("duplicate --allow-dirty")
            allowDirtySource = true
            continue
        }
        if (flag !== "--output-dir" || outputDirectory !== undefined) {
            throw new Error(`unexpected argument ${String(flag)}`)
        }
        const value = args[++index]
        if (value === undefined || value.startsWith("--")) {
            throw new Error("--output-dir requires a directory")
        }
        outputDirectory = resolve(value)
    }
    if (outputDirectory === undefined) {
        throw new Error(
            "usage: bun pack-v1-candidate.mjs --output-dir <directory> [--allow-dirty]",
        )
    }
    return { outputDirectory, allowDirtySource }
}

if (import.meta.main) {
    try {
        const result = await packV1Candidate(
            parseArguments(process.argv.slice(2)),
        )
        process.stdout.write(`${JSON.stringify(result)}\n`)
    } catch (error) {
        const message =
            error instanceof Error
                ? (error.stack ?? error.message)
                : String(error)
        process.stderr.write(`${message}\n`)
        process.exitCode = 1
    }
}
