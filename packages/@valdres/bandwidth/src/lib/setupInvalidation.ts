import { globalStore } from "valdres"
import { invalidateOnAtom } from "../atoms/invalidateOnAtom"
import { invalidateMeasurement } from "../utils/invalidateMeasurement"

// Exported only so the test-reset helper (`test/setup/resetGlobals.ts`) can
// clear the one-shot guard and active subscriptions between tests.
export const __invalidationState: {
    setupDone: boolean
    watcherUnsubs: Array<() => void>
    rewireUnsub: (() => void) | null
} = {
    setupDone: false,
    watcherUnsubs: [],
    rewireUnsub: null,
}

export const setupInvalidation = (): void => {
    if (__invalidationState.setupDone) return
    __invalidationState.setupDone = true

    const rewire = () => {
        for (const unsub of __invalidationState.watcherUnsubs) unsub()
        __invalidationState.watcherUnsubs = []
        const list = globalStore.get(invalidateOnAtom)
        for (const a of list) {
            __invalidationState.watcherUnsubs.push(
                globalStore.sub(a, () => invalidateMeasurement()),
            )
        }
    }

    __invalidationState.rewireUnsub = globalStore.sub(invalidateOnAtom, rewire)
    rewire()
}

// Auto-wire at module load so setting `invalidateOnAtom` triggers invalidation
// without first requiring a read of a speed atom. Guarded against re-entry.
setupInvalidation()
