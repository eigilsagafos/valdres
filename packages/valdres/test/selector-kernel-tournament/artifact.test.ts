import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { extractPackedArtifact } from "../performance/core-load/artifact.mjs"
import {
    assertPackedImports,
    command,
    EVIDENCE_MARKER,
    inspectArtifact,
} from "../../../../scripts/selector-kernel-tournament/artifact.mjs"
import { fileHash } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"

// Minimal packaging adversaries, never semantic or performance evidence.
function fixture(source = "export const value = 1", mutate = (pkg: any) => {}) {
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
    test("computed, external, and source-tree module loading fail closed", () => {
        for (const source of [
            "import('valdres/src')",
            "import(target)",
            "require(target)",
            "export { model } from 'reference-model'",
            'Function("s", "return import(s)")("node:fs")',
            'globalThis.require("node:fs")',
            'const loader = require; loader("node:fs")',
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
