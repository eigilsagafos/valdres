import { recordedRoot } from "./recorded-root.mjs"
import { join } from "node:path"
import {
    frozenInputBytes,
    sha256,
    manifest,
    fileHash,
    json,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import { writeEvidence, evidencePath, strictKeys, same } from "./evidence.mjs"
import { validateSemanticEvidence } from "./semantic-validation.mjs"
import { validateProcess } from "./process-evidence.mjs"
import { validateCorePreflight } from "./core-preflight.mjs"
export function validateFamily(root, path) {
    const family = json(evidencePath(root, path))
    strictKeys(
        family,
        ["status", "scoring", "files", "process"],
        "FAMILY-SCHEMA",
    )
    requireGate(
        family.status === "pass" && family.scoring === false,
        "FAMILY-COMPATIBILITY",
        "non-scoring family gate missing",
    )
    const expected = manifest.productLanes.family.protectedPaths
        .filter(p => p.endsWith(".test.ts"))
        .map(path => ({ path, sha256: sha256(frozenInputBytes(path)) }))
    same(family.files, expected, "FAMILY-FROZEN-HASH", "family files changed")
    const process = json(evidencePath(root, family.process))
    validateProcess(process, {
        cwd: join(recordedRoot(), "packages/valdres"),
        argv: [
            "bun",
            "test",
            "--reporter=dots",
            ...expected.map(r => join(recordedRoot(), r.path)),
        ],
    })
    requireGate(
        process.stderr.includes("58 pass") && process.stderr.includes("0 fail"),
        "FAMILY-COMPATIBILITY",
        "frozen suite incomplete",
    )
    return family
}
export function createPreflight(
    root,
    {
        stage,
        timed,
        counter,
        publicEvidence,
        counterEvidence,
        familyEvidence,
        coreEvidence,
    },
) {
    if (stage === "A") validateCorePreflight(root, coreEvidence, timed)
    const family = stage === "A" ? validateFamily(root, familyEvidence) : null,
        cache = new Map(),
        rows = []
    for (const [mode, path, identity] of [
        ["public", publicEvidence, timed],
        ["counter", counterEvidence, counter],
    ]) {
        const processes = validateSemanticEvidence(
            root,
            path,
            identity,
            mode,
            cache,
        )
        for (const process of processes.filter(p => p.repeat === 0))
            for (const row of process.rows.filter(r =>
                manifest.semanticCases
                    .find(c => c.id === r.id)
                    .requiredAt.includes(stage),
            ))
                rows.push({
                    id: row.id,
                    runtime: process.runtime,
                    mode,
                    status: "pass",
                    evidence: path,
                    traceSha256: row.traceSha256,
                })
    }
    return {
        schemaVersion: 3,
        stage,
        gitSha: timed.gitSha,
        timedArtifactSha256: timed.tarballSha256,
        counterArtifactSha256: counter.tarballSha256,
        core:
            stage === "C"
                ? null
                : {
                      evidence: coreEvidence,
                      sha256: fileHash(evidencePath(root, coreEvidence)),
                  },
        family:
            stage === "C"
                ? null
                : {
                      status: family.status,
                      scoring: false,
                      evidence: familyEvidence,
                      sha256: fileHash(evidencePath(root, familyEvidence)),
                  },
        rows,
    }
}
export function verifyPreflightEvidence(
    root,
    value,
    { timed, counter },
    cache = new Map(),
) {
    requireGate(
        value.counterArtifactSha256 === counter.tarballSha256 &&
            value.timedArtifactSha256 === timed.tarballSha256,
        "PREFLIGHT-IDENTITY",
        "preflight hashes differ from built artifacts",
    )
    if (value.stage === "C") {
        same(value.core, null, "CORE-PREFLIGHT-STAGE", "core-load belongs to A")
        same(
            value.family,
            null,
            "FAMILY-STAGE",
            "family is the independent A lane",
        )
    } else {
        strictKeys(value.core, ["evidence", "sha256"], "CORE-PREFLIGHT-SCHEMA")
        requireGate(
            fileHash(evidencePath(root, value.core.evidence)) ===
                value.core.sha256,
            "CORE-PREFLIGHT-HASH",
            "core oracle evidence changed",
        )
        validateCorePreflight(root, value.core.evidence, timed)
        strictKeys(
            value.family,
            ["status", "scoring", "evidence", "sha256"],
            "FAMILY-SCHEMA",
        )
        requireGate(
            fileHash(evidencePath(root, value.family.evidence)) ===
                value.family.sha256,
            "FAMILY-FROZEN-HASH",
            "family evidence changed",
        )
        validateFamily(root, value.family.evidence)
    }
    // Group references within this fixed root/artifact invocation. Validate
    // each complete evidence file once, then check every declared trace row.
    const groups = new Map()
    for (const row of value.rows) {
        const key = JSON.stringify([row.evidence, row.mode])
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(row)
    }
    for (const rows of groups.values()) {
        const row = rows[0]
        const results = validateSemanticEvidence(
            root,
            row.evidence,
            row.mode === "public" ? timed : counter,
            row.mode,
            cache,
        )
        for (const row of rows) {
            const expected = results
                .find(p => p.runtime === row.runtime && p.repeat === 0)
                .rows.find(r => r.id === row.id)
            requireGate(
                expected?.status === row.status &&
                    expected.traceSha256 === row.traceSha256,
                "PREFLIGHT-TRACE",
                row.id,
            )
        }
    }
}
