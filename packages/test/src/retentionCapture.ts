import type { HeapSnapshot } from "bun"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

// Diagnostic data only: never store a target, WeakRef, detector or callback here.
// The outgoing marker edge identifies a target in the existing Inspector-format
// snapshots without introducing an incoming strong edge or changing snapshot/GC
// calls. It does change the target's shape, so capture is explicitly opt-in.
const directory = process.env.VALDRES_RETENTION_CAPTURE_DIR
const marker = Object.freeze({})
const scalarKeys: Record<string, string> = {}
const targets: { label: string; property: string; match: "marker" | "scalar-key-candidates" }[] = []
const phases: string[] = []
const phaseLimit = 20_000
let phaseCount = 0
type Selection = { label: string; round: number; time: number; snapshot: HeapSnapshot }
const selected: Partial<Record<"collection" | "onCommit", { first: Selection; latest: Selection }>> = {}

export function markRetentionTarget(value: object, label?: string): void {
    if (!directory || label === undefined) return
    const property = `__valdresRetentionTarget_${targets.length}_${label}`
    if (Object.isExtensible(value)) {
        Object.defineProperty(value, property, { value: marker })
        targets.push({ label, property, match: "marker" })
    } else {
        // Collection rows are frozen. Keep only their existing primitive key,
        // never the row. Incoming `key` edges identify candidates offline; do
        // not pretend a shared string uniquely identifies a row across domains.
        const key: unknown = Object.getOwnPropertyDescriptor(value, "key")?.value
        if (typeof key !== "string") throw new Error("Diagnostic target needs a string key")
        scalarKeys[property] = key
        targets.push({ label, property, match: "scalar-key-candidates" })
    }
}

export function captureRetentionPhase(line: string): void {
    if (!directory) return
    phases[phaseCount++ % phaseLimit] = line
}

// Called with the result of an already-required snapshot, never with its target.
// Keep at most four graphs per process (first/latest for each affected test).
// Graphs contain only numbers/strings/arrays, not live heap references.
export function captureRetentionSnapshot(snapshot: HeapSnapshot, label: string | undefined, round: number): void {
    if (!directory || label === undefined) return
    const family = label === "aborted" || label === "committed" ? "onCommit"
        : /^(present|absent)-(owned|released)$/.test(label) ? "collection" : undefined
    if (family === undefined) return
    const record = { label, round, time: performance.now(), snapshot }
    const previous = selected[family]
    if (previous) previous.latest = record
    else selected[family] = { first: record, latest: record }
}

// Called by the affected files' afterAll hooks, also after an assertion failure
// or test timeout. Bun's test runner does not reliably emit process `exit`.
// Serialization/I/O and releasing the buffered graphs are outside assertions.
// SIGKILL/process crashes cannot run the hook; stderr phases remain in job logs.
export function flushRetentionCapture(): void {
    if (directory) {
        const output = join(directory, `${process.pid}-${Date.now()}`)
        mkdirSync(output, { recursive: true })
        const snapshots: { file: string; label: string; round: number; time: number }[] = []
        for (const [family, records] of Object.entries(selected)) {
            for (const slot of ["first", "latest"] as const) {
                const { snapshot, ...metadata } = records[slot]
                const file = `${family}-${slot}.json`
                writeFileSync(join(output, file), JSON.stringify(snapshot))
                snapshots.push({ file, ...metadata })
            }
        }
        const start = phaseCount > phaseLimit ? phaseCount % phaseLimit : 0
        writeFileSync(join(output, "phases.log"), [...phases.slice(start), ...phases.slice(0, start)].join(""))
        writeFileSync(join(output, "manifest.json"), JSON.stringify({
            pid: process.pid, argv: process.argv,
            platform: process.platform, arch: process.arch,
            bun: Bun.version, bunRevision: Bun.revision, versions: process.versions,
            targets, snapshots, phaseCount, droppedPhases: Math.max(0, phaseCount - phaseLimit),
            limitation: "No reported root is not proof of no root; conservative roots may be omitted.",
        }, null, 2))
        delete selected.collection
        delete selected.onCommit
        phases.length = 0
        phaseCount = 0
    }
}
