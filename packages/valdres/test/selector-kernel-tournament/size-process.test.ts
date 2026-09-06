import { isolatedTournamentFile } from "./self-test-context.mjs"
if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { mkdtempSync, rmSync, readFileSync, writeFileSync } = await import(
        "node:fs"
    )
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const { sizeFixture } = await import("./size-fixture.mjs")
    const { validateSizeEvidence } = await import(
        "../../../../scripts/selector-kernel-tournament/resource-evidence.mjs"
    )
    const { decideSizes } = await import(
        "../../../../scripts/selector-kernel-tournament/resource-validation.mjs"
    )
    const { computeSelection } = await import(
        "../../../../scripts/selector-kernel-tournament/report.mjs"
    )
    const { fileHash, json } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )
    const { sealEvidence, verifySeal } = await import(
        "../../../../scripts/selector-kernel-tournament/evidence.mjs"
    )
    function fixture(variant = "passing") {
        const root = mkdtempSync(join(tmpdir(), "tournament-size-test-"))
        return {
            root,
            ...sizeFixture(root, variant),
            cleanup: () => rmSync(root, { recursive: true, force: true }),
        }
    }
    function submit(f: any, mutate: (p: any) => void, rehash = true) {
        const ref = f.value.processes.find((r: any) => r.arm === "candidate")
        const path = join(f.root, ref.process),
            process = json(path)
        mutate(process)
        writeFileSync(path, JSON.stringify(process))
        if (rehash) ref.sha256 = fileHash(path)
        return () => validateSizeEvidence(f.root, f.value, f)
    }
    test.each(["passing", "per-file", "oversized"])(
        "authenticates real %s measurements and preserves size gate results",
        variant => {
            const f = fixture(variant)
            try {
                expect(() =>
                    validateSizeEvidence(f.root, f.value, f),
                ).not.toThrow()
                const rows = decideSizes(
                    f.value.control,
                    f.value.candidate,
                    f.value.baseline,
                )
                expect(rows).toHaveLength(38)
                expect(rows.some((r: any) => r.status === "fail")).toBe(
                    variant !== "passing",
                )
                expect(
                    json(join(f.root, "size-candidate.process.json")).status,
                ).toBe(variant === "oversized" ? 1 : 0)
                expect(
                    verifySeal(f.root, sealEvidence(f.root)).length,
                ).toBeGreaterThan(0)
                expect(() =>
                    validateSizeEvidence(f.root, f.value, f),
                ).not.toThrow()
            } finally {
                f.cleanup()
            }
        },
    )
    test("size failure is diagnostic at C and blocks promotion at A, ShiftX, and integration", () => {
        const gates: any = Object.fromEntries(
            [
                "provenance",
                "contractC",
                "contractA",
                "familyCompatibility",
                "performance",
                "p95",
                "memory",
                "sourceMemory",
                "size",
                "shiftx",
            ].map(key => [key, { status: key === "size" ? "fail" : "pass" }]),
        )
        expect(computeSelection(gates, "C").machineEligible).toBe(true)
        for (const stage of ["A", "shiftx", "integration"]) {
            expect(computeSelection(gates, stage).reasons).toEqual([
                "size: fail",
            ])
            expect(() =>
                computeSelection(gates, stage, { decision: "promote" }),
            ).toThrow("REPORT-HUMAN-OVERRIDE")
        }
        for (const key of ["provenance", "contractC", "performance"]) {
            gates[key].status = "fail"
            expect(computeSelection(gates, "C").machineEligible).toBe(false)
            gates[key].status = "pass"
        }
        gates.performance.status = "inconclusive"
        expect(computeSelection(gates, "C").machineVerdict).toBe("inconclusive")
    })
    test("paired control headroom cannot hide an absolute candidate budget failure", () => {
        for (const id of ["dist", "packed", "fixture:atom"]) {
            const baseline = { [id]: { raw: 100, gzip: 100 } }
            const control = { [id]: { raw: 101, gzip: 101 } }
            const candidate = { [id]: { raw: 103, gzip: 103 } }
            expect(
                decideSizes(control, candidate, baseline).every(
                    r => r.status === "fail",
                ),
            ).toBe(true)
            expect(
                decideSizes(
                    control,
                    { [id]: { raw: 102, gzip: 102 } },
                    baseline,
                ).every(r => r.status === "pass"),
            ).toBe(true)
        }
    })
    test.each([
        [
            "arbitrary exit",
            (p: any) => {
                p.status = 2
            },
            "SIZE-PROCESS-FAILED",
        ],
        [
            "signal",
            (p: any) => {
                p.signal = "SIGTERM"
            },
            "SIZE-PROCESS-FAILED",
        ],
        [
            "crash",
            (p: any) => {
                p.status = null
                p.signal = "SIGSEGV"
            },
            "SIZE-PROCESS-FAILED",
        ],
        [
            "execution error",
            (p: any) => {
                p.error = "spawn ENOENT"
            },
            "SIZE-PROCESS-FAILED",
        ],
        [
            "missing output",
            (p: any) => {
                p.stdout = ""
            },
            "SIZE-METRICS",
        ],
        [
            "malformed output",
            (p: any) => {
                p.stdout =
                    "Measured sizes (bytes):\ndist total raw NaN gzip 7\n"
            },
            "SIZE-METRICS",
        ],
        [
            "inconsistent success",
            (p: any) => {
                p.status = 0
            },
            "SIZE-EXIT-RESULT",
        ],
        [
            "unrelated exception",
            (p: any) => {
                p.stderr += "\nError: unrelated failure\n"
            },
            "SIZE-PROCESS-REPLAY",
        ],
        [
            "trailing stdout",
            (p: any) => {
                p.stdout += "\nignored malformed metric\n"
            },
            "SIZE-PROCESS-REPLAY",
        ],
        [
            "wrong invocation",
            (p: any) => {
                p.argv[0] = "node"
            },
            "PROVENANCE-INVOCATION",
        ],
        [
            "wrong cwd",
            (p: any) => {
                p.cwd += "/elsewhere"
            },
            "PROVENANCE-INVOCATION",
        ],
    ])("rejects rehashed oversized evidence with %s", (_name, mutate, gate) => {
        const f = fixture("oversized")
        try {
            expect(submit(f, mutate as any)).toThrow(gate as string)
        } finally {
            f.cleanup()
        }
    })
    test("rejects exit one with passing aggregate measurements despite per-file failures", () => {
        const f = fixture("per-file")
        try {
            expect(
                submit(f, p => {
                    p.status = 1
                }),
            ).toThrow("SIZE-EXIT-RESULT")
        } finally {
            f.cleanup()
        }
    })
    test("rejects forged measurements after rehashing their process and updating the summary", () => {
        const f = fixture("oversized")
        try {
            const original = f.value.candidate.packed.raw
            f.value.candidate.packed.raw++
            expect(
                submit(f, p => {
                    p.stdout = p.stdout.replace(
                        `raw ${original}`,
                        `raw ${original + 1}`,
                    )
                }),
            ).toThrow("SIZE-PROCESS-REPLAY")
        } finally {
            f.cleanup()
        }
    })
    test("rejects raw process tampering without a matching digest", () => {
        const f = fixture()
        try {
            expect(
                submit(
                    f,
                    p => {
                        p.stderr += "tampered"
                    },
                    false,
                ),
            ).toThrow("SIZE-PROCESS-HASH")
        } finally {
            f.cleanup()
        }
    })
    test.each(["script", "baseline", "tarball"])(
        "rejects tampering with the %s authority",
        target => {
            const f = fixture("oversized")
            try {
                const path = join(
                    f.root,
                    target === "tarball"
                        ? "artifacts/candidate/fixture.tgz"
                        : target === "script"
                          ? "size-authority/scripts/check-package-size.ts"
                          : "size-authority/scripts/size-baseline.json",
                )
                writeFileSync(
                    path,
                    Buffer.concat([
                        readFileSync(path),
                        Buffer.from("\ntampered"),
                    ]),
                )
                expect(() => validateSizeEvidence(f.root, f.value, f)).toThrow(
                    target === "tarball" ? "ARTIFACT-HASH" : "SIZE-AUTHORITY",
                )
            } finally {
                f.cleanup()
            }
        },
    )
}
