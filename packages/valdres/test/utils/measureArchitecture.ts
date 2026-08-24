import {
    createArchitectureInstrumentation,
    type ArchitectureCounters,
} from "../../src/lib/architectureInstrumentation"
import { getStoreData } from "../../src/lib/getStoreData"
import type { Store } from "../../src/types/Store"
import type { StoreData } from "../../src/types/StoreData"

/**
 * Run `operation` with the structural counters attached to every store in the
 * given trees and return what it cost. One call = one measurement window.
 *
 * These counters are the only deterministic way to assert how much work the
 * engine did: unit tests assert VALUES, and a redundant evaluation returns the
 * right value, so nothing but a count can see it. Timing benchmarks can, but
 * only for a shape someone already wrote — which is how the beta.20 "selector
 * re-evaluates on every read" regression shipped (see
 * lib/selectorMemoizationGate.test.ts).
 */
export const measureArchitecture = (
    stores: Store | Store[],
    operation: () => void,
): ArchitectureCounters => {
    const instrumentation = createArchitectureInstrumentation()
    const roots = (Array.isArray(stores) ? stores : [stores]).map(getStoreData)
    const attached = new Set<StoreData>()

    const attachTree = (root: StoreData) => {
        const queue = [root]
        for (let i = 0; i < queue.length; i++) {
            const data = queue[i]!
            if (attached.has(data)) continue
            attached.add(data)
            data.architectureInstrumentation = instrumentation
            for (const child of data.scopes.values()) queue.push(child)
        }
    }

    for (const root of roots) attachTree(root)
    try {
        operation()
    } finally {
        // Include scopes created during the measured operation before removing
        // the collector, so no test-only strong reference survives the window.
        for (const root of roots) attachTree(root)
        for (const data of attached) {
            delete data.architectureInstrumentation
        }
    }
    return { ...instrumentation.counters }
}
