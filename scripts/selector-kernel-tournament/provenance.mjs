import { cpus, totalmem, platform, arch, release, hostname } from "node:os"
import { join } from "node:path"
import { existsSync, readFileSync, lstatSync } from "node:fs"
import {
    ROOT,
    assertClean,
    checkInputs,
    git,
    manifest,
    protectedSnapshot,
    verifyProtected,
    fileHash,
    sha256,
    requireGate,
    json,
} from "./inputs.mjs"
import { captureCommand, command } from "./artifact.mjs"
import { writeEvidence, same, strictKeys, evidencePath } from "./evidence.mjs"
import { INHERITED_ENVIRONMENT, validateProcess } from "./process-evidence.mjs"
import { recordedRoot } from "./recorded-root.mjs"
export const ENVIRONMENT_KEYS = INHERITED_ENVIRONMENT
export function competingProcesses(stdout, observerPid) {
    requireGate(
        Number.isSafeInteger(observerPid) && observerPid > 0,
        "PROVENANCE-ENVIRONMENT",
        "observer PID required",
    )
    const rows = stdout
        .trim()
        .split("\n")
        .map(line => {
            const m = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line)
            requireGate(
                m,
                "PROVENANCE-ENVIRONMENT",
                "malformed process inventory",
            )
            return { pid: +m[1], ppid: +m[2], args: m[3] }
        })
    requireGate(
        rows.some(r => r.pid === observerPid) &&
            new Set(rows.map(r => r.pid)).size === rows.length,
        "PROVENANCE-ENVIRONMENT",
        "observer missing or duplicate PID",
    )
    const ancestors = new Set([observerPid])
    let parent = observerPid
    while (
        (parent = rows.find(r => r.pid === parent)?.ppid) &&
        !ancestors.has(parent)
    )
        ancestors.add(parent)
    return rows
        .filter(
            r =>
                !ancestors.has(r.pid) &&
                /^(?:\S*\/)?(?:bun|node)(?:\s|$)/.test(r.args) &&
                (/selector-kernel-tournament\/(?:control-bundle|red-bundle|bundle|calibration|workloads|semantics|resources|source-memory|verification|admission-probe|control-contract-probe)\.mjs(?:\s|$)/.test(
                    r.args,
                ) ||
                    /(?:^|\/)(?:memory|semantic|workload|red)-worker\.mjs(?:\s|$)/.test(
                        r.args,
                    ) ||
                    /\/(?:timing-[CA]|memory|counter-workloads)\/worker\.mjs(?:\s|$)/.test(
                        r.args,
                    ) ||
                    /architecture\.memory|core-load\/.*(?:run-sample|runner|worker)|(?:^|\s)(?:bench|bench:bun|bench:node|benchmark)(?:\s|$)/.test(
                        r.args,
                    )),
        )
        .map(r => ({
            pid: r.pid,
            ppid: r.ppid,
            invocationSha256: sha256(r.args),
        }))
}
export function environmentObservation() {
    requireGate(
        platform() === "darwin",
        "PROVENANCE-PLATFORM",
        "this recorded runner supports the macOS power/thermal protocol",
    )
    const power = captureCommand(["pmset", "-g", "batt"], ROOT),
        thermal = captureCommand(["pmset", "-g", "therm"], ROOT),
        processes = captureCommand(
            ["ps", "-axo", "pid=,ppid=,comm=,etime=,%cpu="],
            ROOT,
        )
    for (const result of [power, thermal, processes])
        requireGate(
            result.status === 0 && !result.error,
            "PROVENANCE-ENVIRONMENT",
            "missing power, thermal, or process evidence",
        )
    const inventory = captureCommand(["ps", "-axo", "pid=,ppid=,args="], ROOT)
    requireGate(
        inventory.status === 0,
        "PROVENANCE-ENVIRONMENT",
        "missing benchmark inventory",
    )
    const competing = competingProcesses(inventory.stdout, process.pid)
    return {
        at: new Date().toISOString(),
        power,
        thermal,
        processes,
        inventory,
        observerPid: process.pid,
        competing,
    }
}
export function requireStableEnvironment(before, after) {
    for (const observation of [before, after]) {
        strictKeys(
            observation,
            [
                "at",
                "power",
                "thermal",
                "processes",
                "inventory",
                "observerPid",
                "competing",
            ],
            "PROVENANCE-ENVIRONMENT",
        )
        for (const key of ["power", "thermal", "processes", "inventory"])
            validateProcess(observation[key], { cwd: recordedRoot() })
        same(
            observation.inventory.argv,
            ["ps", "-axo", "pid=,ppid=,args="],
            "PROVENANCE-ENVIRONMENT",
            "raw process inventory command differs",
        )
        same(
            observation.competing,
            competingProcesses(
                observation.inventory.stdout,
                observation.observerPid,
            ),
            "PROVENANCE-ENVIRONMENT",
            "benchmark classification differs from raw argv inventory",
        )
        requireGate(
            Array.isArray(observation.competing) &&
                observation.competing.length === 0,
            "ENVIRONMENT-INVALIDATED",
            "competing benchmark process",
        )
    }
    requireGate(
        before.power.stdout.includes("'AC Power'") &&
            after.power.stdout.includes("'AC Power'"),
        "ENVIRONMENT-INVALIDATED",
        "AC power absent or lost",
    )
    requireGate(
        before.thermal.stdout === after.thermal.stdout,
        "ENVIRONMENT-INVALIDATED",
        "thermal observation changed; invalidate the whole lane",
    )
}
export function captureProvenance({
    foundationSha = git(["rev-parse", "HEAD"]),
    candidateRoot = ROOT,
    kind = "control",
    candidateSha = manifest.control.gitSha,
} = {}) {
    assertClean()
    assertClean(candidateRoot)
    const inputs = checkInputs()
    requireGate(
        git(["rev-parse", `${foundationSha}^{commit}`]) === foundationSha,
        "PROVENANCE-FOUNDATION",
        "unknown foundation",
    )
    if (kind === "candidate")
        requireGate(
            git(["rev-parse", "HEAD"], candidateRoot) === candidateSha,
            "PROVENANCE-CANDIDATE-HEAD",
            "build SHA differs from candidate HEAD",
        )
    else
        requireGate(
            kind === "control" && candidateSha === manifest.control.gitSha,
            "PROVENANCE-CONTROL",
            "unknown control",
        )
    const node = JSON.parse(
            command(["node", "-p", "JSON.stringify(process.versions)"], ROOT),
        ),
        bun = JSON.parse(
            command(
                [
                    "bun",
                    "-e",
                    "console.log(JSON.stringify({versions:process.versions,revision:Bun.revision}))",
                ],
                ROOT,
            ),
        )
    const environment = environmentObservation()
    requireStableEnvironment(environment, environment)
    const protectedInputs = verifyProtected(candidateRoot, foundationSha)
    same(
        protectedSnapshot().files,
        protectedInputs.files,
        "PROVENANCE-PROTECTED-PATH",
        "working inputs differ from frozen foundation",
    )
    return {
        schemaVersion: 3,
        kind,
        foundation: {
            gitSha: foundationSha,
            ...inputs,
            protectedPathsSha256: protectedInputs.sha256,
        },
        protectedInputs,
        candidateRoot,
        candidateSha,
        candidateRuntimeTree: git(
            ["rev-parse", `${candidateSha}:packages/valdres/src`],
            candidateRoot,
        ),
        repositoryDirty: false,
        runner: {
            platform: platform(),
            architecture: arch(),
            hardwareModel: command(["sysctl", "-n", "hw.model"], ROOT).trim(),
            cpuModel: cpus()[0].model,
            logicalCores: cpus().length,
            memoryBytes: totalmem(),
            osVersion: command(["sw_vers"], ROOT).trim(),
            node: node.node,
            v8: node.v8,
            bun: bun.versions.bun,
            javascriptCore: bun.versions.webkit,
            browser: null,
            powerSource: environment.power.stdout.trim(),
            thermalState: environment.thermal.stdout.trim(),
        },
        versions: { node, bun },
        environmentAllowlist: ENVIRONMENT_KEYS,
        environment,
        startedAt: new Date().toISOString(),
        harnessHead: git(["rev-parse", "HEAD"]),
    }
}
export function verifyProvenanceCurrent(value) {
    assertClean()
    assertClean(value.candidateRoot)
    requireGate(
        git(["rev-parse", "HEAD"]) === value.harnessHead,
        "PROVENANCE-HARNESS-HEAD",
        "harness changed during run",
    )
    if (value.kind === "candidate")
        requireGate(
            git(["rev-parse", "HEAD"], value.candidateRoot) ===
                value.candidateSha,
            "PROVENANCE-CANDIDATE-HEAD",
            "candidate changed",
        )
    same(
        protectedSnapshot().files,
        value.protectedInputs.files,
        "PROVENANCE-PROTECTED-PATH",
        "frozen input changed",
    )
    same(
        checkInputs(),
        Object.fromEntries(
            Object.entries(value.foundation).filter(
                ([key]) => !["gitSha", "protectedPathsSha256"].includes(key),
            ),
        ),
        "PROVENANCE-INPUT-HASH",
        "input identities changed",
    )
}
export function validatePlan(plan) {
    strictKeys(
        plan,
        [
            "schemaVersion",
            "kind",
            "id",
            "revision",
            "stage",
            "gitSha",
            "intendedWorkloads",
            "algorithmicConstants",
        ],
        "PLAN-SCHEMA",
    )
    requireGate(
        plan.schemaVersion === 3 &&
            ["C", "A", "shiftx", "integration"].includes(plan.stage) &&
            Number.isInteger(plan.revision) &&
            plan.revision >= 1 &&
            /^[a-f0-9]{40}$/.test(plan.gitSha),
        "PLAN-SCHEMA",
        "invalid plan identity",
    )
    const implementation = manifest.implementations.find(i => i.id === plan.id)
    requireGate(
        implementation && implementation.kind === plan.kind,
        "PLAN-ID",
        "unknown implementation",
    )
    requireGate(
        Array.isArray(plan.intendedWorkloads) &&
            new Set(plan.intendedWorkloads).size ===
                plan.intendedWorkloads.length,
        "PLAN-INTENT",
        "duplicate or absent intent",
    )
    if (plan.kind === "control")
        requireGate(
            plan.id === "beta36-control" &&
                plan.intendedWorkloads.length === 0 &&
                plan.gitSha === manifest.control.gitSha,
            "PLAN-CONTROL",
            "control cannot declare intended wins",
        )
    else {
        requireGate(
            plan.intendedWorkloads.length >= 1 &&
                plan.intendedWorkloads.length <= 3,
            "PLAN-INTENT",
            "requires one to three IDs",
        )
        for (const id of plan.intendedWorkloads)
            requireGate(
                manifest.performanceWorkloads.some(
                    r =>
                        r.id === id &&
                        r.requiredAt.includes(plan.stage === "C" ? "C" : "A"),
                ),
                "PLAN-INTENT",
                id,
            )
    }
    requireGate(
        Array.isArray(plan.algorithmicConstants),
        "PLAN-CONSTANTS",
        "missing constants",
    )
    const constants = new Set()
    for (const item of plan.algorithmicConstants) {
        strictKeys(item, ["name", "value", "rationale"], "PLAN-CONSTANTS")
        requireGate(
            typeof item.name === "string" &&
                item.name &&
                !constants.has(item.name) &&
                typeof item.rationale === "string" &&
                item.rationale,
            "PLAN-CONSTANTS",
            "unnamed, duplicate, or unexplained constant",
        )
        constants.add(item.name)
    }
}
export function freezePlan(root, plan) {
    validatePlan(plan)
    const artifact = writeEvidence(
        root,
        plan.kind === "control" ? "control-plan.json" : "candidate-plan.json",
        plan,
    )
    return artifact
}
export function verifyFrozenPlan(root, artifact) {
    strictKeys(artifact, ["path", "sha256", "bytes"], "PLAN-REFERENCE")
    const file = evidencePath(root, artifact.path)
    requireGate(
        ["candidate-plan.json", "control-plan.json"].includes(artifact.path),
        "PLAN-REFERENCE",
        "invalid plan reference",
    )
    requireGate(
        fileHash(file) === artifact.sha256,
        "PROVENANCE-INTENT-HASH",
        "predeclared intent changed after run creation",
    )
    requireGate(
        lstatSync(file).size === artifact.bytes,
        "PLAN-REFERENCE",
        "plan byte count differs",
    )
    const plan = json(join(root, artifact.path))
    validatePlan(plan)
    return plan
}
