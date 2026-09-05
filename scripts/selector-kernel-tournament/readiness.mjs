import { join } from "node:path"
import {
    ROOT,
    SPEC_COMMIT,
    git,
    json,
    sha256,
    fileHash,
    requireGate,
} from "./inputs.mjs"
import { evidencePath, verifySeal, strictKeys, same } from "./evidence.mjs"
// Only files owned by the foundation must match the landing tree. Shared
// package manifests are checked at the individual tournament script entries.
export function foundationOwnedPaths(frozen, root = ROOT, spec = SPEC_COMMIT) {
    const all = git(["ls-tree", "-r", "--name-only", frozen], root).split("\n")
    const changed = new Set(
        git(["diff", "--name-only", spec, frozen], root).split("\n"),
    )
    return all
        .filter(
            p =>
                p.startsWith("scripts/selector-kernel-tournament/") ||
                p.startsWith(
                    "packages/valdres/test/selector-kernel-tournament/",
                ) ||
                p === "docs/designs/selector-kernel-tournament.md" ||
                p === ".changeset/selector-kernel-foundation.md" ||
                (changed.has(p) &&
                    (p.startsWith("packages/valdres/test/utils/") ||
                        /^scripts\/lib\/(paired-decision|robust-estimators|read-bench-results)/.test(
                            p,
                        ))),
        )
        .sort()
}
function requireAncestor(ancestor, descendant, root) {
    try {
        git(["merge-base", "--is-ancestor", ancestor, descendant], root)
    } catch {
        requireGate(
            false,
            "FOUNDATION-ANCESTRY",
            `${ancestor} is not an ancestor of ${descendant}`,
        )
    }
}
export function verifyFoundationLanding(
    { frozenFoundationSha: frozen, foundationMergeSha: landing },
    { root = ROOT, mainRef = "origin/main", spec = SPEC_COMMIT } = {},
) {
    requireGate(
        [frozen, landing].every(s => /^[a-f0-9]{40}$/.test(s)),
        "FOUNDATION-MERGE",
        "exact SHAs required",
    )
    requireAncestor(spec, frozen, root)
    requireAncestor(frozen, landing, root)
    requireAncestor(frozen, mainRef, root)
    requireAncestor(landing, mainRef, root)
    for (const path of foundationOwnedPaths(frozen, root, spec))
        same(
            git(["show", `${landing}:${path}`], root),
            git(["show", `${frozen}:${path}`], root),
            "FOUNDATION-LANDING-BYTES",
            path,
        )
    // git() trims text; use Git blob identities for exact bytes, including EOF.
    for (const path of foundationOwnedPaths(frozen, root, spec))
        requireGate(
            git(["rev-parse", `${landing}:${path}`], root) ===
                git(["rev-parse", `${frozen}:${path}`], root),
            "FOUNDATION-LANDING-BYTES",
            path,
        )
    const tracked = git(["ls-tree", "-r", "--name-only", frozen], root).split(
        "\n",
    )
    for (const path of ["package.json", "packages/valdres/package.json"].filter(
        p => tracked.includes(p),
    )) {
        const scripts = commit =>
            JSON.parse(git(["show", `${commit}:${path}`], root)).scripts ?? {}
        const before = scripts(spec),
            authority = scripts(frozen),
            landed = scripts(landing)
        for (const key of new Set([
            ...Object.keys(before),
            ...Object.keys(authority),
        ]))
            if (before[key] !== authority[key])
                same(
                    landed[key],
                    authority[key],
                    "FOUNDATION-LANDING-BYTES",
                    path + " scripts." + key,
                )
    }
    return { frozenFoundationSha: frozen, foundationMergeSha: landing }
}
export function requireCandidateBase(candidate, readiness, root = ROOT) {
    const frozen = readiness.frozenFoundationSha
    requireAncestor(frozen, candidate, root)
    requireGate(
        git(["merge-base", candidate, readiness.foundationMergeSha], root) ===
            frozen,
        "FOUNDATION-CANDIDATE-BASE",
        "candidate must start at the frozen authority, not the main landing",
    )
}
export async function validateFoundationReadiness(
    root,
    path = "foundation-readiness.json",
) {
    const readiness = json(evidencePath(root, path))
    strictKeys(
        readiness,
        [
            "schemaVersion",
            "foundationMergeSha",
            "frozenFoundationSha",
            "green",
            "red",
            "verification",
        ],
        "FOUNDATION-READINESS",
    )
    requireGate(
        readiness.schemaVersion === 3 &&
            /^[a-f0-9]{40}$/.test(readiness.foundationMergeSha),
        "FOUNDATION-MERGE",
        "missing merge SHA",
    )
    verifyFoundationLanding(readiness)
    for (const key of ["green", "red", "verification"]) {
        strictKeys(
            readiness[key],
            ["path", "sha256sums"],
            "FOUNDATION-READINESS",
        )
        requireGate(
            readiness[key].path.startsWith("/"),
            "FOUNDATION-READINESS",
            "shared absolute bundle path required",
        )
        verifySeal(readiness[key].path, readiness[key].sha256sums)
    }
    const { validateReportBundle } = await import("./report.mjs")
    const control = await validateReportBundle(
        readiness.green.path,
        readiness.green.sha256sums,
    )
    requireGate(
        control.kind === "foundation-control" &&
            control.status === "pass" &&
            control.foundation.gitSha === readiness.frozenFoundationSha,
        "FOUNDATION-GREEN",
        "green control proof missing",
    )
    const { validateRedBundle } = await import("./red-validation.mjs")
    await validateRedBundle(readiness.red.path, readiness.red.sha256sums, {
        green: readiness.green,
        foundationSha: readiness.frozenFoundationSha,
    })
    const { validateVerificationBundle } = await import("./verification.mjs")
    validateVerificationBundle(
        readiness.verification.path,
        readiness.verification.sha256sums,
        readiness.frozenFoundationSha,
    )
    return readiness
}
