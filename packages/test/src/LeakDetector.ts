import { generateHeapSnapshot } from "bun"
import { releaseWeakRefs } from "bun:jsc"

/**
 * Bun-native memory leak detector using WeakRef.
 *
 * The ECMAScript [[KeptAlive]] list pins WeakRef targets until a microtask
 * checkpoint clears it. Inside a synchronous test, that pin survives
 * across GCs and looks like a leak. releaseWeakRefs() invokes JSC's
 * ClearKeptObjects directly so the target is actually collectable.
 * Order matters: releaseWeakRefs MUST run before the GC.
 *
 * The remaining residue under heap pressure is JSC's conservative stack
 * scan retaining recently-dead allocations through stale callee-saved
 * register spills. We work around it with two GC passes per round, an
 * intermediate generateHeapSnapshot (which advances the visitor and tends
 * to overwrite spill slots), and a Bun.sleep(0) macrotask gap between
 * rounds.
 *
 * Usage:
 *   const detector = new LeakDetector(someObject)
 *   someObject = undefined
 *   expect(await detector.isLeaking()).toBe(false)
 */
export class LeakDetector {
    private _ref: WeakRef<object>

    constructor(value: object) {
        this._ref = new WeakRef(value)
    }

    async isLeaking(): Promise<boolean> {
        for (let round = 0; round < 10; round++) {
            releaseWeakRefs()
            Bun.gc(true)
            if (round > 0) generateHeapSnapshot()
            releaseWeakRefs()
            Bun.gc(true)
            if (this._ref.deref() === undefined) return false
            await Bun.sleep(0)
        }
        return this._ref.deref() !== undefined
    }
}
