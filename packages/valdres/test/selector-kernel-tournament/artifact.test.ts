import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { describe, expect, test } = await import("bun:test")
    const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = await import(
        "node:fs"
    )
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { extractPackedArtifact, hashTree } = await import(
        "../performance/core-load/artifact.mjs"
    )
    const {
        assertPackedImports,
        assertInstalledArtifact,
        command,
        EVIDENCE_MARKER,
        inspectArtifact,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/artifact.mjs"
    )
    const { fileHash } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )

    // Minimal packaging adversaries, never semantic or performance evidence.
    function fixture(
        source = "export const value = 1",
        mutate = (pkg: any) => {},
    ) {
        const root = mkdtempSync(join(tmpdir(), "tournament-artifact-test-"))
        mkdirSync(join(root, "package/dist"), { recursive: true })
        const pkg = {
            name: "valdres",
            version: "1.0.0-beta.36",
            type: "module",
            exports: {
                ".": "./dist/index.js",
                "./inspect": "./dist/index.js",
                "./equality": "./dist/index.js",
                "./adapter-internals/v1": "./dist/index.js",
            },
        }
        mutate(pkg)
        writeFileSync(join(root, "package/package.json"), JSON.stringify(pkg))
        writeFileSync(join(root, "package/dist/index.js"), source)
        const tarball = join(root, "fixture.tgz")
        command(["tar", "-czf", tarball, "package"], root)
        const artifact = extractPackedArtifact(tarball)
        const metadata = {
            schemaVersion: 3,
            mode: "timed",
            repositoryDirty: false,
            gitSha: "1".repeat(40),
            tarballSha256: fileHash(tarball),
            productionEntrySha256: artifact.entrySha256,
            distTreeSha256: artifact.distTreeSha256,
        }
        artifact.cleanup()
        return {
            tarball,
            metadata,
            cleanup: () => rmSync(root, { recursive: true, force: true }),
        }
    }
    describe("F1 artifact admission", () => {
        test("installed shared-chunk changes fail even when the production entry is unchanged", () => {
            const root = mkdtempSync(
                join(tmpdir(), "tournament-installed-test-"),
            )
            try {
                mkdirSync(join(root, "dist"))
                writeFileSync(
                    join(root, "package.json"),
                    '{"name":"fixture","type":"module"}',
                )
                writeFileSync(
                    join(root, "dist/index.js"),
                    "export { value } from './chunk.js'\n",
                )
                writeFileSync(
                    join(root, "dist/chunk.js"),
                    "export const value = 1\n",
                )
                const metadata = {
                    packageManifestSha256: fileHash(join(root, "package.json")),
                    productionEntrySha256: fileHash(
                        join(root, "dist/index.js"),
                    ),
                    distTreeSha256: hashTree(join(root, "dist")),
                }
                expect(() =>
                    assertInstalledArtifact(root, metadata),
                ).not.toThrow()
                writeFileSync(
                    join(root, "dist/chunk.js"),
                    "export const value = 2\n",
                )
                expect(fileHash(join(root, "dist/index.js"))).toBe(
                    metadata.productionEntrySha256,
                )
                expect(() => assertInstalledArtifact(root, metadata)).toThrow(
                    "ARTIFACT-INSTALL-HASH",
                )
            } finally {
                rmSync(root, { recursive: true, force: true })
            }
        })
        test("computed, external, and source-tree module loading fail closed", () => {
            expect(() =>
                assertPackedImports(
                    "const functionText = Function.prototype.toString",
                    "/synthetic/dist/index.js",
                ),
            ).not.toThrow()
            for (const source of [
                "import('valdres/src')",
                "import(target)",
                "require(target)",
                "export { model } from 'reference-model'",
                'Function("s", "return import(s)")("node:fs")',
                'globalThis.require("node:fs")',
                'const loader = require; loader("node:fs")',
                'globalThis["Function"]("s", "return import(s)")("node:fs")',
                'Function.prototype.toString.constructor("s", "return import(s)")("node:fs")',
                'const g = globalThis; g["Fun" + "ction"]("return import(\"node:fs\")")()',
            ]) {
                expect(() =>
                    assertPackedImports(source, "/synthetic/dist/index.js"),
                ).toThrow("ARTIFACT-SOURCE-IMPORT")
            }
        })
        test("inherited conditions and loaders fail before starting a process", () => {
            const previous = process.env.NODE_OPTIONS
            try {
                process.env.NODE_OPTIONS = "--conditions=development"
                expect(() =>
                    command(["node", "-e", "process.exit(0)"], process.cwd()),
                ).toThrow("ARTIFACT-ENVIRONMENT")
            } finally {
                if (previous === undefined) delete process.env.NODE_OPTIONS
                else process.env.NODE_OPTIONS = previous
            }
        })
        test("admits an intact uninstrumented fixture", () => {
            const f = fixture()
            try {
                inspectArtifact(f.tarball, f.metadata).cleanup()
            } finally {
                f.cleanup()
            }
        })
        test.each([
            "source-import",
            "oracle-import",
            "instrumentation",
            "new-export",
            "gitHead",
            "dist",
            "hash",
            "dirty",
            "counter-mode",
        ])("rejects %s", mutation => {
            const source =
                mutation === "source-import"
                    ? "export {store} from '../src/store.js'"
                    : mutation === "oracle-import"
                      ? "export {oracle} from '../test/v1-model/selector-oracle.js'"
                      : mutation === "instrumentation"
                        ? `globalThis[Symbol.for('${EVIDENCE_MARKER}')] = {}`
                        : "export const value = 1"
            const f = fixture(source, pkg => {
                if (mutation === "new-export")
                    pkg.exports["./kernel"] = "./dist/index.js"
                if (mutation === "gitHead") pkg.gitHead = "2".repeat(40)
            })
            if (mutation === "dist") f.metadata.distTreeSha256 = "0".repeat(64)
            if (mutation === "hash") f.metadata.tarballSha256 = "0".repeat(64)
            if (mutation === "dirty") f.metadata.repositoryDirty = true
            if (mutation === "counter-mode") f.metadata.mode = "counter"
            try {
                expect(() => inspectArtifact(f.tarball, f.metadata)).toThrow(
                    "ARTIFACT-",
                )
            } finally {
                f.cleanup()
            }
        })
    })
}
