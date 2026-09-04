import { join } from "node:path"
import {
    ROOT,
    DIRECTORY,
    manifest,
    reportSchema,
    json,
    fileHash,
    sha256,
    requireGate,
    exactRows,
    checkInputs,
    protectedSnapshot,
    git,
} from "./inputs.mjs"
import { same, strictKeys, evidencePath } from "./evidence.mjs"
import {
    validateArtifactEvidence,
    artifactIdentity,
} from "./artifact-validation.mjs"
import { requireStableEnvironment } from "./provenance.mjs"
export function inputHashes(provenance, timed, counter) {
    const digest = predicate =>
        sha256(
            JSON.stringify(
                provenance.protectedInputs.files.filter(r => predicate(r.path)),
            ),
        )
    return {
        runnerSha256: digest(p =>
            p.startsWith("scripts/selector-kernel-tournament/"),
        ),
        statisticsSha256: digest(p =>
            /^scripts\/lib\/(paired-decision|robust-estimators)/.test(p),
        ),
        fixtureSetSha256: provenance.foundation.manifestSha256,
        workloadSetSha256: digest(
            p => p.includes("workload") || p.includes("legacy-wrappers"),
        ),
        expectedTraceSetSha256: digest(
            p =>
                p.includes("semantic-cases") ||
                p.includes("selector-oracle") ||
                p.includes("graph-oracle") ||
                p.includes("workload-expectations"),
        ),
        adapterSha256: counter.counterAdapterSha256,
        timedArtifactSha256: timed.tarballSha256,
        counterArtifactSha256: counter.tarballSha256,
        counterArtifactWasTimed: false,
    }
}
export function validateProvenanceEvidence(root, index) {
    const value = json(evidencePath(root, "provenance.json"))
    strictKeys(
        value,
        [
            "schemaVersion",
            "kind",
            "foundation",
            "protectedInputs",
            "candidateRoot",
            "candidateSha",
            "candidateRuntimeTree",
            "repositoryDirty",
            "runner",
            "versions",
            "environmentAllowlist",
            "environment",
            "startedAt",
            "harnessHead",
        ],
        "PROVENANCE-SCHEMA",
    )
    requireGate(
        value.schemaVersion === 2 &&
            ["control", "candidate"].includes(value.kind) &&
            value.repositoryDirty === false,
        "PROVENANCE-SCHEMA",
        "version or clean status",
    )
    same(
        value.foundation,
        {
            gitSha: value.foundation.gitSha,
            ...checkInputs(),
            protectedPathsSha256: value.protectedInputs.sha256,
        },
        "PROVENANCE-INPUT-HASH",
        "normative identities differ",
    )
    same(
        value.protectedInputs,
        protectedSnapshot(ROOT, value.foundation.gitSha),
        "PROVENANCE-PROTECTED-PATH",
        "frozen inventory differs",
    )
    same(
        protectedSnapshot().files,
        value.protectedInputs.files,
        "PROVENANCE-PROTECTED-PATH",
        "validator inputs differ from frozen foundation",
    )
    requireGate(
        value.candidateRuntimeTree ===
            git(["rev-parse", `${value.candidateSha}:packages/valdres/src`]),
        "PROVENANCE-RUNTIME-TREE",
        "candidate tree differs",
    )
    same(
        value.environmentAllowlist,
        [
            "PATH",
            "HOME",
            "USER",
            "LOGNAME",
            "TMPDIR",
            "TEMP",
            "TMP",
            "LANG",
            "LC_ALL",
            "TZ",
            "SystemRoot",
        ],
        "PROVENANCE-ENVIRONMENT",
        "environment policy differs",
    )
    exactRows(
        Object.keys(value.runner),
        reportSchema.properties.provenance.properties.runner.required,
        "PROVENANCE-RUNNER",
    )
    requireGate(
        value.runner.bun === Bun.version &&
            value.runner.node === value.versions.node.node &&
            value.runner.v8 === value.versions.node.v8 &&
            value.runner.javascriptCore ===
                value.versions.bun.versions.webkit &&
            value.versions.bun.revision === Bun.revision,
        "PROVENANCE-RUNTIME-VERSION",
        "runtime identity differs",
    )
    requireStableEnvironment(value.environment, value.environment)
    const artifacts = {}
    for (const arm of ["control", "candidate"]) {
        artifacts[arm] = {}
        for (const mode of ["timed", "counter"])
            artifacts[arm][mode] = validateArtifactEvidence(
                root,
                index.artifacts[arm][mode],
                {
                    gitSha:
                        arm === "control"
                            ? manifest.control.gitSha
                            : value.candidateSha,
                    mode,
                },
            )
        requireGate(
            artifacts[arm].timed.tarballSha256 !==
                artifacts[arm].counter.tarballSha256 &&
                artifacts[arm].timed.productionEntrySha256 !==
                    artifacts[arm].counter.productionEntrySha256,
            "ARTIFACT-INSTRUMENTATION",
            "counter and timed builds must differ",
        )
    }
    return {
        value,
        artifacts,
        inputs: inputHashes(
            value,
            artifacts.candidate.timed,
            artifacts.candidate.counter,
        ),
    }
}
export function readNDJSON(root, path) {
    const value = Bun.file(evidencePath(root, path))
    return value.text().then(text => {
        requireGate(
            text.endsWith("\n"),
            "EVIDENCE-NDJSON",
            "missing final newline",
        )
        return text
            .trimEnd()
            .split("\n")
            .filter(Boolean)
            .map(line => JSON.parse(line))
    })
}
