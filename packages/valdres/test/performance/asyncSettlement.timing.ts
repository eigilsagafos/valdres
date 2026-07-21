import { do_not_optimize } from "mitata"
import { atom } from "../../src/atom"
import { selector } from "../../src/selector"
import { store } from "../../src/store"
import { measureOne } from "./bench-utils"
import { describe, test } from "./test-compat"

const noop = () => {}
const ASYNC_SETTLEMENT_WARMUP = { warmupRuns: 1_000 }

const observeAtomSettlement = (
    target: ReturnType<typeof store>,
    state: ReturnType<typeof atom<number>>,
) => {
    target.sub(state, noop)
    target.onChange(noop)
    target.onCommitEnd(noop)
}

const measureAsyncAtomSettlement = async (observed: boolean) => {
    const target = store()
    const state = atom(0)
    target.get(state)
    if (observed) observeAtomSettlement(target, state)
    let next = 0

    await measureOne(
        `async settle: atom resolve ${observed ? "observed" : "unobserved"}`,
        async () => {
            const pending = Promise.resolve(++next)
            do_not_optimize(await target.set(state, pending))
        },
        ASYNC_SETTLEMENT_WARMUP,
    )
}

const measureAsyncSelectorSettlement = async (observed: boolean) => {
    const target = store()
    const source = atom(0)
    let pending = Promise.resolve(0)
    const derived = selector(get => {
        pending = Promise.resolve(get(source))
        return pending
    })
    if (observed) {
        target.sub(derived, noop)
        target.onChange(noop, { atoms: false, selectors: true })
        target.onCommitEnd(noop)
    } else {
        target.get(derived)
    }
    await pending
    let next = 0

    await measureOne(
        `async settle: selector resolve ${observed ? "observed" : "unobserved"}`,
        async () => {
            target.set(source, ++next)
            do_not_optimize(await target.get(derived))
        },
        ASYNC_SETTLEMENT_WARMUP,
    )
}

describe("async settlement", () => {
    test("explicit atom resolution, unobserved", () =>
        measureAsyncAtomSettlement(false))

    test("explicit atom resolution, observed", () =>
        measureAsyncAtomSettlement(true))

    test("native async selector resolution, unobserved", () =>
        measureAsyncSelectorSettlement(false))

    test("native async selector resolution, observed", () =>
        measureAsyncSelectorSettlement(true))

    test("timer-driven revalidation value/meta settlement", async () => {
        const target = store()
        let next = 0
        let pending = Promise.resolve(0)
        const state = atom(
            () => {
                pending = Promise.resolve(++next)
                return pending
            },
            { maxAge: 100 },
        )
        let tick: (() => void) | undefined
        const realSetInterval = globalThis.setInterval
        globalThis.setInterval = ((handler: TimerHandler) => {
            tick = handler as () => void
            return 1 as unknown as ReturnType<typeof setInterval>
        }) as typeof setInterval
        try {
            target.sub(state, noop)
        } finally {
            globalThis.setInterval = realSetInterval
        }
        target.onChange(noop)
        target.onCommitEnd(noop)
        await pending

        await measureOne(
            "async settle: timer revalidation value + meta",
            async () => {
                tick!()
                await pending
                do_not_optimize(target.get(state))
            },
            ASYNC_SETTLEMENT_WARMUP,
        )
    })
})
