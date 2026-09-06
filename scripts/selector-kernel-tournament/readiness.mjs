import { join } from "node:path"
import { mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { captureCommand } from "./artifact.mjs"
import {
    ROOT,
    gitBlob,
    checkInputs,
    assertClean,
    authenticateAuthorityFiles,
    SPEC_COMMIT,
    git,
    json,
    sha256,
    fileHash,
    requireGate,
} from "./inputs.mjs"
import { evidencePath, verifySeal, strictKeys, same } from "./evidence.mjs"
// Explicitly authorized predecessor for the C-size foundation amendment. A
// moving-main commit is never an alternative frozen substrate.
export const AMENDMENT_BASE = "fc2d75b58eaed8e17f1c1fa5b0a54cecf80512bc"
export const AMENDMENT_BASE_LANDING = "7197825c45780076346cf54f0bfc04bfea6b8e71"
// Ownership is defined by the frozen branch, never by upstream's diff.
const alwaysOwned = p =>
    p.startsWith("scripts/selector-kernel-tournament/") ||
    p.startsWith("packages/valdres/test/selector-kernel-tournament/") ||
    p === "docs/designs/selector-kernel-tournament.md" ||
    p === ".changeset/selector-kernel-foundation.md" ||
    p === ".changeset/selector-kernel-foundation-c-size.md"
export function foundationOwnedPaths(frozen, root = ROOT, spec = SPEC_COMMIT) {
    const changed = new Set(
        git(["diff", "--name-only", spec, frozen], root).split("\n"),
    )
    return git(["ls-tree", "-r", "--name-only", frozen], root)
        .split("\n")
        .filter(
            p =>
                alwaysOwned(p) ||
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
function scriptWords(value, label) {
    requireGate(
        typeof value === "string" &&
            /^[A-Za-z0-9_./:=@+-]+(?: [A-Za-z0-9_./:=@+-]+)*$/.test(value),
        "FOUNDATION-SCRIPT-DELTA",
        label + ": simple argv required",
    )
    return value.split(" ")
}
export function mergeFoundationScripts(
    before,
    frozen,
    upstream,
    alreadyLanded = false,
) {
    const expected = { ...upstream }
    for (const key of new Set([
        ...Object.keys(before),
        ...Object.keys(frozen),
    ])) {
        if (before[key] === frozen[key]) continue
        if (key !== "test:runtime") {
            if (alreadyLanded)
                requireGate(
                    upstream[key] === frozen[key],
                    "FOUNDATION-SCRIPT-DELTA",
                    key + ": landed foundation script changed or missing",
                )
            requireGate(
                !(key in upstream) ||
                    upstream[key] === before[key] ||
                    upstream[key] === frozen[key],
                "FOUNDATION-SCRIPT-DELTA",
                key + ": conflicting upstream change",
            )
            if (key in frozen) expected[key] = frozen[key]
            else delete expected[key]
            continue
        }
        const base = scriptWords(before[key], key),
            addition = scriptWords(frozen[key], key),
            main = scriptWords(upstream[key], key)
        same(
            addition.slice(0, base.length),
            base,
            "FOUNDATION-SCRIPT-DELTA",
            "foundation changed original invocation",
        )
        same(
            main.slice(0, base.length),
            base,
            "FOUNDATION-SCRIPT-DELTA",
            "upstream changed original invocation",
        )
        const delta = addition.slice(base.length),
            upstreamDelta = main.slice(base.length)
        same(
            delta,
            ["test/selector-kernel-tournament"],
            "FOUNDATION-SCRIPT-DELTA",
            "exact tournament lane addition required",
        )
        requireGate(
            upstreamDelta.every(
                word =>
                    word.startsWith("test/") &&
                    word
                        .split("/")
                        .every(part => !["", ".", ".."].includes(part)) &&
                    !word
                        .toLowerCase()
                        .startsWith("test/selector-kernel-tournament/"),
            ) &&
                new Set(main).size === main.length &&
                delta.every(
                    word =>
                        main.filter(existing => existing.toLowerCase() === word)
                            .length === (alreadyLanded ? 1 : 0) &&
                        (!alreadyLanded || main.includes(word)),
                ),
            "FOUNDATION-SCRIPT-DELTA",
            "duplicate or non-additive upstream lane",
        )
        expected[key] = (alreadyLanded ? main : [...main, ...delta]).join(" ")
    }
    return expected
}
export function verifyFoundationOwned(
    frozen,
    target,
    { root = ROOT, spec = SPEC_COMMIT } = {},
) {
    const expected = foundationOwnedPaths(frozen, root, spec)
    const actual = git(["ls-tree", "-r", "--name-only", target], root)
        .split("\n")
        .filter(p => alwaysOwned(p) || expected.includes(p))
        .sort()
    same(
        actual,
        expected,
        "FOUNDATION-LANDING-BYTES",
        "owned file inventory or deletion differs",
    )
    for (const path of expected)
        same(
            git(["ls-tree", frozen, "--", path], root),
            git(["ls-tree", target, "--", path], root),
            "FOUNDATION-LANDING-BYTES",
            path,
        )
}
export function verifyFoundationIntegration(
    { frozenFoundationSha: frozen, landingSha: landing, upstreamSha: upstream },
    { root = ROOT, spec = SPEC_COMMIT } = {},
) {
    requireGate(
        [frozen, landing, upstream].every(s => /^[a-f0-9]{40}$/.test(s)),
        "FOUNDATION-MERGE",
        "exact SHAs required",
    )
    const parents = git(["show", "-s", "--format=%P", landing], root).split(" ")
    requireGate(
        parents.length === 2 &&
            parents[0] === upstream &&
            parents[1] === frozen,
        "FOUNDATION-MERGE-TOPOLOGY",
        "exact upstream-first, frozen-second merge required",
    )
    requireAncestor(spec, frozen, root)
    requireAncestor(spec, upstream, root)
    requireAncestor(frozen, parents[1], root)
    const mergeBase = git(["merge-base", "--all", frozen, upstream], root)
    const amendment = mergeBase === AMENDMENT_BASE && frozen !== AMENDMENT_BASE
    requireGate(
        mergeBase === spec || amendment,
        "FOUNDATION-MERGE-TOPOLOGY",
        "foundation must diverge at the spec or the exact authorized frozen predecessor",
    )
    if (amendment) {
        requireAncestor(AMENDMENT_BASE_LANDING, upstream, root)
        requireGate(
            git(["rev-list", "--first-parent", upstream], root)
                .split("\n")
                .includes(AMENDMENT_BASE_LANDING),
            "FOUNDATION-MERGE-TOPOLOGY",
            "predecessor landing missing from upstream first-parent history",
        )
        const priorUpstream = git(
            ["show", "-s", "--format=%P", AMENDMENT_BASE_LANDING],
            root,
        ).split(" ")[0]
        verifyFoundationIntegration(
            {
                frozenFoundationSha: AMENDMENT_BASE,
                landingSha: AMENDMENT_BASE_LANDING,
                upstreamSha: priorUpstream,
            },
            { root, spec },
        )
    }
    verifyFoundationOwned(frozen, landing, { root, spec })
    for (const path of ["package.json", "packages/valdres/package.json"]) {
        const exists = commit =>
            git(["ls-tree", commit, "--", path], root) !== ""
        if (![spec, frozen, upstream, landing].some(exists)) continue
        requireGate(
            [spec, frozen, upstream, landing].every(exists),
            "FOUNDATION-LANDING-BYTES",
            "shared manifest missing: " + path,
        )
        const read = commit =>
            JSON.parse(gitBlob(commit, path, root).toString("utf8"))
        const original = read(spec),
            authority = read(frozen),
            main = read(upstream),
            actual = read(landing)
        const expected = {
            ...main,
            scripts: mergeFoundationScripts(
                original.scripts ?? {},
                authority.scripts ?? {},
                main.scripts ?? {},
                amendment,
            ),
        }
        same(
            actual,
            expected,
            "FOUNDATION-LANDING-BYTES",
            path +
                ": exact upstream manifest plus foundation script delta required",
        )
    }
    return {
        frozenFoundationSha: frozen,
        landingSha: landing,
        upstreamSha: upstream,
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
    requireAncestor(frozen, landing, root)
    requireAncestor(landing, mainRef, root)
    requireGate(
        git(["rev-list", "--first-parent", mainRef], root)
            .split("\n")
            .includes(landing),
        "FOUNDATION-MERGE-TOPOLOGY",
        "landing must be on main's first-parent history",
    )
    const upstream = git(["show", "-s", "--format=%P", landing], root).split(
        " ",
    )[0]
    verifyFoundationIntegration(
        {
            frozenFoundationSha: frozen,
            landingSha: landing,
            upstreamSha: upstream,
        },
        { root, spec },
    )
    return { frozenFoundationSha: frozen, foundationMergeSha: landing }
}
export function requireCandidateBase(candidate, readiness, root = ROOT) {
    const frozen = readiness.frozenFoundationSha
    requireAncestor(frozen, candidate, root)
    requireGate(
        git(
            ["merge-base", "--all", candidate, readiness.foundationMergeSha],
            root,
        ) === frozen,
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
    assertClean()
    verifyFoundationLanding(readiness)
    verifyFoundationOwned(
        readiness.frozenFoundationSha,
        git(["rev-parse", "HEAD"]),
    )
    authenticateAuthorityFiles(ROOT, readiness.frozenFoundationSha)
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
    // Recompute with the frozen dependency graph, including oracle, paired
    // statistics and CI helpers. Recorded invocation paths remain evidence only.
    const temporary = mkdtempSync(
        join(tmpdir(), "tournament-frozen-validator-"),
    )
    const checkout = join(temporary, "authority")
    let added = false
    try {
        git([
            "worktree",
            "add",
            "--detach",
            checkout,
            readiness.frozenFoundationSha,
        ])
        added = true
        symlinkSync(
            join(ROOT, "node_modules"),
            join(checkout, "node_modules"),
            "dir",
        )
        const result = captureCommand(
            [
                "bun",
                join(
                    checkout,
                    "scripts/selector-kernel-tournament/readiness.mjs",
                ),
                "validate-proofs",
                evidencePath(root, path),
            ],
            checkout,
            { timeout: 600000 },
        )
        requireGate(
            result.status === 0 && !result.error,
            "FOUNDATION-PROOFS",
            result.stderr || result.stdout,
        )
        same(
            JSON.parse(result.stdout),
            {
                frozenFoundationSha: readiness.frozenFoundationSha,
                status: "pass",
            },
            "FOUNDATION-PROOFS",
            "frozen validator result differs",
        )
    } finally {
        if (added) git(["worktree", "remove", "--force", checkout])
        rmSync(temporary, { recursive: true, force: true })
    }
    return readiness
}
// This validates proofs only. It cannot authorize a candidate or assert a main landing.
export async function validateFrozenProofs(readiness) {
    assertClean()
    requireGate(
        git(["rev-parse", "HEAD"]) === readiness.frozenFoundationSha,
        "FOUNDATION-PROOF-AUTHORITY",
        "proof recomputation requires the exact frozen checkout",
    )
    checkInputs(ROOT, undefined, readiness.frozenFoundationSha)
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
    // The green provenance was authenticated and recomputed above. Red and
    // repository proofs must describe that same source invocation context.
    const authorityRoot = json(
        evidencePath(readiness.green.path, "provenance.json"),
    ).candidateRoot
    await validateRedBundle(readiness.red.path, readiness.red.sha256sums, {
        green: readiness.green,
        foundationSha: readiness.frozenFoundationSha,
        authorityRoot,
    })
    const { validateVerificationBundle } = await import("./verification.mjs")
    validateVerificationBundle(
        readiness.verification.path,
        readiness.verification.sha256sums,
        readiness.frozenFoundationSha,
        authorityRoot,
    )
    return {
        frozenFoundationSha: readiness.frozenFoundationSha,
        status: "pass",
    }
}
if (import.meta.main) {
    const [action, ...args] = process.argv.slice(2)
    if (action === "validate-proofs" && args.length === 1)
        console.log(JSON.stringify(await validateFrozenProofs(json(args[0]))))
    else if (action === "integration" && args.length === 3) {
        assertClean()
        const [frozenFoundationSha, landingSha, upstreamSha] = args
        requireGate(
            git(["rev-parse", "HEAD"]) === landingSha,
            "FOUNDATION-INTEGRATION",
            "run inside the actual merged tree",
        )
        const result = verifyFoundationIntegration({
            frozenFoundationSha,
            landingSha,
            upstreamSha,
        })
        verifyFoundationLanding(
            { frozenFoundationSha, foundationMergeSha: landingSha },
            { mainRef: landingSha },
        )
        checkInputs(ROOT, undefined, frozenFoundationSha)
        console.log(
            JSON.stringify({
                ...result,
                kind: "integration-only",
                candidateReady: false,
            }),
        )
    } else
        throw Error(
            "usage: readiness.mjs integration FROZEN LANDING UPSTREAM | validate-proofs READINESS_JSON",
        )
}
