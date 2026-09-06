import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { mkdtempSync, rmSync, writeFileSync, readFileSync } = await import(
        "node:fs"
    )
    const { join } = await import("node:path")
    const { tmpdir } = await import("node:os")
    const { execFileSync } = await import("node:child_process")
    const {
        ROOT,
        manifest,
        gitBlob,
        frozenInputBytes,
        frozenInputJson,
        controlSourceBytes,
        sha256,
        checkInputs,
        verifyProtected,
        authenticateAuthorityFiles,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
    const { normalizeSizes } = await import(
        "../../../../scripts/selector-kernel-tournament/resource-evidence.mjs"
    )
    const { instrumentControl } = await import(
        "../../../../scripts/selector-kernel-tournament/control-instrumentation.mjs"
    )
    const { writeEvidence } = await import(
        "../../../../scripts/selector-kernel-tournament/evidence.mjs"
    )

    test("historical bytes survive divergent size/StoreTree files; substituted blobs, hashes and candidate paths fail", () => {
        const temporary = mkdtempSync(
                join(tmpdir(), "tournament-authority-test-"),
            ),
            root = join(temporary, "repo")
        const git = (...args: string[]) =>
            execFileSync("git", args, {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            }).trim()
        try {
            execFileSync("git", ["clone", "-q", "--shared", ROOT, root], {
                stdio: "pipe",
            })
            const frozen = git("rev-parse", "HEAD"),
                baseline = manifest.stages.size.baselineFile
            const store =
                "packages/valdres/src/v1-internal/committed-store-tree/committed-store-tree.ts"
            const authority = frozenInputJson(baseline, { root })
            expect(normalizeSizes(authority).dist.raw).toBeGreaterThan(0)
            const original = controlSourceBytes(store, root).toString("utf8")
            writeFileSync(join(root, baseline), '{"movingMain":true}\n')
            writeFileSync(
                join(root, store),
                "// incompatible moving-main StoreTree\n",
            )
            expect(() =>
                normalizeSizes(
                    JSON.parse(readFileSync(join(root, baseline), "utf8")),
                ),
            ).toThrow("SIZE-METRICS")
            expect(() =>
                instrumentControl(
                    readFileSync(join(root, store), "utf8"),
                    store,
                ),
            ).toThrow("CONTROL-ADAPTER-ANCHOR")
            expect(() => checkInputs(root, manifest, frozen)).not.toThrow()
            expect(frozenInputJson(baseline, { root })).toEqual(authority)
            expect(controlSourceBytes(store, root).toString("utf8")).toBe(
                original,
            )
            expect(instrumentControl(original, store)).toContain(
                "tournamentObserver",
            )
            expect(() => verifyProtected(root, frozen)).toThrow(
                "PROVENANCE-PROTECTED-PATH",
            )
            const badHash = structuredClone(manifest)
            badHash.frozenInputs.find(row => row.path === baseline)!.sha256 =
                "0".repeat(64)
            expect(() =>
                frozenInputBytes(baseline, { root, input: badHash }),
            ).toThrow("INPUT-FROZEN-HASH")
            git(
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.invalid",
                "commit",
                "-qam",
                "divergent fixture",
            )
            const badBlob = structuredClone(manifest)
            badBlob.control.gitSha = git("rev-parse", "HEAD")
            expect(() =>
                frozenInputBytes(baseline, { root, input: badBlob }),
            ).toThrow("INPUT-FROZEN-HASH")
            for (const path of [
                manifest.spec.path,
                "packages/valdres/test/selector-kernel-tournament/fixture-manifest.v3.json",
            ]) {
                const bytes = readFileSync(join(root, path))
                writeFileSync(
                    join(root, path),
                    Buffer.concat([bytes, Buffer.from("\n")]),
                )
                expect(() => authenticateAuthorityFiles(root, frozen)).toThrow(
                    "INPUT-FOUNDATION-HASH",
                )
                writeFileSync(join(root, path), bytes)
            }
            for (const row of manifest.frozenInputs) {
                const bytes = frozenInputBytes(row.path, { root })
                expect(sha256(bytes)).toBe(row.sha256)
                expect(
                    bytes.equals(
                        gitBlob(manifest.control.gitSha, row.path, root),
                    ),
                ).toBe(true)
            }
            const bytes = Buffer.from([0, 255, 10, 13, 10])
            const ref = writeEvidence(
                join(temporary, "evidence"),
                "bytes.bin",
                bytes,
            )
            expect(ref.sha256).toBe(sha256(bytes))
            expect(
                readFileSync(join(temporary, "evidence/bytes.bin")).equals(
                    bytes,
                ),
            ).toBe(true)
        } finally {
            rmSync(temporary, { recursive: true, force: true })
        }
    })
}
