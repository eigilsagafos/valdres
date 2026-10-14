import { test, after } from "node:test"
import { writeFileSync, mkdirSync, copyFileSync, writeSync } from "node:fs"
import { join } from "node:path"
import { writeHeapSnapshot } from "node:v8"
import { runCase } from "./case.mjs"
const createStore = process.env.REPRO_STAGE === "valdres"
    ? (await import("./valdres.mjs")).store : undefined
const out = process.env.VALDRES_RETENTION_CAPTURE_DIR
mkdirSync(out, { recursive: true })
const marker = Object.freeze({})
const targets = [], snapshots = {}, phases = []
function phase(label, name, round = -1) {
    const line = `[retention-phase] t=${performance.now().toFixed(3)} label=${label} phase=${name} round=${round}\n`
    phases.push(line)
    writeSync(2, line)
}
class Detector {
    constructor(value, label) {
        this.ref = new WeakRef(value)
        const property = `__valdresRetentionTarget_${targets.length}_${label}`
        Object.defineProperty(value, property, { value: marker })
        targets.push({ label, property })
    }
    async isLeaking(maxRounds = 50, label) {
        phase(label, "initial-sleep-enter")
        await new Promise(resolve => setTimeout(resolve, 0))
        phase(label, "initial-sleep-return")
        for (let round = 0; round < maxRounds; round++) {
            phase(label, "gc-1-enter", round)
            global.gc()
            phase(label, "gc-1-return", round)
            if (round > 0) {
                phase(label, "snapshot-enter", round)
                // V8 has no JSC ClearKeptObjects; the preceding task boundary
                // clears WeakRef kept objects. Snapshot is synchronous; disk I/O
                // is included in this engine adapter's cost, unlike Bun buffering.
                const file = `${label}-latest.heapsnapshot`
                writeHeapSnapshot(join(out, file))
                if (!snapshots[label]) copyFileSync(join(out, file), join(out, `${label}-first.heapsnapshot`))
                snapshots[label] = { file, round, time: performance.now() }
                phase(label, "snapshot-return", round)
            }
            phase(label, "gc-2-enter", round)
            global.gc()
            phase(label, "gc-2-return", round)
            if (this.ref.deref() === undefined) { phase(label, "collected", round); return false }
            phase(label, "live-round-sleep-enter", round)
            await new Promise(resolve => setTimeout(resolve, 0))
            phase(label, "live-round-sleep-return", round)
        }
        phase(label, "rounds-exhausted")
        return this.ref.deref() !== undefined
    }
}
after(() => {
    writeFileSync(join(out, "manifest.json"), JSON.stringify({ argv: process.argv, versions: process.versions, platform: process.platform, arch: process.arch, targets, snapshots, limitation: "A snapshot reports only its engine-visible roots." }, null, 2))
    writeFileSync(join(out, "phases.log"), phases.join(""))
})
test(`reduction ${process.env.REPRO_STAGE} retain=${process.env.REPRO_RETAIN}`, { timeout: 5000 }, async () => {
    await runCase(Detector, phase, createStore)
})
