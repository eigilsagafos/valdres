import { buildPlan } from "../verify.ts"
import {
    mkdtempSync,
    mkdirSync,
    rmSync,
    symlinkSync,
    existsSync,
    readFileSync,
} from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { stripVTControlCharacters } from "node:util"
import {
    ROOT,
    SPEC_COMMIT,
    git,
    json,
    fileHash,
    sha256,
    assertClean,
    checkInputs,
    requireGate,
    exactRows,
    manifest,
} from "./inputs.mjs"
import {
    writeEvidence,
    evidencePath,
    strictKeys,
    same,
    verifySeal,
    sealEvidence,
} from "./evidence.mjs"
import { captureCommand, command } from "./artifact.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { sourceMemoryCommand, assertSourceMemory } from "./source-memory.mjs"

export const EXPECTED_TESTS = {
    tournament: 83, // 82 child cases plus one separately reported dispatcher
    "paired-statistics": 67,
    "frozen-family": 58,
    "source-memory-bun": 8,
    "source-memory-node": 8,
}
export function requireVerificationTotals(id, totals) {
    requireGate(
        totals.bun.every(t => t.failed === 0) &&
            totals.node.every(t => t.passed === t.total),
        "F9-TESTS",
        "failed or incomplete tests",
    )
    if (id === "repository-ci")
        requireGate(
            totals.ciSteps ===
                buildPlan(
                    readFileSync(
                        join(ROOT, ".github/workflows/ci.yaml"),
                        "utf8",
                    ),
                ).steps.length,
            "F9-CI",
            "complete frozen CI inventory required",
        )
    else
        requireGate(
            totals.bun.reduce((sum, t) => sum + t.passed, 0) +
                totals.node.reduce((sum, t) => sum + t.passed, 0) ===
                EXPECTED_TESTS[id],
            "F9-TESTS",
            "complete frozen test inventory required: " + id,
        )
}
export function verificationCommands(root = ROOT) {
    const pkg = join(root, "packages/valdres")
    // captureCommand deliberately pins production artifact processes. Ordinary
    // repository tests must inherit CI's unset NODE_ENV so Bun selects test mode.
    // Keep the explicit env operation in recorded argv; source-memory commands
    // retain their existing required production environment.
    return [
        {
            id: "repository-ci",
            argv: ["env", "-u", "NODE_ENV", "bun", "run", "verify"],
            cwd: root,
        },
        {
            id: "tournament",
            argv: [
                "env",
                "-u",
                "NODE_ENV",
                "bun",
                "test",
                "test/selector-kernel-tournament",
            ],
            cwd: pkg,
        },
        {
            id: "paired-statistics",
            argv: [
                "env",
                "-u",
                "NODE_ENV",
                "VALDRES_ALLOW_ROOT_BUN_TEST=1",
                "bun",
                "test",
                "scripts/lib/paired-decision.test.ts",
                "scripts/lib/paired-decision-tournament.test.ts",
                "scripts/lib/robust-estimators.test.ts",
            ],
            cwd: root,
        },
        {
            id: "frozen-family",
            argv: [
                "env",
                "-u",
                "NODE_ENV",
                "bun",
                "test",
                "--reporter=dots",
                ...manifest.productLanes.family.protectedPaths
                    .filter(p => p.endsWith(".test.ts"))
                    .map(p => join(root, p)),
            ],
            cwd: pkg,
        },
        ...["bun", "node"].map(runtime => ({
            id: "source-memory-" + runtime,
            argv: sourceMemoryCommand(runtime, root),
            cwd: pkg,
        })),
    ]
}
export function verificationTotals(process) {
    const text = stripVTControlCharacters(
        process.stdout + "\n" + process.stderr,
    )
    const bun = [
        ...text.matchAll(
            /^\s*(\d+) pass\s*\n(?:\s*\d+ (?:skip|todo)\s*\n)*\s*(\d+) fail/gm,
        ),
    ].map(m => ({ passed: +m[1], failed: +m[2] }))
    const node = [...text.matchAll(/Tests\s+(\d+) passed \((\d+)\)/g)].map(
        m => ({ passed: +m[1], total: +m[2] }),
    )
    return {
        bun,
        node,
        assertions: [...text.matchAll(/(\d+) expect\(\) calls/g)].reduce(
            (sum, m) => sum + +m[1],
            0,
        ),
        ciSteps: +(text.match(/All (\d+) step\(s\) passed/)?.[1] ?? 0),
    }
}
export function validateFoundationReviews(root, frozen) {
    const reviews = json(evidencePath(root, "reviews.json"))
    strictKeys(
        reviews,
        ["schemaVersion", "kind", "reviewedSha", "reviews", "findings"],
        "F9-REVIEW-SCHEMA",
    )
    requireGate(
        reviews.schemaVersion === 3 &&
            reviews.kind === "foundation-independent-reviews" &&
            /^[a-f0-9]{40}$/.test(reviews.reviewedSha),
        "F9-REVIEW-IDENTITY",
        "v3 independent review required",
    )
    requireGate(
        git(["rev-parse", `${reviews.reviewedSha}^{tree}`]) ===
            git(["rev-parse", `${frozen}^{tree}`]),
        "F9-REVIEW-TREE",
        "reviewed bytes differ from frozen authority",
    )
    exactRows(
        reviews.reviews.map(r => r.role),
        ["neutrality", "statistics"],
        "F9-REVIEW-INVENTORY",
    )
    for (const row of reviews.reviews) {
        strictKeys(
            row,
            ["role", "reviewer", "independent", "artifact", "sha256"],
            "F9-REVIEW-SCHEMA",
        )
        requireGate(
            row.independent === true &&
                typeof row.reviewer === "string" &&
                row.reviewer.length > 0 &&
                fileHash(evidencePath(root, row.artifact)) === row.sha256,
            "F9-REVIEW-HASH",
            row.role,
        )
    }
    requireGate(
        new Set(reviews.reviews.map(r => r.reviewer)).size === 2,
        "F9-REVIEW-INDEPENDENCE",
        "separate reviewers required",
    )
    exactRows(
        reviews.findings.map(f => f.id),
        [...new Set(reviews.findings.map(f => f.id))],
        "F9-REVIEW-FINDINGS",
    )
    for (const finding of reviews.findings) {
        strictKeys(
            finding,
            ["id", "disposition", "evidence"],
            "F9-REVIEW-SCHEMA",
        )
        requireGate(
            ["fixed", "not-a-defect"].includes(finding.disposition) &&
                finding.evidence &&
                typeof finding.evidence === "object",
            "F9-REVIEW-OPEN",
            finding.id,
        )
        strictKeys(finding.evidence, ["path", "sha256"], "F9-REVIEW-SCHEMA")
        requireGate(
            fileHash(evidencePath(root, finding.evidence.path)) ===
                finding.evidence.sha256,
            "F9-REVIEW-HASH",
            finding.id,
        )
    }
    return reviews
}
function publishDryRun(root, frozen) {
    const archive = join(root, "publish-source.tar")
    command(
        ["git", "archive", "--format=tar", "--output", archive, frozen],
        ROOT,
    )
    const sandbox = mkdtempSync(
        join(tmpdir(), "tournament-publish-verification-"),
    )
    try {
        command(["tar", "-xf", archive, "-C", sandbox], ROOT)
        symlinkSync(
            join(ROOT, "node_modules"),
            join(sandbox, "node_modules"),
            "dir",
        )
        const paths = git(["ls-tree", "-r", "--name-only", frozen])
            .split("\n")
            .filter(p => /^packages\/.+\/package\.json$/.test(p))
        const hashes = () =>
            paths.map(path => ({ path, sha256: fileHash(join(sandbox, path)) }))
        const before = hashes()
        const process = captureCommand(
            ["env", "DRY_RUN=1", "bash", "scripts/ci-publish.sh"],
            sandbox,
            { timeout: 600000 },
        )
        const ref = writeEvidence(root, "publish.process.json", process)
        const after = hashes()
        const backups = paths
            .map(p => p.replace(/package.json$/, "package.tmp.json"))
            .filter(p => existsSync(join(sandbox, p)))
        const result = {
            sourceArchive: "publish-source.tar",
            sourceArchiveSha256: fileHash(archive),
            process: ref.path,
            sha256: ref.sha256,
            before,
            after,
            backups,
        }
        writeEvidence(root, "publish.json", result)
        validateProcess(process)
        same(before, after, "F9-PUBLISH-CLEANUP", "package manifests changed")
        requireGate(
            backups.length === 0,
            "F9-PUBLISH-CLEANUP",
            "leftover backup",
        )
        return result
    } finally {
        rmSync(sandbox, { recursive: true, force: true })
    }
}
export function validateVerificationBundle(root, expectedSums, frozen) {
    verifySeal(root, expectedSums)
    const value = json(evidencePath(root, "verification.json"))
    strictKeys(
        value,
        [
            "schemaVersion",
            "kind",
            "foundationSha",
            "authorityRoot",
            "status",
            "commands",
            "reviews",
            "limitations",
        ],
        "F9-SCHEMA",
    )
    requireGate(
        value.schemaVersion === 3 &&
            value.kind === "foundation-verification" &&
            value.foundationSha === frozen &&
            value.status === "pass",
        "F9-IDENTITY",
        "wrong foundation or incomplete result",
    )
    const wanted = verificationCommands(value.authorityRoot)
    exactRows(
        value.commands.map(r => r.id),
        wanted.map(r => r.id),
        "F9-COMMAND-INVENTORY",
    )
    for (const ref of value.commands) {
        strictKeys(ref, ["id", "process", "sha256", "totals"], "F9-SCHEMA")
        requireGate(
            fileHash(evidencePath(root, ref.process)) === ref.sha256,
            "F9-PROCESS-HASH",
            ref.id,
        )
        const process = json(evidencePath(root, ref.process)),
            expected = wanted.find(r => r.id === ref.id)
        validateProcess(process, { argv: expected.argv })
        same(process.cwd, expected.cwd, "F9-COMMAND", ref.id)
        const totals = verificationTotals(process)
        same(ref.totals, totals, "PROVENANCE-RESULT-ROW", "test totals differ")
        requireVerificationTotals(ref.id, totals)
        if (ref.id.startsWith("source-memory-"))
            assertSourceMemory(
                process,
                ref.id.slice(14),
                "candidate",
                ref.process,
                value.authorityRoot,
            )
    }
    strictKeys(value.reviews, ["path", "sha256sums"], "F9-SCHEMA")
    verifySeal(value.reviews.path, value.reviews.sha256sums)
    validateFoundationReviews(value.reviews.path, frozen)
    same(
        value.limitations,
        {
            runner: "macOS arm64; GitHub Ubuntu execution remains a landing PR check",
            bencher: "required PR Bencher check pending; no candidate verdict",
        },
        "F9-LIMITATIONS",
        "limitations omitted",
    )
    const publish = json(evidencePath(root, "publish.json"))
    strictKeys(
        publish,
        [
            "sourceArchive",
            "sourceArchiveSha256",
            "process",
            "sha256",
            "before",
            "after",
            "backups",
        ],
        "F9-SCHEMA",
    )
    requireGate(
        fileHash(evidencePath(root, publish.sourceArchive)) ===
            publish.sourceArchiveSha256 &&
            fileHash(evidencePath(root, publish.process)) === publish.sha256,
        "F9-PUBLISH-HASH",
        "publish evidence drift",
    )
    const temporary = mkdtempSync(join(tmpdir(), "tournament-f9-archive-"))
    try {
        const archive = join(temporary, "source.tar")
        command(
            ["git", "archive", "--format=tar", "--output", archive, frozen],
            ROOT,
        )
        requireGate(
            fileHash(archive) === publish.sourceArchiveSha256,
            "F9-PUBLISH-SOURCE",
            "wrong frozen source",
        )
    } finally {
        rmSync(temporary, { recursive: true, force: true })
    }
    const paths = git(["ls-tree", "-r", "--name-only", frozen])
        .split("\n")
        .filter(p => /^packages\/.+\/package\.json$/.test(p))
    const expected = paths.map(path => ({
        path,
        sha256: sha256(
            execFileSync("git", ["show", `${frozen}:${path}`], { cwd: ROOT }),
        ),
    }))
    same(
        publish.before,
        expected,
        "F9-PUBLISH-SOURCE",
        "original package manifests differ",
    )
    same(
        publish.before,
        publish.after,
        "F9-PUBLISH-CLEANUP",
        "package manifests changed",
    )
    same(publish.backups, [], "F9-PUBLISH-CLEANUP", "leftover backups")
    validateProcess(json(evidencePath(root, publish.process)), {
        argv: ["env", "DRY_RUN=1", "bash", "scripts/ci-publish.sh"],
    })
    return value
}
export function runVerification(root, reviewsRoot) {
    assertClean()
    checkInputs()
    const frozen = git(["rev-parse", "HEAD"])
    verifySeal(reviewsRoot)
    validateFoundationReviews(reviewsRoot, frozen)
    mkdirSync(root)
    try {
        const commands = []
        for (const row of verificationCommands()) {
            console.log(
                JSON.stringify({
                    root,
                    phase: row.id,
                    at: new Date().toISOString(),
                }),
            )
            const process = captureCommand(row.argv, row.cwd, {
                timeout: 600000,
            })
            const ref = writeEvidence(root, row.id + ".process.json", process)
            commands.push({
                id: row.id,
                process: ref.path,
                sha256: ref.sha256,
                totals: verificationTotals(process),
            })
            validateProcess(process)
        }
        publishDryRun(root, frozen)
        assertClean()
        requireGate(
            git(["rev-parse", "HEAD"]) === frozen,
            "F9-HEAD",
            "authority changed",
        )
        const value = {
            schemaVersion: 3,
            kind: "foundation-verification",
            foundationSha: frozen,
            authorityRoot: ROOT,
            status: "pass",
            commands,
            reviews: {
                path: reviewsRoot,
                sha256sums: fileHash(join(reviewsRoot, "SHA256SUMS")),
            },
            limitations: {
                runner: "macOS arm64; GitHub Ubuntu execution remains a landing PR check",
                bencher:
                    "required PR Bencher check pending; no candidate verdict",
            },
        }
        writeEvidence(root, "verification.json", value)
        const sums = sealEvidence(root)
        validateVerificationBundle(root, sums, frozen)
        return {
            root,
            sha256sums: sums,
            commands: commands.map(r => ({ id: r.id, totals: r.totals })),
        }
    } catch (error) {
        if (!existsSync(join(root, "SHA256SUMS"))) {
            writeEvidence(root, "invalid-run.json", {
                schemaVersion: 3,
                reason: error.message,
            })
            console.error(
                JSON.stringify({
                    root,
                    sha256sums: sealEvidence(root),
                    reason: error.message,
                }),
            )
        }
        throw error
    }
}
if (import.meta.main) {
    try {
        const [action, root, reviewsRoot] = process.argv.slice(2)
        requireGate(
            action === "run" && reviewsRoot && process.argv.length === 5,
            "F9-CLI",
            "verification.mjs run NEW_OUTPUT_ROOT REVIEWS_ROOT",
        )
        console.log(JSON.stringify(runVerification(root, reviewsRoot)))
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
