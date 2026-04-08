import { generateHeapSnapshot } from "bun"
import { fullGC, releaseWeakRefs } from "bun:jsc"

/**
 * Bun-native memory leak detector using WeakRef + bun:jsc primitives.
 *
 * Combines generateHeapSnapshot() (forces the engine to walk the full heap
 * and determine reachability) with releaseWeakRefs() from bun:jsc (explicitly
 * processes pending weak reference cleanup that GC alone defers). Polls in a
 * loop with Bun.sleep() yields, matching patterns from Bun's own test suite.
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
            fullGC()
            releaseWeakRefs()
            generateHeapSnapshot()
            fullGC()
            releaseWeakRefs()
            await Bun.sleep(0)
            if (this._ref.deref() === undefined) return false
        }
        return this._ref.deref() !== undefined
    }
}
