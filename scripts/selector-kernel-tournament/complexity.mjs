import { execFileSync } from "node:child_process"
import {
    ROOT,
    git,
    sha256,
    json,
    fileHash,
    requireGate,
    exactRows,
} from "./inputs.mjs"
import { evidencePath, same, strictKeys } from "./evidence.mjs"
export function frozenDiff(foundationSha, candidateSha) {
    return execFileSync(
        "git",
        ["diff", "--binary", "--no-ext-diff", foundationSha, candidateSha],
        { cwd: ROOT },
    )
}
export function productionChanges(foundationSha, candidateSha) {
    const output = git([
        "diff",
        "--numstat",
        "--no-renames",
        foundationSha,
        candidateSha,
        "--",
        "packages/valdres/src",
    ])
    return output
        ? output.split("\n").map(line => {
              const [added, removed, path] = line.split("\t")
              requireGate(
                  /^\d+$/.test(added) && /^\d+$/.test(removed),
                  "COMPLEXITY-DIFF",
                  "binary production file",
              )
              return { path, added: Number(added), removed: Number(removed) }
          })
        : []
}
export function validateComplexity(
    root,
    { foundationSha, candidateSha, plan },
) {
    const raw = json(evidencePath(root, "complexity.json"))
    strictKeys(
        raw,
        [
            "schemaVersion",
            "modules",
            "persistentStateFields",
            "algorithmicConstants",
            "candidateTestFiles",
            "frozenDiffSha256",
            "constraints",
        ],
        "COMPLEXITY-SCHEMA",
    )
    requireGate(raw.schemaVersion === 3, "COMPLEXITY-SCHEMA", "version")
    const modules = productionChanges(foundationSha, candidateSha)
    same(raw.modules, modules, "COMPLEXITY-DIFF", "line inventory differs")
    requireGate(
        raw.frozenDiffSha256 ===
            sha256(frozenDiff(foundationSha, candidateSha)) &&
            fileHash(evidencePath(root, "frozen.diff")) ===
                raw.frozenDiffSha256,
        "PROVENANCE-DIFF-HASH",
        "frozen diff changed",
    )
    same(
        raw.algorithmicConstants,
        plan.algorithmicConstants,
        "PLAN-CONSTANTS",
        "constants changed after intent freeze",
    )
    same(
        raw.constraints,
        {
            workloadTunedConstants: false,
            secondHeuristicTier: false,
            publicRuntimeStrategySwitch: false,
        },
        "COMPLEXITY-CONSTRAINT",
        "forbidden strategy or constants declared",
    )
    requireGate(
        Array.isArray(raw.persistentStateFields) &&
            new Set(raw.persistentStateFields).size ===
                raw.persistentStateFields.length &&
            raw.persistentStateFields.every(
                s => typeof s === "string" && s.length > 0,
            ),
        "COMPLEXITY-FIELDS",
        "missing descriptions",
    )
    requireGate(
        Array.isArray(raw.candidateTestFiles) &&
            new Set(raw.candidateTestFiles).size ===
                raw.candidateTestFiles.length,
        "COMPLEXITY-TESTS",
        "missing or duplicate tests",
    )
    for (const path of raw.candidateTestFiles)
        requireGate(
            /\.test\.[cm]?[jt]s$/.test(path) &&
                git(["cat-file", "-t", `${candidateSha}:${path}`]) === "blob",
            "COMPLEXITY-TESTS",
            path,
        )
    const hooks = json(evidencePath(root, "host-hooks.json"))
    requireGate(
        Array.isArray(hooks) &&
            new Set(hooks.map(h => h.owner + "/" + h.name)).size ===
                hooks.length,
        "COMPLEXITY-HOOKS",
        "duplicate hooks",
    )
    for (const hook of hooks) {
        strictKeys(
            hook,
            [
                "name",
                "owner",
                "phase",
                "lifetime",
                "effects",
                "timedPathFrequency",
                "whyRequired",
            ],
            "COMPLEXITY-HOOKS",
        )
        requireGate(
            hook.owner.startsWith("packages/valdres/src/") &&
                git(["cat-file", "-t", `${candidateSha}:${hook.owner}`]) ===
                    "blob",
            "COMPLEXITY-HOOKS",
            "hook owner is not production source",
        )
    }
    return {
        complexity: {
            productionLinesAdded: modules.reduce((n, m) => n + m.added, 0),
            productionLinesRemoved: modules.reduce((n, m) => n + m.removed, 0),
            persistentStateFields: raw.persistentStateFields,
            algorithmicConstants: raw.algorithmicConstants,
            candidateTests: raw.candidateTestFiles.length,
            evidence: "complexity.json",
        },
        hostHooks: hooks,
        frozenDiffSha256: raw.frozenDiffSha256,
    }
}
