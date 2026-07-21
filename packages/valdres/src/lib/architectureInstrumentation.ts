import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"

/**
 * Test/benchmark-only structural counters. The optional collector is absent on
 * ordinary stores, and none of these counters are exported from the package.
 * A measurement window represents one logical operation/commit.
 */
export type ArchitectureCounters = {
    selectorEvaluations: number
    selectorSettlements: number
    duplicateSelectorSettlements: number
    affectedStoresSettled: number
    storeSettlementPasses: number
    duplicateStoreSettlements: number
    dependencyEdgeVisits: number
    schedulerQueueEnqueues: number
    schedulerQueueDequeues: number
    /** Admitted `runCommitPlan` executions — one per engine-sequenced commit. */
    commitPlanRuns: number
}

export type ArchitectureInstrumentation = {
    counters: ArchitectureCounters
    settledSelectors: WeakMap<StoreData, WeakSet<Selector>>
    settledStores: WeakSet<StoreData>
}

export const createArchitectureInstrumentation =
    (): ArchitectureInstrumentation => ({
        counters: {
            selectorEvaluations: 0,
            selectorSettlements: 0,
            duplicateSelectorSettlements: 0,
            affectedStoresSettled: 0,
            storeSettlementPasses: 0,
            duplicateStoreSettlements: 0,
            dependencyEdgeVisits: 0,
            schedulerQueueEnqueues: 0,
            schedulerQueueDequeues: 0,
            commitPlanRuns: 0,
        },
        settledSelectors: new WeakMap(),
        settledStores: new WeakSet(),
    })

export const recordSelectorEvaluation = (data: StoreData): void => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.selectorEvaluations++
}

export const recordCommitPlanRun = (data: StoreData): void => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.commitPlanRuns++
}

export const recordSelectorSettlement = (
    selector: Selector,
    data: StoreData,
): void => {
    const instrumentation = data.architectureInstrumentation
    if (!instrumentation) return

    const counters = instrumentation.counters
    counters.selectorSettlements++
    let settled = instrumentation.settledSelectors.get(data)
    if (!settled) {
        settled = new WeakSet()
        instrumentation.settledSelectors.set(data, settled)
    }
    if (settled.has(selector)) counters.duplicateSelectorSettlements++
    else settled.add(selector)
}

export const recordStoreSettlement = (data: StoreData): void => {
    const instrumentation = data.architectureInstrumentation
    if (!instrumentation) return

    const counters = instrumentation.counters
    counters.storeSettlementPasses++
    if (instrumentation.settledStores.has(data)) {
        counters.duplicateStoreSettlements++
    } else {
        instrumentation.settledStores.add(data)
        counters.affectedStoresSettled++
    }
}

export const recordDependencyEdgeVisit = (data: StoreData): void => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.dependencyEdgeVisits++
}

export const recordSchedulerQueueEnqueue = (
    data: StoreData,
    count = 1,
): void => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation)
        instrumentation.counters.schedulerQueueEnqueues += count
}

export const recordSchedulerQueueDequeue = (data: StoreData): void => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.schedulerQueueDequeues++
}
