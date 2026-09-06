import { mkdirSync, copyFileSync, readFileSync, existsSync } from "node:fs"
import { join, isAbsolute } from "node:path"
import { ROOT, json, fileHash, git, requireGate, manifest } from "./inputs.mjs"
import { collectSizes, collectMemory } from "./resources.mjs"
import {
    validateSizeEvidence,
    validateMemoryEvidence,
} from "./resource-evidence.mjs"
import { verifySeal, writeEvidence, sealEvidence } from "./evidence.mjs"
import { captureProvenance } from "./provenance.mjs"
// Replays resources from an immutable stopped-run artifact, never a candidate
// workspace. The resulting report is explicitly diagnostic and has no verdict.
const [original, root, expectedSums] = process.argv.slice(2)
requireGate(
    isAbsolute(original ?? "") &&
        isAbsolute(root ?? "") &&
        /^[a-f0-9]{64}$/.test(expectedSums ?? ""),
    "SIZE-CONTINUATION-CLI",
    "size-continuation.mjs SEALED_INPUT_ROOT NEW_OUTPUT_ROOT INPUT_SHA256SUMS_DIGEST",
)
mkdirSync(root)
try {
    verifySeal(original, expectedSums)
    const provenance = captureProvenance({
        foundationSha: git(["rev-parse", "HEAD"]),
        candidateRoot: ROOT,
        kind: "control",
        candidateSha: manifest.control.gitSha,
    })
    writeEvidence(root, "provenance.json", provenance)
    writeEvidence(root, "reproducer.mjs", readFileSync(import.meta.path))
    const dirs = {},
        artifacts = {},
        index = { artifacts: {} }
    for (const arm of ["control", "candidate"]) {
        const relative = `artifacts/${arm}-timed`,
            source = join(original, relative),
            target = join(root, relative)
        mkdirSync(target, { recursive: true })
        const artifact = json(join(source, "artifact.json"))
        for (const file of ["artifact.json", artifact.tarball])
            copyFileSync(join(source, file), join(target, file))
        dirs[arm] = target
        artifacts[arm] = { timed: artifact }
        index.artifacts[arm] = { timed: relative + "/artifact.json" }
    }
    const inputs = {
        controlDirectory: dirs.control,
        headDirectory: dirs.candidate,
        index,
        provenance,
    }
    const size = collectSizes(root, inputs)
    const processResult = json(join(root, "size-candidate.process.json")),
        historical = json(join(original, "size-candidate.process.json"))
    requireGate(
        processResult.stdout === historical.stdout &&
            processResult.stderr === historical.stderr &&
            processResult.status === 1,
        "REPRODUCTION",
        "checker outputs must reproduce exactly",
    )
    requireGate(
        size.some(r => r.status === "fail"),
        "REPRODUCTION",
        "oversized diagnostic missing",
    )
    writeEvidence(root, "source-memory.json", null) // Normal C-stage source-memory behavior.
    console.log(
        JSON.stringify({
            root,
            phase: "size-recorded; collecting all 120 packed memory processes",
            failedSizeRows: size.filter(r => r.status === "fail").length,
        }),
    )
    const memory = collectMemory(root, inputs)
    writeEvidence(root, "completion.json", {
        endedAt: new Date().toISOString(),
    })
    const report = {
        kind: "diagnostic-only-size-continuation-regression",
        authoritySha: git(["rev-parse", "HEAD"]),
        original: {
            path: original,
            sha256sums: fileHash(join(original, "SHA256SUMS")),
        },
        exactHistoricalSizeOutput: true,
        gate: { size: "fail", blockingAtC: false },
        size,
        memory,
        sourceMemory: "not-run at C",
        completion: "completion.json",
        limitations: [
            "Resource collection regression only; no semantics or latency rerun, no candidate eligibility or verdict.",
            "F7 separately authenticates the full canonical control report; repository tests cover required C gates and later promotion blocking.",
        ],
    }
    writeEvidence(root, "report.json", report)
    writeEvidence(
        root,
        "report.md",
        `# Diagnostic size-continuation regression\n\nAuthority ${report.authoritySha}. Exact sealed input tarball remeasured.\n\nSize diagnostic: fail (${size.filter(r => r.status === "fail").length} rows), original checker exits 1 with identical stdout/stderr. All 120 paired packed-memory processes completed; ${memory.length} memory rows recorded. Source absolute memory is not run at C. Completion and report are sealed. This is resource regression evidence, not a candidate report or eligibility decision.\n`,
    )
    validateSizeEvidence(root, json(join(root, "sizes.json")), {
        artifacts,
        index,
    })
    const records = readFileSync(join(root, "memory.ndjson"), "utf8")
        .trim()
        .split("\n")
        .map(JSON.parse)
    validateMemoryEvidence(root, records, { artifacts })
    requireGate(
        records.length === 120 && memory.length === 12,
        "REPRODUCTION",
        "missing heap processes",
    )
    const digest = sealEvidence(root)
    verifySeal(root, digest)
    // Validate after sealing as a separate evidence consumer as well.
    validateSizeEvidence(root, json(join(root, "sizes.json")), {
        artifacts,
        index,
    })
    validateMemoryEvidence(root, records, { artifacts })
    requireGate(
        Date.parse(json(join(root, "completion.json")).endedAt) >=
            Date.parse(provenance.startedAt),
        "REPRODUCTION",
        "completion missing or precedes collection",
    )
    console.log(
        JSON.stringify({
            root,
            sha256sums: digest,
            sizeRows: size.length,
            memoryProcesses: records.length,
            memoryRows: memory.length,
            reportSealed: true,
        }),
    )
} catch (error) {
    if (!existsSync(join(root, "SHA256SUMS"))) {
        writeEvidence(root, "invalid-run.json", {
            kind: "diagnostic-size-continuation-failure",
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
