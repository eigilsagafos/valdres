import type { State } from "../../types/State"
import type { GraphNode, StoreData } from "../../types/StoreData"

/**
 * Per-node graph metadata, in ONE record per state instead of six parallel
 * WeakMaps keyed by the same states.
 *
 * Why this shape. Every graph operation that matters is a walk over a
 * dependency closure, and each node of that walk needs several of these fields
 * at once: `noteDependencyAdded` alone read `dependencyOrder` twice,
 * `cycleRiskInClosure` once and `mountInClosure` twice, so committing one edge
 * cost six WeakMap lookups. A WeakMap lookup is ~30ns and a field read is ~1ns,
 * so the split tables, not the algorithms, were the cost: subscribe/unsubscribe
 * churn under write load measured 25.3M table operations against ~2.9M actual
 * mutations, and 8.7x redundant lookups is what made a remount ~60x more
 * expensive than the graph work it performs.
 *
 * The fields are deliberately all scalars. Nothing here owns a container, so a
 * node record is a fixed shape that stays monomorphic, and the absence of a
 * record is a valid "all defaults" answer — which is why reads go through
 * `peekGraphNode` and only mutations allocate.
 */

/** Sentinel for `order` / `acyclicAt` / `cleanedAt`: never assigned. */
export const UNSET = -1

const createGraphNode = (): GraphNode => ({
    live: 0,
    mountInClosure: false,
    cycleRisk: false,
    order: UNSET,
    acyclicAt: UNSET,
    cleanedAt: UNSET,
})

/** The record for `state`, or `undefined` when it has never needed one. Reads
 *  must use this and fall back to the documented defaults: allocating on a read
 *  would put a record on every state a walk merely passes through. */
export const peekGraphNode = (
    state: WeakKey,
    data: StoreData,
): GraphNode | undefined => data.graphNodes.get(state)

/** The record for `state`, created if absent. For mutations only. */
export const graphNodeFor = (state: WeakKey, data: StoreData): GraphNode => {
    let node = data.graphNodes.get(state)
    if (node === undefined) {
        node = createGraphNode()
        data.graphNodes.set(state, node)
    }
    return node
}

/** Live dependents of `state`; 0 when it has no record. */
export const liveDependents = (state: State, data: StoreData): number =>
    data.graphNodes.get(state)?.live ?? 0
