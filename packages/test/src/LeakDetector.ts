import { generateHeapSnapshot } from "bun"
import { fullGC, releaseWeakRefs } from "bun:jsc"

/**
 * Bun-native memory leak detector using WeakRef + bun:jsc primitives.
 *
 * Strategy: repeated generateHeapSnapshot() rounds to force full reachability
 * analysis. Each snapshot walks the entire heap, which is essential for
 * triggering WeakMap ephemeron cleanup in JSC. Lightweight GC rounds without
 * snapshots are insufficient — WeakMap entries are only cleared when the
 * engine performs a full reachability trace.
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
