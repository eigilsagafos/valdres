import { getStoreData } from "./getStoreData"
import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

const countTeardownDependencyReads = async (
    fanIn: boolean,
    includeMount: boolean,
) => {
    const count = 120
    const targetStore = store(fanIn ? "teardown-fanin" : "teardown-baseline")
    const noop = () => {}
    const unsubs: (() => void)[] = []
    const leaves: any[] = []

    let mountCleanups = 0
    const spineRoot = includeMount
        ? atom(0, {
              onMount: () => () => {
                  mountCleanups++
              },
          })
        : atom(0)
    let spineTop = selector(get => get(spineRoot) + 1)
    for (let depth = 1; depth < 20; depth++) {
        const previous = spineTop
        spineTop = selector(get => get(previous) + 1)
    }

    for (let index = 0; index < count; index++) {
        const leafBase = atom(index)
        const leafA = selector(get => get(leafBase) + get(spineTop))
        const leafB = selector(get => get(leafA) + 1)
        const leafC = selector(get => get(leafB) + 1)
        leaves.push(leafC)
        unsubs.push(targetStore.sub(leafC, noop))
        unsubs.push(targetStore.sub(leafB, noop))
        targetStore.get(leafC)
        targetStore.get(leafB)
    }

    if (fanIn) {
        const aggregator = selector(get => {
            let sum = 0
            for (const leaf of leaves) sum += get(leaf)
            return sum
        })
        unsubs.push(targetStore.sub(aggregator, noop))
        targetStore.get(aggregator)
    }

    const dependencies = getStoreData(targetStore).stateDependencies
    let dependencyReads = 0
    getStoreData(targetStore).stateDependencies = {
        get(key: WeakKey) {
            dependencyReads++
            return dependencies.get(key)
        },
        set: dependencies.set.bind(dependencies),
        has: dependencies.has.bind(dependencies),
        delete: dependencies.delete.bind(dependencies),
    } as WeakMap<WeakKey, any>

    for (const unsubscribe of unsubs) unsubscribe()
    const lifecycleCleanupWasSynchronous = !includeMount || mountCleanups === 1
    // Include the one queued orphan sweep: the assertion covers total burst
    // work, not merely what remains on each individual unsubscribe stack.
    await Promise.resolve()
    // Snapshot before the structural check below, whose own probes would
    // otherwise count against the linearity bound.
    const teardownDependencyReads = dependencyReads
    // Teardown's contract is that an orphan leaves the ITERABLE REVERSE graph,
    // so no later write can reach it. Its forward set is retained on purpose —
    // orphan cleanup demotes it to a cold cache so a remount re-wires the graph
    // instead of re-running the selector body.
    const leftReverseGraph = (state: any) => {
        const deps = dependencies.get(state)
        if (!deps) return true
        const dependents = getStoreData(targetStore).stateDependents
        for (const dep of deps) if (dependents.get(dep)?.has(state)) return false
        return true
    }
    const graphWasCleaned =
        leftReverseGraph(leaves[0]) && leftReverseGraph(spineTop)
    return {
        count,
        dependencyReads: teardownDependencyReads,
        lifecycleCleanupWasSynchronous,
        mountCleanups,
        graphWasCleaned,
    }
}

describe("unsubscribe scaling", () => {
    for (const { fanIn, includeMount, label } of [
        { fanIn: false, includeMount: false, label: "shared spine" },
        { fanIn: true, includeMount: false, label: "wide fan-in" },
        {
            fanIn: true,
            includeMount: true,
            label: "wide fan-in with mounted spine",
        },
    ]) {
        test(`${label} visits graph O(states), not O(unsubscribes × closure)`, async () => {
            const {
                count,
                dependencyReads,
                lifecycleCleanupWasSynchronous,
                mountCleanups,
                graphWasCleaned,
            } = await countTeardownDependencyReads(fanIn, includeMount)

            // The graph has ~4 states per leaf plus the fixed 20-state spine.
            // A fresh depth-20 cycle scan for both subscriptions would exceed
            // 40 reads per leaf before liveness/cleanup even begin. Keep the
            // bound loose enough to describe linear work, not implementation
            // minutiae or wall-clock timing.
            expect(dependencyReads).toBeLessThan(count * 12 + 100)
            expect(lifecycleCleanupWasSynchronous).toBe(true)
            expect(graphWasCleaned).toBe(true)
            if (includeMount) expect(mountCleanups).toBe(1)
        })
    }
})
