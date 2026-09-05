import { requireGate, sha256, exactRows } from "./inputs.mjs"
import { strictKeys, same } from "./evidence.mjs"
export const INHERITED_ENVIRONMENT = [
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
]
export const PROCESS_KEYS = [
    "argv",
    "cwd",
    "environment",
    "pid",
    "startedAt",
    "endedAt",
    "status",
    "signal",
    "error",
    "stdout",
    "stderr",
]
export function validateProcess(value, { argv, cwd, success = true } = {}) {
    strictKeys(value, PROCESS_KEYS, "PROVENANCE-PROCESS-SCHEMA")
    requireGate(
        Array.isArray(value.argv) &&
            value.argv.length > 0 &&
            value.argv.every(v => typeof v === "string") &&
            typeof value.cwd === "string",
        "PROVENANCE-INVOCATION",
        "invalid invocation",
    )
    if (argv)
        same(value.argv, argv, "PROVENANCE-INVOCATION", "exact command differs")
    if (cwd !== undefined)
        same(
            value.cwd,
            cwd,
            "PROVENANCE-INVOCATION",
            "working directory differs",
        )
    requireGate(
        value.environment &&
            typeof value.environment === "object" &&
            !Array.isArray(value.environment),
        "PROVENANCE-ENVIRONMENT",
        "missing environment",
    )
    for (const [key, v] of Object.entries(value.environment))
        requireGate(
            [...INHERITED_ENVIRONMENT, "NODE_ENV", "FORCE_COLOR"].includes(
                key,
            ) && typeof v === "string",
            "PROVENANCE-ENVIRONMENT",
            "unknown environment key " + key,
        )
    requireGate(
        value.environment.NODE_ENV === "production" &&
            value.environment.FORCE_COLOR === "0",
        "PROVENANCE-ENVIRONMENT",
        "runtime conditions changed",
    )
    requireGate(
        Number.isSafeInteger(value.pid) &&
            value.pid > 0 &&
            typeof value.stdout === "string" &&
            typeof value.stderr === "string" &&
            /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.startedAt) &&
            new Date(value.startedAt).toISOString() === value.startedAt &&
            new Date(value.endedAt).toISOString() === value.endedAt &&
            Date.parse(value.endedAt) >= Date.parse(value.startedAt),
        "PROVENANCE-PROCESS-SCHEMA",
        "invalid PID, output, or timestamps",
    )
    if (success)
        requireGate(
            value.status === 0 && value.signal === null && value.error === null,
            "PROVENANCE-PROCESS-FAILED",
            value.argv.join(" "),
        )
    return {
        stdoutSha256: sha256(value.stdout),
        stderrSha256: sha256(value.stderr),
    }
}
