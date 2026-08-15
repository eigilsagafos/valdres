import type { Selector } from "../../types/Selector"
import type { StoreData } from "../../types/StoreData"
import { IS_PROD } from "../IS_PROD"
import {
    acquireSchedulerWorkspace,
    releaseSchedulerWorkspace,
    type SchedulerWorkspace,
} from "./workspace"

export const SCHEDULE_CHANGED = 1
export const SCHEDULE_GRAPH_CHANGED = 2

const NEEDS_EVAL = 1
const SETTLED = 2
const RESWEEP = 4
const ACTIVE = 8
const SEARCHED = 16
const SEARCH_ADDED = 32
const FLAG_BASE = 64

type SettleSelector<Context> = (
    selector: Selector,
    data: StoreData,
    context: Context,
) => number

type PropagateSelector<Context> = (
    parent: Selector,
    child: Selector,
    context: Context,
) => void

// Packed metadata is uint32: six flag bits leave a ~67M-node pending ceiling.
const flagsOf = (value: number): number => value & 63
const pendingOf = (value: number): number => value >>> 6
const withFlags = (value: number, flags: number): number =>
    pendingOf(value) * FLAG_BASE + flags
const withPending = (value: number, pending: number): number =>
    pending * FLAG_BASE + flagsOf(value)

const recordEdge = (data: StoreData) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.dependencyEdgeVisits++
}

const recordEnqueue = (data: StoreData) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.schedulerQueueEnqueues++
}

const recordDequeue = (data: StoreData) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.schedulerQueueDequeues++
}

const recordCycleFallback = (data: StoreData) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.schedulerCycleFallbacks++
}

const markNeedsEval = (selector: Selector, frame: SchedulerWorkspace): void => {
    const value = frame.meta.get(selector)
    if (value === undefined) return
    frame.meta.set(selector, withFlags(value, flagsOf(value) | NEEDS_EVAL))
}

const addClosureNode = (
    selector: Selector,
    needsEval: boolean,
    frame: SchedulerWorkspace,
): boolean => {
    const value = frame.meta.get(selector)
    if (value !== undefined) {
        if (needsEval) markNeedsEval(selector, frame)
        return false
    }
    frame.meta.set(selector, needsEval ? NEEDS_EVAL : 0)
    frame.nodes.push(selector)
    return true
}

const discoverClosure = (
    initial: Iterable<Selector>,
    frame: SchedulerWorkspace,
    data: StoreData,
) => {
    for (const selector of initial) addClosureNode(selector, true, frame)
    for (let index = 0; index < frame.nodes.length; index++) {
        const selector = frame.nodes[index]!
        const downstream = data.stateDependents.get(selector)
        if (!downstream) continue
        for (const child of downstream) {
            if (!IS_PROD) recordEdge(data)
            addClosureNode(child as Selector, false, frame)
        }
    }
}

const initializeReadyQueue = (frame: SchedulerWorkspace, data: StoreData) => {
    for (const selector of frame.nodes) {
        let pending = 0
        const deps = data.stateDependencies.get(selector)
        if (deps) {
            for (const dep of deps) {
                if (!IS_PROD) recordEdge(data)
                if (frame.meta.has(dep as Selector)) pending++
            }
        }
        const value = frame.meta.get(selector)!
        frame.meta.set(selector, withPending(value, pending))
        if (pending === 0) {
            frame.ready.push(selector)
            if (!IS_PROD) recordEnqueue(data)
        }
    }
}

const markForResweep = (
    selector: Selector,
    frame: SchedulerWorkspace,
    data: StoreData,
) => {
    const value = frame.meta.get(selector)
    if (value !== undefined && (flagsOf(value) & RESWEEP) !== 0) return
    if (value === undefined) frame.meta.set(selector, NEEDS_EVAL | RESWEEP)
    else
        frame.meta.set(
            selector,
            withFlags(value, flagsOf(value) | NEEDS_EVAL | RESWEEP),
        )
    frame.resweep.push(selector)
    if (!IS_PROD) recordEnqueue(data)

    // `resweep` doubles as the traversal queue. Every descendant is marked
    // once, so appending while iterating remains linear and allocation-free.
    for (let index = frame.resweep.length - 1; index < frame.resweep.length; ) {
        const current = frame.resweep[index++]!
        const downstream = data.stateDependents.get(current)
        if (!downstream) continue
        for (const childState of downstream) {
            if (!IS_PROD) recordEdge(data)
            const child = childState as Selector
            const childValue = frame.meta.get(child)
            if (
                childValue !== undefined &&
                (flagsOf(childValue) & RESWEEP) !== 0
            ) {
                continue
            }
            if (childValue === undefined) {
                frame.meta.set(child, NEEDS_EVAL | RESWEEP)
            } else {
                frame.meta.set(
                    child,
                    withFlags(
                        childValue,
                        flagsOf(childValue) | NEEDS_EVAL | RESWEEP,
                    ),
                )
            }
            frame.resweep.push(child)
            if (!IS_PROD) recordEnqueue(data)
        }
    }
}

const advance = <Context>(
    selector: Selector,
    changed: boolean,
    frame: SchedulerWorkspace,
    data: StoreData,
    context: Context,
    propagate: PropagateSelector<Context> | undefined,
): boolean => {
    let closureExpanded = false
    const downstream = data.stateDependents.get(selector)
    if (!downstream) return closureExpanded
    for (const childState of downstream) {
        if (!IS_PROD) recordEdge(data)
        const child = childState as Selector
        if (changed && propagate) propagate(selector, child, context)
        let childValue = frame.meta.get(child)
        if (childValue === undefined) {
            if (changed) {
                frame.meta.set(child, NEEDS_EVAL)
                frame.nodes.push(child)
                frame.ready.push(child)
                if (!IS_PROD) recordEnqueue(data)
                closureExpanded = true
            }
            continue
        }
        const flags = flagsOf(childValue)
        if ((flags & SETTLED) !== 0) {
            if (changed) markForResweep(child, frame, data)
            continue
        }
        const pending = Math.max(0, pendingOf(childValue) - 1)
        let nextFlags = flags
        if (changed) nextFlags |= NEEDS_EVAL
        childValue = pending * FLAG_BASE + nextFlags
        frame.meta.set(child, childValue)
        if (pending <= 0) {
            frame.ready.push(child)
            if (!IS_PROD) recordEnqueue(data)
        }
    }
    return closureExpanded
}

const settleReady = <Context>(
    frame: SchedulerWorkspace,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate: PropagateSelector<Context> | undefined,
): boolean => {
    let graphMutated = false
    let head = 0
    while (head < frame.ready.length) {
        const selector = frame.ready[head++]!
        if (!IS_PROD) recordDequeue(data)
        const value = frame.meta.get(selector)
        if (value === undefined) continue
        const flags = flagsOf(value)
        if ((flags & (SETTLED | RESWEEP)) !== 0) continue

        let result = 0
        if ((flags & NEEDS_EVAL) !== 0) {
            result = settle(selector, data, context)
            if ((result & SCHEDULE_GRAPH_CHANGED) !== 0) graphMutated = true
        }
        frame.meta.set(selector, withFlags(value, flags | SETTLED))
        if (
            advance(
                selector,
                (result & SCHEDULE_CHANGED) !== 0,
                frame,
                data,
                context,
                propagate,
            )
        ) {
            graphMutated = true
        }
    }
    return graphMutated
}

const activateStrandedWork = (
    frame: SchedulerWorkspace,
    graphMutated: boolean,
    data: StoreData,
) => {
    frame.ready.length = 0
    // Match the historical cycle boundary: a pre-existing stalled cycle does
    // not start a new fixpoint by itself. Only dependency replacement or an
    // out-of-closure materialization can invalidate the Kahn snapshot and arm
    // the stranded-region fallback.
    if (!graphMutated) return
    for (const selector of frame.nodes) {
        const value = frame.meta.get(selector)
        if (value === undefined) continue
        const flags = flagsOf(value)
        if (
            (flags & NEEDS_EVAL) !== 0 &&
            (flags & SETTLED) === 0 &&
            pendingOf(value) > 0
        ) {
            markForResweep(selector, frame, data)
        }
    }
    for (const selector of frame.resweep) {
        const value = frame.meta.get(selector)!
        frame.meta.set(selector, withFlags(value, flagsOf(value) | ACTIVE))
        frame.ready.push(selector)
    }
}

const hasActiveDependency = (
    selector: Selector,
    frame: SchedulerWorkspace,
    data: StoreData,
): boolean => {
    const deps = data.stateDependencies.get(selector)
    if (!deps) return false
    for (const dep of deps) {
        if (!IS_PROD) recordEdge(data)
        if (dep === selector) continue
        const value = frame.meta.get(dep as Selector)
        if (value !== undefined && (flagsOf(value) & ACTIVE) !== 0) {
            return true
        }
    }
    return false
}

const signalClosesCycle = (
    parent: Selector,
    child: Selector,
    frame: SchedulerWorkspace,
    data: StoreData,
): boolean => {
    if (parent === child) return true

    // Reuse the tail of `nodes` as frame-local search storage. This guard is
    // armed only after the fallback has spent a bounded settlement budget:
    // practical convergent cycles reach their fixpoint normally, while a
    // value-divergent cycle cannot keep the synchronous scheduler alive forever.
    const start = frame.nodes.length
    const mark = (selector: Selector) => {
        const value = frame.meta.get(selector)
        if (value === undefined) {
            frame.meta.set(selector, SEARCHED | SEARCH_ADDED)
        } else {
            frame.meta.set(
                selector,
                withFlags(value, flagsOf(value) | SEARCHED),
            )
        }
        frame.nodes.push(selector)
    }
    mark(parent)
    let closesCycle = false
    for (
        let index = start;
        index < frame.nodes.length && !closesCycle;
        index++
    ) {
        const selector = frame.nodes[index]!
        const deps = data.stateDependencies.get(selector)
        if (!deps) continue
        for (const depState of deps) {
            if (!IS_PROD) recordEdge(data)
            const dep = depState as Selector
            if (dep === child) {
                closesCycle = true
                break
            }
            const value = frame.meta.get(dep)
            if (value !== undefined && (flagsOf(value) & SEARCHED) !== 0) {
                continue
            }
            mark(dep)
        }
    }
    for (let index = start; index < frame.nodes.length; index++) {
        const selector = frame.nodes[index]!
        const value = frame.meta.get(selector)
        if (value === undefined) continue
        const flags = flagsOf(value)
        if ((flags & SEARCH_ADDED) !== 0) {
            frame.meta.delete(selector)
        } else {
            frame.meta.set(selector, withFlags(value, flags & ~SEARCHED))
        }
    }
    frame.nodes.length = start
    return closesCycle
}

const enqueueFallbackDownstream = <Context>(
    selector: Selector,
    frame: SchedulerWorkspace,
    data: StoreData,
    context: Context,
    propagate: PropagateSelector<Context> | undefined,
    suppressClosingCycle: boolean,
) => {
    const downstream = data.stateDependents.get(selector)
    if (!downstream) return
    for (const childState of downstream) {
        if (!IS_PROD) recordEdge(data)
        const child = childState as Selector
        if (propagate) propagate(selector, child, context)
        const value = frame.meta.get(child) ?? 0
        const flags = flagsOf(value)
        if ((flags & ACTIVE) !== 0) continue
        if (
            suppressClosingCycle &&
            signalClosesCycle(selector, child, frame, data)
        ) {
            continue
        }
        frame.meta.set(
            child,
            withFlags(value, flags | NEEDS_EVAL | RESWEEP | ACTIVE),
        )
        if ((flags & RESWEEP) === 0) frame.resweep.push(child)
        frame.ready.push(child)
        if (!IS_PROD) recordEnqueue(data)
    }
}

const settleFallbackSelector = <Context>(
    selector: Selector,
    frame: SchedulerWorkspace,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate: PropagateSelector<Context> | undefined,
    suppressClosingCycles: boolean,
) => {
    const value = frame.meta.get(selector) ?? 0
    frame.meta.set(selector, withFlags(value, flagsOf(value) & ~ACTIVE))
    if (!IS_PROD) recordDequeue(data)
    const result = settle(selector, data, context)
    if ((result & SCHEDULE_CHANGED) !== 0) {
        enqueueFallbackDownstream(
            selector,
            frame,
            data,
            context,
            propagate,
            suppressClosingCycles,
        )
    }
}

const settleStranded = <Context>(
    frame: SchedulerWorkspace,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate: PropagateSelector<Context> | undefined,
) => {
    let readyHead = 0
    let fallbackSettlements = 0
    const shouldSuppressClosingCycles = () =>
        fallbackSettlements >= Math.max(32, frame.resweep.length * 16)
    while (true) {
        frame.batch.length = 0
        while (readyHead < frame.ready.length) {
            const selector = frame.ready[readyHead++]!
            const value = frame.meta.get(selector)
            if (value !== undefined && (flagsOf(value) & ACTIVE) !== 0) {
                frame.batch.push(selector)
            }
        }
        frame.ready.length = 0
        readyHead = 0
        if (frame.batch.length === 0) return

        let progressed = false
        for (const selector of frame.batch) {
            const value = frame.meta.get(selector)
            if (value === undefined || (flagsOf(value) & ACTIVE) === 0) continue
            if (hasActiveDependency(selector, frame, data)) continue
            progressed = true
            settleFallbackSelector(
                selector,
                frame,
                data,
                context,
                settle,
                propagate,
                shouldSuppressClosingCycles(),
            )
            fallbackSettlements++
        }
        if (progressed) {
            for (const selector of frame.batch) {
                const value = frame.meta.get(selector)
                if (value !== undefined && (flagsOf(value) & ACTIVE) !== 0) {
                    frame.ready.push(selector)
                }
            }
            continue
        }

        // The remaining active region has no dependency-free node. Evaluate one
        // isolated insertion-order wave, matching the historical handling for
        // cyclic work. Clear current membership before evaluating the fixed
        // batch so changed edges enqueue into the next reusable queue, matching
        // the historical Set-based fixpoint behavior for convergent cycles.
        if (!IS_PROD) recordCycleFallback(data)
        for (const selector of frame.batch) {
            const value = frame.meta.get(selector)
            if (value !== undefined) {
                frame.meta.set(
                    selector,
                    withFlags(value, flagsOf(value) & ~ACTIVE),
                )
            }
        }
        for (const selector of frame.batch) {
            if (!IS_PROD) recordDequeue(data)
            const result = settle(selector, data, context)
            fallbackSettlements++
            if ((result & SCHEDULE_CHANGED) !== 0) {
                enqueueFallbackDownstream(
                    selector,
                    frame,
                    data,
                    context,
                    propagate,
                    shouldSuppressClosingCycles(),
                )
            }
        }
    }
}

const orderInitialSelectors = (
    selectors: Set<Selector>,
    frame: SchedulerWorkspace,
    data: StoreData,
) => {
    for (const selector of selectors) addClosureNode(selector, true, frame)
    for (const selector of frame.nodes) {
        frame.meta.set(selector, withPending(frame.meta.get(selector)!, 0))
    }
    for (const selector of frame.nodes) {
        const downstream = data.stateDependents.get(selector)
        if (!downstream) continue
        for (const childState of downstream) {
            if (!IS_PROD) recordEdge(data)
            const child = childState as Selector
            const value = frame.meta.get(child)
            if (value === undefined) continue
            frame.meta.set(child, withPending(value, pendingOf(value) + 1))
        }
    }
    for (const selector of frame.nodes) {
        if (pendingOf(frame.meta.get(selector)!) !== 0) continue
        frame.ready.push(selector)
        if (!IS_PROD) recordEnqueue(data)
    }

    let head = 0
    while (head < frame.ready.length) {
        const selector = frame.ready[head++]!
        if (!IS_PROD) recordDequeue(data)
        frame.batch.push(selector)
        const downstream = data.stateDependents.get(selector)
        if (!downstream) continue
        for (const childState of downstream) {
            const child = childState as Selector
            const value = frame.meta.get(child)
            if (value === undefined) continue
            if (!IS_PROD) recordEdge(data)
            const pending = Math.max(0, pendingOf(value) - 1)
            frame.meta.set(child, withPending(value, pending))
            if (pending === 0) {
                frame.ready.push(child)
                if (!IS_PROD) recordEnqueue(data)
            }
        }
    }

    // Preserve the historical insertion-order treatment when the initial set
    // itself is cyclic. Any changed edge below is still handed to the isolated
    // closure fixpoint.
    if (frame.batch.length !== frame.nodes.length) {
        frame.batch.length = 0
        for (const selector of frame.nodes) frame.batch.push(selector)
    }
}

const addChangedClosureNode = (
    selector: Selector,
    needsEval: boolean,
    frame: SchedulerWorkspace,
): boolean => {
    const value = frame.meta.get(selector) ?? 0
    const flags = flagsOf(value)
    if ((flags & RESWEEP) !== 0) {
        if (needsEval) {
            frame.meta.set(selector, withFlags(value, flags | NEEDS_EVAL))
        }
        return false
    }
    // Reset any seed-order pending count; the finalized closure takes a fresh
    // dependency snapshot after every changed seed has been settled or deferred.
    frame.meta.set(
        selector,
        RESWEEP | (flags & NEEDS_EVAL) | (needsEval ? NEEDS_EVAL : 0),
    )
    frame.resweep.push(selector)
    return true
}

const discoverClosureFrom = (
    start: number,
    frame: SchedulerWorkspace,
    data: StoreData,
) => {
    for (let index = start; index < frame.resweep.length; index++) {
        const selector = frame.resweep[index]!
        const children = data.stateDependents.get(selector)
        if (!children) continue
        for (const childState of children) {
            if (!IS_PROD) recordEdge(data)
            addChangedClosureNode(childState as Selector, false, frame)
        }
    }
}

const discoverChangedClosure = <Context>(
    parent: Selector,
    frame: SchedulerWorkspace,
    data: StoreData,
    context: Context,
    propagate: PropagateSelector<Context> | undefined,
) => {
    const start = frame.resweep.length
    const downstream = data.stateDependents.get(parent)
    if (downstream) {
        for (const childState of downstream) {
            if (!IS_PROD) recordEdge(data)
            const child = childState as Selector
            if (propagate) propagate(parent, child, context)
            addChangedClosureNode(child, true, frame)
        }
    }

    // Discover the union only after a seed actually changes. Initial selectors
    // reached by this traversal are marked RESWEEP and skipped by the seed pass,
    // so a wide sink is evaluated once after every reached upstream finalizes.
    discoverClosureFrom(start, frame, data)
}

const prepareChangedClosure = (frame: SchedulerWorkspace) => {
    for (const selector of frame.nodes) {
        const value = frame.meta.get(selector)
        if (value !== undefined && (flagsOf(value) & RESWEEP) === 0) {
            frame.meta.delete(selector)
        }
    }
    frame.nodes.length = 0
    for (const selector of frame.resweep) {
        const value = frame.meta.get(selector)!
        frame.meta.set(
            selector,
            (flagsOf(value) & NEEDS_EVAL) !== 0 ? NEEDS_EVAL : 0,
        )
        frame.nodes.push(selector)
    }
    frame.ready.length = 0
    frame.resweep.length = 0
    frame.batch.length = 0
}

const settleChangedClosure = <Context>(
    frame: SchedulerWorkspace,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate: PropagateSelector<Context> | undefined,
) => {
    prepareChangedClosure(frame)
    initializeReadyQueue(frame, data)
    const graphMutated = settleReady(frame, data, context, settle, propagate)
    activateStrandedWork(frame, graphMutated, data)
    settleStranded(frame, data, context, settle, propagate)
}

const runMultiSeedScheduler = <Context>(
    selectors: Set<Selector>,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate: PropagateSelector<Context> | undefined,
) => {
    const frame = acquireSchedulerWorkspace(data)
    try {
        orderInitialSelectors(selectors, frame, data)
        for (const selector of frame.batch) {
            const value = frame.meta.get(selector)
            if (value === undefined) continue
            const flags = flagsOf(value)
            if ((flags & RESWEEP) !== 0) continue

            const result = settle(selector, data, context)
            frame.meta.set(
                selector,
                withFlags(value, (flags & ~NEEDS_EVAL) | SETTLED),
            )
            if ((result & SCHEDULE_CHANGED) !== 0) {
                discoverChangedClosure(
                    selector,
                    frame,
                    data,
                    context,
                    propagate,
                )
            }
        }
        if (frame.resweep.length === 0) return

        settleChangedClosure(frame, data, context, settle, propagate)
    } finally {
        releaseSchedulerWorkspace(frame)
    }
}

const hasInitialDependency = (
    selectors: Set<Selector>,
    data: StoreData,
): boolean => {
    for (const selector of selectors) {
        const deps = data.stateDependencies.get(selector)
        if (!deps) continue
        for (const dep of deps) {
            if (!IS_PROD) recordEdge(data)
            if (selectors.has(dep as Selector)) return true
        }
    }
    return false
}

const runIndependentSeedScheduler = <Context>(
    selectors: Set<Selector>,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate: PropagateSelector<Context> | undefined,
) => {
    let frame: SchedulerWorkspace | undefined
    try {
        for (const selector of selectors) {
            const value = frame?.meta.get(selector)
            if (
                frame &&
                value !== undefined &&
                (flagsOf(value) & RESWEEP) !== 0
            ) {
                markNeedsEval(selector, frame)
                continue
            }
            const result = settle(selector, data, context)
            if ((result & SCHEDULE_CHANGED) === 0) continue
            const downstream = data.stateDependents.get(selector)
            if (!downstream || downstream.size === 0) continue
            if (!frame) frame = acquireSchedulerWorkspace(data)
            discoverChangedClosure(selector, frame, data, context, propagate)
        }
        if (!frame || frame.resweep.length === 0) return
        settleChangedClosure(frame, data, context, settle, propagate)
    } finally {
        if (frame) releaseSchedulerWorkspace(frame)
    }
}

const runClosureScheduler = <Context>(
    initial: Iterable<Selector>,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate: PropagateSelector<Context> | undefined,
) => {
    const frame = acquireSchedulerWorkspace(data)
    try {
        discoverClosure(initial, frame, data)
        initializeReadyQueue(frame, data)
        const graphMutated = settleReady(
            frame,
            data,
            context,
            settle,
            propagate,
        )
        activateStrandedWork(frame, graphMutated, data)
        settleStranded(frame, data, context, settle, propagate)
    } finally {
        releaseSchedulerWorkspace(frame)
    }
}

export const scheduleSelectors = <Context>(
    selectors: Set<Selector>,
    data: StoreData,
    context: Context,
    settle: SettleSelector<Context>,
    propagate?: PropagateSelector<Context>,
): void => {
    if (selectors.size === 0) return

    // One initial selector keeps the historical linear fast path. Only build
    // scheduler state when its value changed and it has downstream work.
    if (selectors.size === 1) {
        const selector = selectors.values().next().value as Selector
        const result = settle(selector, data, context)
        if ((result & SCHEDULE_CHANGED) === 0) return
        const downstream = data.stateDependents.get(selector)
        if (!downstream || downstream.size === 0) return
        if (propagate) {
            for (const child of downstream) {
                propagate(selector, child as Selector, context)
            }
        }
        runClosureScheduler(
            downstream as Set<Selector>,
            data,
            context,
            settle,
            propagate,
        )
        return
    }

    // Independent selector leaves need neither ordering nor downstream
    // discovery. This is the common live fan-out shape and keeps it off the
    // graph workspace just like the one-selector terminal path.
    let hasDownstream = false
    for (const selector of selectors) {
        const downstream = data.stateDependents.get(selector)
        if (downstream && downstream.size > 0) {
            hasDownstream = true
            break
        }
    }
    if (!hasDownstream) {
        // A seed evaluation can lazily materialize new downstream edges. Reuse
        // the independent-seed path so those edges are observed after each
        // settlement without allocating a frame for the ordinary leaf case.
        runIndependentSeedScheduler(selectors, data, context, settle, propagate)
        return
    }

    if (hasInitialDependency(selectors, data)) {
        runMultiSeedScheduler(selectors, data, context, settle, propagate)
    } else {
        runIndependentSeedScheduler(selectors, data, context, settle, propagate)
    }
}
