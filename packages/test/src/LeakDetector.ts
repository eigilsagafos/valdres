import { generateHeapSnapshot } from "bun"
import { fullGC, releaseWeakRefs } from "bun:jsc"

/**
 * Bun-native memory leak detector using WeakRef + bun:jsc primitives.
 *
 * Temporarily sets gcAggressionLevel to maximum (2) during checking, which
 * makes JSC's GC run far more aggressively — critical for CI environments
 * (Linux) where the default GC is lazier about processing WeakMap entries
 * and ephemeron cycles. Uses Bun.sleep() yields with real delays between
 * rounds, matching Bun's own test patterns (which sleep 10-50ms per round).
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
        const prevLevel = Bun.unsafe.gcAggressionLevel()
        Bun.unsafe.gcAggressionLevel(2)
        try {
            for (let round = 0; round < 20; round++) {
                fullGC()
                releaseWeakRefs()
                generateHeapSnapshot()
                fullGC()
                releaseWeakRefs()
                await Bun.sleep(10)
                if (this._ref.deref() === undefined) return false
            }
            return this._ref.deref() !== undefined
        } finally {
            Bun.unsafe.gcAggressionLevel(prevLevel)
        }
    }
}
