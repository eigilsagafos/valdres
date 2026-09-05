import { test, expect } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import {
    verifyFoundationLanding,
    verifyFoundationIntegration,
    requireCandidateBase,
} from "../../../../scripts/selector-kernel-tournament/readiness.mjs"

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
        scripts: { "test:runtime": "bun test --reporter=dots test/original" },
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
        expect(() => git("merge", "--no-ff", "--no-commit", frozen)).toThrow()
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
        expect(() => requireCandidateBase(landing, readiness, root)).toThrow(
            "FOUNDATION-CANDIDATE-BASE",
        )
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
