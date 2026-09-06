import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { test, expect } = await import("bun:test")
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import(
        "node:fs"
    )
    const { join } = await import("node:path")
    const { tmpdir } = await import("node:os")
    const { execFileSync } = await import("node:child_process")
    const {
        verifyFoundationLanding,
        verifyFoundationIntegration,
        requireCandidateBase,
    } = await import(
        "../../../../scripts/selector-kernel-tournament/readiness.mjs"
    )

    test("real divergent landing preserves the exact foundation delta and every upstream addition", () => {
        const root = mkdtempSync(join(tmpdir(), "tournament-divergent-merge-"))
        const git = (...args: string[]) =>
            execFileSync("git", args, {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            }).trim()
        const write = (p: string, text: string) => {
            mkdirSync(join(root, p, ".."), { recursive: true })
            writeFileSync(join(root, p), text)
        }
        const commit = () => {
            git("add", ".")
            git("commit", "-qm", "fixture")
            return git("rev-parse", "HEAD")
        }
        const pkg = "packages/valdres/package.json",
            owned = "scripts/selector-kernel-tournament/frozen.txt"
        const base = {
            name: "fixture",
            version: "control",
            scripts: {
                "test:runtime": "bun test --reporter=dots test/original",
            },
        }
        const standalone =
            "bun test --reporter=dots test/selector-kernel-tournament"
        const foundation = {
            ...base,
            scripts: {
                ...base.scripts,
                "test:runtime":
                    base.scripts["test:runtime"] +
                    " test/selector-kernel-tournament",
                "test:selector-kernel-tournament": standalone,
            },
        }
        const upstream = {
            ...base,
            version: "upstream",
            scripts: {
                ...base.scripts,
                "test:runtime":
                    base.scripts["test:runtime"] +
                    " test/performance/collection.performance.test.ts test/upstream-second",
                "test:collection:timing": "bun run collection.timing.ts",
            },
        }
        const union = {
            ...upstream,
            scripts: {
                ...upstream.scripts,
                "test:runtime":
                    upstream.scripts["test:runtime"] +
                    " test/selector-kernel-tournament",
                "test:selector-kernel-tournament": standalone,
            },
        }
        try {
            git("init", "-q")
            git("config", "user.email", "fixture@example.invalid")
            git("config", "user.name", "Fixture")
            write(pkg, JSON.stringify(base))
            write("scripts/lib/paired-decision.ts", "original upstream\n")
            write("family.txt", "control compatibility\n")
            const spec = commit()
            write(pkg, JSON.stringify(foundation))
            write(owned, "frozen authority\n")
            const frozen = commit()
            git("checkout", "-qb", "independent-main", spec)
            write(pkg, JSON.stringify(upstream))
            write("family.txt", "upstream family changes\n")
            write(
                "scripts/lib/paired-decision.ts",
                "upstream edits an existing unowned file\n",
            )
            const main = commit()
            expect(git("merge-base", frozen, main)).toBe(spec)
            expect(() =>
                git("merge", "--no-ff", "--no-commit", frozen),
            ).toThrow()
            expect(git("rev-parse", "MERGE_HEAD")).toBe(frozen)
            write(pkg, JSON.stringify(union))
            const landing = commit()
            expect(git("show", "-s", "--format=%P", landing)).toBe(
                main + " " + frozen,
            )
            git("update-ref", "refs/remotes/origin/main", landing)
            const readiness = {
                frozenFoundationSha: frozen,
                foundationMergeSha: landing,
            }
            expect(() =>
                verifyFoundationLanding(readiness, { root, spec }),
            ).not.toThrow()
            expect(() =>
                verifyFoundationIntegration(
                    {
                        frozenFoundationSha: frozen,
                        landingSha: landing,
                        upstreamSha: main,
                    },
                    { root, spec },
                ),
            ).not.toThrow()
            expect(() =>
                requireCandidateBase(frozen, readiness, root),
            ).not.toThrow()
            expect(() =>
                requireCandidateBase(landing, readiness, root),
            ).toThrow("FOUNDATION-CANDIDATE-BASE")
            // Each negative uses the same authentic two-parent merge topology.
            function reject(
                change: (p: any) => void,
                gate = "FOUNDATION-LANDING-BYTES",
            ) {
                const value = structuredClone(union)
                change(value)
                write(pkg, JSON.stringify(value))
                git("add", ".")
                const bad = git(
                    "commit-tree",
                    git("write-tree"),
                    "-p",
                    main,
                    "-p",
                    frozen,
                    "-m",
                    "red merge fixture",
                )
                git("update-ref", "refs/remotes/origin/main", bad)
                expect(() =>
                    verifyFoundationLanding(
                        { ...readiness, foundationMergeSha: bad },
                        { root, spec },
                    ),
                ).toThrow(gate)
                write(pkg, JSON.stringify(union))
                write(owned, "frozen authority\n")
                git("add", ".")
            }
            reject(p => {
                p.scripts["test:runtime"] = upstream.scripts["test:runtime"]
            })
            reject(p => {
                p.scripts["test:runtime"] += " test/selector-kernel-tournament"
            })
            reject(p => {
                p.scripts["test:runtime"] = p.scripts["test:runtime"].replace(
                    "test/selector-kernel-tournament",
                    "test/selector-kernel-tournament/fake",
                )
            })
            reject(p => {
                p.scripts["test:runtime"] = foundation.scripts["test:runtime"]
            })
            reject(p => {
                p.scripts["test:runtime"] = p.scripts["test:runtime"].replace(
                    "test/upstream-second",
                    "test/replacement",
                )
            })
            reject(p => {
                delete p.scripts["test:collection:timing"]
            })
            reject(p => {
                p.scripts["test:collection:timing"] += " --changed"
            })
            reject(p => {
                delete p.scripts["test:selector-kernel-tournament"]
            })
            reject(p => {
                p.scripts["test:selector-kernel-tournament"] += " --changed"
            })
            reject(p => {
                p.version = base.version
            })
            reject(() => write(owned, "frozen authority\n\n"))
            for (const alias of [
                "test/selector-kernel-tournament/",
                "test/./selector-kernel-tournament",
                "test/other/../selector-kernel-tournament",
                "test/Selector-Kernel-Tournament",
                "test/selector-kernel-tournament/readiness.test.ts",
            ]) {
                write(
                    pkg,
                    JSON.stringify({
                        ...upstream,
                        scripts: {
                            ...upstream.scripts,
                            "test:runtime":
                                upstream.scripts["test:runtime"] + " " + alias,
                        },
                    }),
                )
                git("add", ".")
                const aliasedMain = git(
                    "commit-tree",
                    git("write-tree"),
                    "-p",
                    spec,
                    "-m",
                    "aliased upstream fixture",
                )
                write(
                    pkg,
                    JSON.stringify({
                        ...union,
                        scripts: {
                            ...union.scripts,
                            "test:runtime":
                                union.scripts["test:runtime"] + " " + alias,
                        },
                    }),
                )
                git("add", ".")
                const bad = git(
                    "commit-tree",
                    git("write-tree"),
                    "-p",
                    aliasedMain,
                    "-p",
                    frozen,
                    "-m",
                    "aliased merge fixture",
                )
                git("update-ref", "refs/remotes/origin/main", bad)
                expect(() =>
                    verifyFoundationLanding(
                        { ...readiness, foundationMergeSha: bad },
                        { root, spec },
                    ),
                ).toThrow("FOUNDATION-SCRIPT-DELTA")
            }
            const tree = git("rev-parse", `${landing}^{tree}`)
            for (const parents of [
                [main],
                [frozen, main],
                [main, frozen, spec],
                [landing, frozen],
            ]) {
                const bad = git(
                    "commit-tree",
                    tree,
                    ...parents.flatMap(p => ["-p", p]),
                    "-m",
                    "malformed topology",
                )
                git("update-ref", "refs/remotes/origin/main", bad)
                expect(() =>
                    verifyFoundationLanding(
                        { ...readiness, foundationMergeSha: bad },
                        { root, spec },
                    ),
                ).toThrow(
                    parents.length === 1
                        ? "FOUNDATION-ANCESTRY"
                        : "FOUNDATION-MERGE-TOPOLOGY",
                )
            }
            git("update-ref", "refs/remotes/origin/main", main)
            expect(() =>
                verifyFoundationLanding(readiness, { root, spec }),
            ).toThrow("FOUNDATION-ANCESTRY")
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    })
    test("the exact landed predecessor admits an amendment but rejects moving-main lineage and script drift", async () => {
        const { ROOT } = await import(
            "../../../../scripts/selector-kernel-tournament/inputs.mjs"
        )
        const { AMENDMENT_BASE, AMENDMENT_BASE_LANDING } = await import(
            "../../../../scripts/selector-kernel-tournament/readiness.mjs"
        )
        const root = mkdtempSync(join(tmpdir(), "tournament-amendment-merge-"))
        const git = (...args: string[]) =>
            execFileSync("git", args, {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            }).trim()
        try {
            git("clone", "--bare", "--shared", ROOT, ".")
            const frozen = git(
                "commit-tree",
                git("rev-parse", AMENDMENT_BASE + "^{tree}"),
                "-p",
                AMENDMENT_BASE,
                "-m",
                "test-only amendment",
            )
            const tree = git("rev-parse", AMENDMENT_BASE_LANDING + "^{tree}")
            const merge = (base: string, upstream: string, mergeTree = tree) =>
                git(
                    "commit-tree",
                    mergeTree,
                    "-p",
                    upstream,
                    "-p",
                    base,
                    "-m",
                    "test-only landing",
                )
            const landing = merge(frozen, AMENDMENT_BASE_LANDING)
            expect(() =>
                verifyFoundationIntegration(
                    {
                        frozenFoundationSha: frozen,
                        landingSha: landing,
                        upstreamSha: AMENDMENT_BASE_LANDING,
                    },
                    { root },
                ),
            ).not.toThrow()
            const mainBased = git(
                "commit-tree",
                tree,
                "-p",
                AMENDMENT_BASE_LANDING,
                "-m",
                "wrong substrate",
            )
            expect(() =>
                verifyFoundationIntegration(
                    {
                        frozenFoundationSha: mainBased,
                        landingSha: merge(mainBased, AMENDMENT_BASE_LANDING),
                        upstreamSha: AMENDMENT_BASE_LANDING,
                    },
                    { root },
                ),
            ).toThrow("FOUNDATION-MERGE-TOPOLOGY")
            // A single merge-base can hide an older moving-main merge behind
            // the authorized predecessor. Both best common ancestors must fail.
            const priorMain = git(
                "show",
                "-s",
                "--format=%P",
                AMENDMENT_BASE_LANDING,
            ).split(" ")[0]
            const contaminated = git(
                "commit-tree",
                git("rev-parse", AMENDMENT_BASE + "^{tree}"),
                "-p",
                AMENDMENT_BASE,
                "-p",
                priorMain,
                "-m",
                "hidden moving-main ancestry",
            )
            expect(
                git(
                    "merge-base",
                    "--all",
                    contaminated,
                    AMENDMENT_BASE_LANDING,
                ).split("\n"),
            ).toHaveLength(2)
            expect(() =>
                verifyFoundationIntegration(
                    {
                        frozenFoundationSha: contaminated,
                        landingSha: merge(contaminated, AMENDMENT_BASE_LANDING),
                        upstreamSha: AMENDMENT_BASE_LANDING,
                    },
                    { root },
                ),
            ).toThrow("FOUNDATION-MERGE-TOPOLOGY")
            const path = "packages/valdres/package.json"
            const original = JSON.parse(
                git("show", AMENDMENT_BASE_LANDING + ":" + path),
            )
            for (const change of [
                (p: any) => {
                    p.scripts["test:runtime"] +=
                        " test/selector-kernel-tournament"
                },
                (p: any) => {
                    p.scripts["test:runtime"] = p.scripts[
                        "test:runtime"
                    ].replace(
                        "test/selector-kernel-tournament",
                        "test/Selector-Kernel-Tournament",
                    )
                },
                (p: any) => {
                    p.scripts["test:runtime"] = p.scripts[
                        "test:runtime"
                    ].replace(" test/selector-kernel-tournament", "")
                },
                (p: any) => {
                    delete p.scripts["test:selector-kernel-tournament"]
                },
                (p: any) => {
                    p.scripts["test:selector-kernel-tournament"] += " --changed"
                },
            ]) {
                const pkg = structuredClone(original)
                change(pkg)
                const file = join(root, "submission.json")
                writeFileSync(file, JSON.stringify(pkg))
                git("read-tree", tree)
                const blob = git("hash-object", "-w", file)
                git(
                    "update-index",
                    "--add",
                    "--cacheinfo",
                    "100644," + blob + "," + path,
                )
                const changedTree = git("write-tree")
                const upstream = git(
                    "commit-tree",
                    changedTree,
                    "-p",
                    AMENDMENT_BASE_LANDING,
                    "-m",
                    "upstream script drift",
                )
                expect(() =>
                    verifyFoundationIntegration(
                        {
                            frozenFoundationSha: frozen,
                            landingSha: merge(frozen, upstream, changedTree),
                            upstreamSha: upstream,
                        },
                        { root },
                    ),
                ).toThrow("FOUNDATION-SCRIPT-DELTA")
            }
        } finally {
            rmSync(root, { recursive: true, force: true })
        }
    }, 30000)
}
