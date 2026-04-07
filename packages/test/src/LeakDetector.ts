import { generateHeapSnapshot } from "bun"

/**
 * Bun-native memory leak detector using FinalizationRegistry.
 * Replaces jest-leak-detector which requires node:v8 setFlagsFromString.
 *
 * Mirrors jest-leak-detector's approach: FinalizationRegistry tracks when
 * the object is garbage collected. Uses Bun.gc(true) and a heap snapshot
 * fallback for reliable finalization across environments.
 *
 * Usage:
 *   const detector = new LeakDetector(someObject)
 *   someObject = undefined
 *   expect(await detector.isLeaking()).toBe(false)
 */
export class LeakDetector {
    private _isReferenceBeingHeld = true
    private readonly _finalizationRegistry: FinalizationRegistry<undefined>

    constructor(value: unknown) {
        this._finalizationRegistry = new FinalizationRegistry(() => {
            this._isReferenceBeingHeld = false
        })
        this._finalizationRegistry.register(value as object, undefined)
        value = null
    }

    async isLeaking(): Promise<boolean> {
        Bun.gc(true)
        for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 0))
        }
        if (this._isReferenceBeingHeld) {
            // Triggering a heap snapshot is more aggressive than just gc().
            // This often causes pending FinalizationRegistry callbacks to fire.
            generateHeapSnapshot()
            Bun.gc(true)
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 0))
            }
        }
        return this._isReferenceBeingHeld
    }
}
