import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { manifest } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
    const { sourceMemoryRows, assertSourceMemory } = await import(
        "../../../../scripts/selector-kernel-tournament/source-memory.mjs"
    )
    function sample() {
        return {
            stdout: manifest.sourceMemoryScenarios
                .map(s =>
                    JSON.stringify({
                        scenario: s.name,
                        runtime: "node",
                        units: s.units,
                        retainedBytes: s.units * 80,
                        retainedBytesPerUnit: 80,
                        releasedBytes: 1000,
                    }),
                )
                .join("\n"),
            stderr: "",
        }
    }
    test("source absolute evidence preserves all eight original ceilings and unrounded arithmetic", () => {
        expect(
            sourceMemoryRows(sample(), "node", "candidate", "raw.json"),
        ).toHaveLength(8)
        for (const dimension of ["retainedBytes", "releasedBytes"]) {
            const process = sample(),
                rows = process.stdout.split("\n").map(line => JSON.parse(line))
            rows[0][dimension] =
                dimension === "retainedBytes" ? rows[0].units * 120 + 1 : 262145
            rows[0].retainedBytesPerUnit = Math.round(
                rows[0].retainedBytes / rows[0].units,
            )
            process.stdout = rows.map(row => JSON.stringify(row)).join("\n")
            expect(() =>
                assertSourceMemory(process, "node", "candidate", "raw.json"),
            ).toThrow("MEMORY-ABSOLUTE: source-absolute")
        }
    })
    test("missing, duplicate, unknown, or altered source measurements cannot satisfy the absolute gate", () => {
        for (const mutation of [
            "missing",
            "duplicate",
            "unknown",
            "units",
            "extra",
            "rounding",
        ]) {
            const process = sample(),
                rows = process.stdout.split("\n").map(line => JSON.parse(line))
            if (mutation === "missing") rows.pop()
            if (mutation === "duplicate") rows.push(rows[0])
            if (mutation === "unknown") rows[0].scenario = "M-GLOBAL-FANOUT"
            if (mutation === "units") rows[0].units++
            if (mutation === "extra") rows[0].extra = true
            if (mutation === "rounding") rows[0].retainedBytesPerUnit++
            process.stdout = rows.map(row => JSON.stringify(row)).join("\n")
            expect(() =>
                sourceMemoryRows(process, "node", "candidate", "raw.json"),
            ).toThrow("SOURCE-MEMORY-")
        }
    })

    test("Vitest ANSI decoration does not discard original source measurements", () => {
        const process = sample()
        process.stdout = process.stdout
            .split("\n")
            .map(line => "\x1b[22m\x1b[39m" + line)
            .join("\n")
        expect(
            sourceMemoryRows(process, "node", "control", "raw.json"),
        ).toHaveLength(8)
    })

    test("source memory binds each process cwd to its authenticated archive materialization", async () => {
        const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = await import(
            "node:fs"
        )
        const { join } = await import("node:path")
        const { tmpdir } = await import("node:os")
        const { ROOT, fileHash, frozenInputBytes, sha256 } = await import(
            "../../../../scripts/selector-kernel-tournament/inputs.mjs"
        )
        const { command } = await import(
            "../../../../scripts/selector-kernel-tournament/artifact.mjs"
        )
        const {
            materializeSource,
            validateSourceMemory,
            sourceMemoryWorkingDirectory,
            sourceMemoryCommand,
            SOURCE_HARNESS,
        } = await import(
            "../../../../scripts/selector-kernel-tournament/source-memory.mjs"
        )
        const root = mkdtempSync(join(tmpdir(), "tournament-source-context-"))
        try {
            // Real authenticated archive; synthetic measurement records test
            // provenance only and never become memory/tournament evidence.
            const directory = join(root, "artifacts/control")
            mkdirSync(directory, { recursive: true })
            const archive = join(directory, "source.tar")
            command(
                [
                    "git",
                    "archive",
                    "--format=tar",
                    "--output",
                    archive,
                    manifest.control.gitSha,
                ],
                ROOT,
            )
            const source = materializeSource(archive, manifest.control.gitSha)
            const snapshot = source.snapshot
            rmSync(source.directory, { recursive: true, force: true })
            const identity = {
                gitSha: manifest.control.gitSha,
                sourceArchiveSha256: fileHash(archive),
            }
            const artifacts = Object.fromEntries(
                ["control", "candidate"].map(arm => [arm, { timed: identity }]),
            )
            const index = {
                artifacts: Object.fromEntries(
                    ["control", "candidate"].map(arm => [
                        arm,
                        { timed: "artifacts/control/artifact.json" },
                    ]),
                ),
            }
            const value = {
                schemaVersion: 3,
                domain: "source-absolute",
                processes: [],
                rows: [],
            }
            const records = []
            for (const arm of ["control", "candidate"])
                for (const runtime of ["bun", "node"]) {
                    const offset = records.length
                    const process = {
                        argv: sourceMemoryCommand(runtime),
                        cwd: sourceMemoryWorkingDirectory(root, arm),
                        environment: {
                            NODE_ENV: "production",
                            FORCE_COLOR: "0",
                        },
                        pid: offset + 1,
                        startedAt: `2026-09-05T00:00:0${offset}.000Z`,
                        endedAt: `2026-09-05T00:00:0${offset + 1}.000Z`,
                        status: 0,
                        signal: null,
                        error: null,
                        stdout: manifest.sourceMemoryScenarios
                            .map(s =>
                                JSON.stringify({
                                    scenario: s.name,
                                    runtime,
                                    units: s.units,
                                    retainedBytes: s.units,
                                    retainedBytesPerUnit: 1,
                                    releasedBytes: 0,
                                }),
                            )
                            .join("\n"),
                        stderr:
                            runtime === "bun"
                                ? "8 pass\n0 fail\n"
                                : "Tests 8 passed (8)\n",
                    }
                    const path = `${arm}-${runtime}.process.json`
                    writeFileSync(join(root, path), JSON.stringify(process))
                    value.processes.push({
                        arm,
                        runtime,
                        process: path,
                        sha256: fileHash(join(root, path)),
                        ...identity,
                        sourceSnapshotSha256: snapshot,
                        harnessSha256: sha256(frozenInputBytes(SOURCE_HARNESS)),
                    })
                    value.rows.push(
                        ...sourceMemoryRows(process, runtime, arm, path),
                    )
                    records.push(process)
                }
            expect(
                validateSourceMemory(root, value, { artifacts, index }),
            ).toHaveLength(32)
            for (let i = 0; i < records.length; i++) {
                const ref = value.processes[i]
                const path = join(root, ref.process)
                writeFileSync(
                    path,
                    JSON.stringify({
                        ...records[i],
                        cwd: "/unrelated/packages/valdres",
                    }),
                )
                ref.sha256 = fileHash(path)
                expect(() =>
                    validateSourceMemory(root, value, { artifacts, index }),
                ).toThrow("SOURCE-MEMORY-PROCESSES")
                writeFileSync(path, JSON.stringify(records[i]))
                ref.sha256 = fileHash(path)
            }
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    }, 30000)
}
