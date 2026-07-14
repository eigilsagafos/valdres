import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

const countTeardownDependencyReads = async (fanIn: boolean) => {
    const count = 120
    const targetStore = store(fanIn ? "teardown-fanin" : "teardown-baseline")
    const noop = () => {}
    const unsubs: (() => void)[] = []
    const leaves: any[] = []

    const spineRoot = atom(0)
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

    const dependencies = targetStore.data.stateDependencies
    let dependencyReads = 0
    targetStore.data.stateDependencies = {
        get(key: WeakKey) {
            dependencyReads++
            return dependencies.get(key)
        },
        set: dependencies.set.bind(dependencies),
        has: dependencies.has.bind(dependencies),
        delete: dependencies.delete.bind(dependencies),
    } as WeakMap<WeakKey, any>

    for (const unsubscribe of unsubs) unsubscribe()
    // Include the one queued orphan sweep: the assertion covers total burst
    // work, not merely what remains on each individual unsubscribe stack.
    await Promise.resolve()
    return { count, dependencyReads }
}

describe("unsubscribe scaling", () => {
    for (const fanIn of [false, true]) {
        test(`${fanIn ? "wide fan-in" : "shared spine"} visits graph O(states), not O(unsubscribes × closure)`, async () => {
            const { count, dependencyReads } =
                await countTeardownDependencyReads(fanIn)

            // The graph has ~4 states per leaf plus the fixed 20-state spine.
            // A fresh depth-20 cycle scan for both subscriptions would exceed
            // 40 reads per leaf before liveness/cleanup even begin. Keep the
            // bound loose enough to describe linear work, not implementation
            // minutiae or wall-clock timing.
            expect(dependencyReads).toBeLessThan(count * 12 + 100)
        })
    }
})
