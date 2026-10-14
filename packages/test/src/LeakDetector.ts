import { generateHeapSnapshot } from "bun"
import { releaseWeakRefs } from "bun:jsc"
import { writeSync } from "node:fs"
import { captureRetentionPhase, captureRetentionSnapshot, markRetentionTarget } from "./retentionCapture"

// Temporary, opt-in diagnostic: write only scalar phase data, retaining no
// test state, target, detector or callback. Synchronous stderr survives timeout.
export function retentionPhase(label: string | undefined, phase: string, round = -1): void {
    if (label === undefined) return
    const line = `[retention-phase] t=${performance.now().toFixed(3)} label=${label} phase=${phase} round=${round}\n`
    writeSync(2, line)
    captureRetentionPhase(line)
}

/**
 * Bun-native memory leak detector using WeakRef.
 *
 * The ECMAScript [[KeptAlive]] list pins WeakRef targets until a microtask
 * checkpoint clears it. Inside a synchronous test, that pin survives
 * across GCs and looks like a leak. releaseWeakRefs() invokes JSC's
 * ClearKeptObjects directly so the target is actually collectable.
 * Order matters: releaseWeakRefs MUST run before the GC.
 *
 * Collection is nondeterministic. Existing CI timeouts have not established
 * an application-owned root or an engine cause. These historical two GC passes,
 * intervening snapshot and task gaps are retained as the bounded probe, not a
 * proof that conservative stack scanning caused a particular timeout.
 *
 * Usage:
 *   const detector = new LeakDetector(someObject)
 *   someObject = undefined
 *   expect(await detector.isLeaking()).toBe(false)
 *
 * Pass a smaller `maxRounds` when deliberately asserting that a strong
 * reference remains; dead-object checks use the wider default to allow eventual collection within the existing bounded probe.
 */
export class LeakDetector {
    private _ref: WeakRef<object>

    constructor(value: object, diagnosticTarget?: string) {
        this._ref = new WeakRef(value)
        markRetentionTarget(value, diagnosticTarget)
    }

    async isLeaking(maxRounds = 50, diagnosticLabel?: string): Promise<boolean> {
        // Preserve the existing host-task opportunity before checking a WeakRef.
        // A task gap does not guarantee collection or explain prior timeouts.
        retentionPhase(diagnosticLabel, "initial-sleep-enter")
        await Bun.sleep(0)
        retentionPhase(diagnosticLabel, "initial-sleep-return")
        for (let round = 0; round < maxRounds; round++) {
            retentionPhase(diagnosticLabel, "release-weak-refs-1-enter", round)
            releaseWeakRefs()
            retentionPhase(diagnosticLabel, "gc-1-enter", round)
            Bun.gc(true)
            retentionPhase(diagnosticLabel, "gc-1-return", round)
            if (round > 0) {
                retentionPhase(diagnosticLabel, "snapshot-enter", round)
                captureRetentionSnapshot(generateHeapSnapshot(), diagnosticLabel, round)
                retentionPhase(diagnosticLabel, "snapshot-return", round)
            }
            retentionPhase(diagnosticLabel, "release-weak-refs-2-enter", round)
            releaseWeakRefs()
            retentionPhase(diagnosticLabel, "gc-2-enter", round)
            Bun.gc(true)
            retentionPhase(diagnosticLabel, "gc-2-return", round)
            if (this._ref.deref() === undefined) {
                retentionPhase(diagnosticLabel, "collected", round)
                return false
            }
            retentionPhase(diagnosticLabel, "live-round-sleep-enter", round)
            await Bun.sleep(0)
            retentionPhase(diagnosticLabel, "live-round-sleep-return", round)
        }
        retentionPhase(diagnosticLabel, "rounds-exhausted")
        return this._ref.deref() !== undefined
    }
}
