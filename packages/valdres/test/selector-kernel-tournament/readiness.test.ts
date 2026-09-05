import { test, expect } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import {
    verifyFoundationLanding,
    requireCandidateBase,
} from "../../../../scripts/selector-kernel-tournament/readiness.mjs"
test("landing preserves frozen ancestry and owned bytes while upstream family remains independent", () => {
    // A disposable Git fixture, not a candidate workspace or implementation.
    const root = mkdtempSync(join(tmpdir(), "tournament-ancestry-test-"))
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
    try {
        git("init", "-q")
        git("config", "user.email", "fixture@example.invalid")
        git("config", "user.name", "Fixture")
        write("family.txt", "beta36")
        const spec = commit()
        write("scripts/selector-kernel-tournament/frozen.txt", "authority\n")
        const frozen = commit()
        write("family.txt", "unrelated main input")
        const landing = commit()
        git("update-ref", "refs/remotes/origin/main", landing)
        const readiness = {
            frozenFoundationSha: frozen,
            foundationMergeSha: landing,
        }
        expect(() =>
            verifyFoundationLanding(readiness, { root, spec }),
        ).not.toThrow()
        expect(() =>
            requireCandidateBase(frozen, readiness, root),
        ).not.toThrow()
        expect(() => requireCandidateBase(landing, readiness, root)).toThrow(
            "FOUNDATION-CANDIDATE-BASE",
        )
        write("scripts/selector-kernel-tournament/frozen.txt", "authority\n\n")
        const changed = commit()
        git("update-ref", "refs/remotes/origin/main", changed)
        expect(() =>
            verifyFoundationLanding(
                { ...readiness, foundationMergeSha: changed },
                { root, spec },
            ),
        ).toThrow("FOUNDATION-LANDING-BYTES")
        expect(() =>
            verifyFoundationLanding(
                { ...readiness, foundationMergeSha: spec },
                { root, spec },
            ),
        ).toThrow("FOUNDATION-ANCESTRY")
        git("update-ref", "refs/remotes/origin/main", spec)
        expect(() =>
            verifyFoundationLanding(readiness, { root, spec }),
        ).toThrow("FOUNDATION-ANCESTRY")
        const tree = git("rev-parse", `${frozen}^{tree}`)
        const squash = git(
            "commit-tree",
            tree,
            "-p",
            spec,
            "-m",
            "squashed fixture",
        )
        git("update-ref", "refs/remotes/origin/main", squash)
        expect(() =>
            verifyFoundationLanding(
                { ...readiness, foundationMergeSha: squash },
                { root, spec },
            ),
        ).toThrow("FOUNDATION-ANCESTRY")
    } finally {
        rmSync(root, { recursive: true, force: true })
    }
})
