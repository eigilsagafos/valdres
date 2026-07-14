import { describe, test } from "./test-compat"
import { do_not_optimize } from "mitata"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"

const makeSharedTeardown = (
    count: number,
    fanIn: boolean,
    includeMount: boolean,
) => {
    const vStore = valdresCreateStore()
    const vSpineRoot = includeMount
        ? valdresAtom(0, { onMount: () => () => {} })
        : valdresAtom(0)
    let vSpineTop: any = valdresSelector(get => get(vSpineRoot) + 1)
    for (let depth = 1; depth < 20; depth++) {
        const previous = vSpineTop
        vSpineTop = valdresSelector(get => get(previous) + 1)
    }
    const vPairs = Array.from({ length: count }, (_, index) => {
        const base = valdresAtom(index)
        const a = valdresSelector(get => get(base) + get(vSpineTop))
        const b = valdresSelector(get => get(a) + 1)
        const c = valdresSelector(get => get(b) + 1)
        return { b, c }
    })
    const vAggregator = fanIn
        ? valdresSelector(get => {
              let sum = 0
              for (const { c } of vPairs) sum += get(c)
              return sum
          })
        : undefined

    const jStore = jotaiCreateStore()
    const jSpineRoot = jotaiAtom(0)
    if (includeMount) jSpineRoot.onMount = () => () => {}
    let jSpineTop: any = jotaiAtom(get => get(jSpineRoot) + 1)
    for (let depth = 1; depth < 20; depth++) {
        const previous = jSpineTop
        jSpineTop = jotaiAtom(get => get(previous) + 1)
    }
    const jPairs = Array.from({ length: count }, (_, index) => {
        const base = jotaiAtom(index)
        const a = jotaiAtom(get => get(base) + get(jSpineTop))
        const b = jotaiAtom(get => get(a) + 1)
        const c = jotaiAtom(get => get(b) + 1)
        return { b, c }
    })
    const jAggregator = fanIn
        ? jotaiAtom(get => {
              let sum = 0
              for (const { c } of jPairs) sum += get(c)
              return sum
          })
        : undefined

    const noop = () => {}
    return {
        valdres: async () => {
            const unsubs: (() => void)[] = []
            for (const { b, c } of vPairs) {
                unsubs.push(vStore.sub(c, noop))
                unsubs.push(vStore.sub(b, noop))
                do_not_optimize(vStore.get(c))
                do_not_optimize(vStore.get(b))
            }
            if (vAggregator) {
                unsubs.push(vStore.sub(vAggregator, noop))
                do_not_optimize(vStore.get(vAggregator))
            }
            for (const unsub of unsubs) unsub()
            await Promise.resolve()
        },
        jotai: async () => {
            const unsubs: (() => void)[] = []
            for (const { b, c } of jPairs) {
                unsubs.push(jStore.sub(c, noop))
                unsubs.push(jStore.sub(b, noop))
                do_not_optimize(jStore.get(c))
                do_not_optimize(jStore.get(b))
            }
            if (jAggregator) {
                unsubs.push(jStore.sub(jAggregator, noop))
                do_not_optimize(jStore.get(jAggregator))
            }
            for (const unsub of unsubs) unsub()
            // Match the async measurement boundary used to include Valdres's
            // queued orphan sweep in every iteration.
            await Promise.resolve()
        },
    }
}

describe("unsubscribe", () => {
    for (const { fanIn, includeMount, suffix } of [
        { fanIn: false, includeMount: false, suffix: "" },
        { fanIn: true, includeMount: false, suffix: " + fan-in" },
        {
            fanIn: true,
            includeMount: true,
            suffix: " + fan-in + mounted spine",
        },
    ]) {
        test(`subscribe + unsubscribe 100 shared selector pairs${suffix}`, async () => {
            const teardown = makeSharedTeardown(100, fanIn, includeMount)
            await compare(
                `subscribe + unsubscribe 100 shared selector pairs${suffix}`,
                teardown.valdres,
                teardown.jotai,
            )
        })
    }
})
