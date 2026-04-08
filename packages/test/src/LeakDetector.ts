import { generateHeapSnapshot } from "bun"

/**
 * Bun-native memory leak detector using WeakRef.
 * Replaces jest-leak-detector which requires node:v8 setFlagsFromString.
 *
 * Uses WeakRef.deref() to directly check whether the object has been
 * garbage collected, which is more reliable than FinalizationRegistry
 * callbacks whose timing is non-deterministic. Multiple rounds of
 * Bun.gc(true) and heap snapshots aggressively encourage collection,
 * especially for objects behind WeakMap indirection.
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
            Bun.gc(true)
            // A real timer delay (not just a microtask yield) gives the
            // runtime time to process weak reference cleanup between rounds.
            await new Promise(resolve => setTimeout(resolve, 1))
            if (this._ref.deref() === undefined) return false
            // Heap snapshots force more aggressive GC, helping clear
            // WeakMap/WeakRef entries that survive a simple gc() pass.
            generateHeapSnapshot()
            Bun.gc(true)
            await new Promise(resolve => setTimeout(resolve, 1))
            if (this._ref.deref() === undefined) return false
        }
        return this._ref.deref() !== undefined
    }
}
