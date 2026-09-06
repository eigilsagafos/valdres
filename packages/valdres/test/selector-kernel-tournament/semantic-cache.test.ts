import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const {
        mkdtempSync,
        rmSync,
        cpSync,
        linkSync,
        readFileSync,
        writeFileSync,
    } = await import("node:fs")
    const { join } = await import("node:path")
    const { tmpdir } = await import("node:os")
    const { semanticCacheFixture } = await import(
        "./semantic-cache-fixture.mjs"
    )
    const { validateSemanticEvidence } = await import(
        "../../../../scripts/selector-kernel-tournament/semantic-validation.mjs"
    )
    const { withRecordedRoot } = await import(
        "../../../../scripts/selector-kernel-tournament/recorded-root.mjs"
    )

    test("semantic cache reuse revalidates artifact, mode, absolute paths, invocation and referenced bytes", () => {
        const root = mkdtempSync(join(tmpdir(), "tournament-semantic-cache-"))
        const relocated = mkdtempSync(
            join(tmpdir(), "tournament-semantic-relocated-"),
        )
        try {
            const fixture = semanticCacheFixture(root)
            const cache = new Map()
            const run = (
                identity = fixture.identity,
                mode = "public",
                at = root,
            ) =>
                validateSemanticEvidence(
                    at,
                    fixture.relative,
                    identity,
                    mode,
                    cache,
                )
            const first = run()
            expect(first).toHaveLength(4)
            expect(run()).toBe(first)
            const outcomes = []
            const probe = (id, gate, body) => {
                try {
                    body()
                    outcomes.push({ id, gate: "accepted" })
                } catch (error) {
                    outcomes.push({
                        id,
                        gate: String(error.message).split(":")[0],
                    })
                }
                return { id, gate }
            }
            const expected = []
            for (const field of [
                "gitSha",
                "tarballSha256",
                "packageManifestSha256",
                "productionEntrySha256",
                "distTreeSha256",
            ]) {
                expected.push(
                    probe(
                        field,
                        ["gitSha", "tarballSha256"].includes(field)
                            ? "SEMANTIC-EVIDENCE-IDENTITY"
                            : "ARTIFACT-INSTALL-HASH",
                        () =>
                            run({
                                ...fixture.identity,
                                [field]: "f".repeat(
                                    field === "gitSha" ? 40 : 64,
                                ),
                            }),
                    ),
                )
            }
            expected.push(
                probe("mode", "SEMANTIC-EVIDENCE-IDENTITY", () =>
                    run(fixture.identity, "counter"),
                ),
            )
            expected.push(
                probe("recorded-root", "PROVENANCE-INVOCATION", () =>
                    withRecordedRoot(relocated, () => run()),
                ),
            )
            cpSync(join(root, "semantic"), join(relocated, "semantic"), {
                recursive: true,
                filter: path => !path.endsWith(".ndjson"),
            })
            for (const runtime of ["bun", "node"])
                for (const repeat of [0, 1])
                    linkSync(
                        fixture.raw,
                        join(
                            relocated,
                            "semantic",
                            `${runtime}-${repeat}.ndjson`,
                        ),
                    )
            expected.push(
                probe("evidence-root", "PROVENANCE-INVOCATION", () =>
                    run(fixture.identity, "public", relocated),
                ),
            )
            for (const [id, path, gate] of [
                ["process-bytes", fixture.process, "PROVENANCE-INVOCATION"],
                ["process-cwd", fixture.process, "PROVENANCE-INVOCATION"],
                [
                    "installed-bytes",
                    fixture.installedEntry,
                    "ARTIFACT-INSTALL-HASH",
                ],
                ["worker-bytes", fixture.worker, "PROVENANCE-WORKER-HASH"],
                ["raw-bytes", fixture.raw, "SEMANTIC-RAW-HASH"],
            ]) {
                const before = readFileSync(path)
                try {
                    if (id === "process-bytes" || id === "process-cwd") {
                        const process = JSON.parse(before.toString())
                        if (id === "process-bytes")
                            process.argv[1] += ".substituted"
                        else process.cwd = relocated
                        writeFileSync(path, JSON.stringify(process))
                    } else
                        writeFileSync(
                            path,
                            Buffer.concat([before, Buffer.from("\n ")]),
                        )
                    expected.push(probe(id, gate, () => run()))
                } finally {
                    writeFileSync(path, before)
                }
            }
            const evidencePath = join(root, fixture.relative)
            const before = readFileSync(evidencePath)
            for (const field of [
                "unknownAuthorityField",
                "productionEntrySha256",
            ]) {
                try {
                    const evidence = JSON.parse(before.toString())
                    evidence.artifact[field] = "f".repeat(64)
                    writeFileSync(evidencePath, JSON.stringify(evidence))
                    expected.push(
                        probe(
                            "embedded-" + field,
                            "SEMANTIC-EVIDENCE-IDENTITY",
                            () => run(),
                        ),
                    )
                } finally {
                    writeFileSync(evidencePath, before)
                }
            }
            expect(outcomes).toEqual(expected)
            expect(run()).toBe(first)
        } finally {
            rmSync(root, { recursive: true, force: true })
            rmSync(relocated, { recursive: true, force: true })
        }
    }, 60000)
}
