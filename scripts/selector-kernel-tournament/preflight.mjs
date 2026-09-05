import { join } from "node:path"
import {
    ROOT,
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
        .map(path => ({ path, sha256: fileHash(join(ROOT, path)) }))
    same(family.files, expected, "FAMILY-FROZEN-HASH", "family files changed")
    const process = json(evidencePath(root, family.process))
    validateProcess(process, {
        argv: [
            "bun",
            "test",
            "--reporter=dots",
            ...expected.map(r => join(ROOT, r.path)),
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
    validateCorePreflight(root, coreEvidence, timed)
    const family = validateFamily(root, familyEvidence),
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
        core: {
            evidence: coreEvidence,
            sha256: fileHash(evidencePath(root, coreEvidence)),
        },
        family: {
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
    strictKeys(value.core, ["evidence", "sha256"], "CORE-PREFLIGHT-SCHEMA")
    requireGate(
        fileHash(evidencePath(root, value.core.evidence)) === value.core.sha256,
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
    for (const row of value.rows) {
        const results = validateSemanticEvidence(
            root,
            row.evidence,
            row.mode === "public" ? timed : counter,
            row.mode,
            cache,
        )
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
