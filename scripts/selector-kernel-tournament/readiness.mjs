import { join } from "node:path"
import { ROOT, git, json, fileHash, requireGate } from "./inputs.mjs"
import { evidencePath, verifySeal, strictKeys, same } from "./evidence.mjs"
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
        readiness.schemaVersion === 2 &&
            /^[a-f0-9]{40}$/.test(readiness.foundationMergeSha),
        "FOUNDATION-MERGE",
        "missing merge SHA",
    )
    git([
        "merge-base",
        "--is-ancestor",
        readiness.foundationMergeSha,
        "origin/main",
    ])
    const { protectedSnapshot } = await import("./inputs.mjs")
    same(
        protectedSnapshot(ROOT, readiness.foundationMergeSha).files,
        protectedSnapshot(ROOT, readiness.frozenFoundationSha).files,
        "FOUNDATION-MERGE",
        "merged foundation differs from frozen evidence",
    )
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
    const verification = json(
        join(readiness.verification.path, "verification.json"),
    )
    requireGate(
        verification.status === "pass" &&
            verification.foundationSha === readiness.frozenFoundationSha &&
            verification.independentNeutralityReview === "completed" &&
            verification.independentStatisticsReview === "completed",
        "FOUNDATION-F9",
        "final verification evidence missing",
    )
    return readiness
}
