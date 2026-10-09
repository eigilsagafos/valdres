/**
 * Jotai behavior this package rejects instead of approximating. Each case
 * fails loudly with a stable `code`, or with the Valdres error that enforces
 * the boundary.
 */
import { describe, expect, test } from "bun:test"
import { atom as jotaiAtom } from "jotai-reference/vanilla"
import { SelectorCircularDependencyError } from "valdres"
import { atom, createStore, getDefaultStore } from "../../src/index"
import LeakDetector from "../leakDetector"

const codeOf = (fn: () => unknown) => {
    try {
        fn()
    } catch (error) {
        return (error as { code?: string }).code ?? (error as Error).name
    }
    return "no error"
}

describe("dependencies are tracked synchronously", () => {
    test("get() after await rejects the atom's promise", async () => {
        const store = createStore()
        const a = atom(1)
        const b = atom(2)
        const late = atom(async get => {
            const first = get(a)
            await Promise.resolve()
            return first + get(b)
        })
        await expect(store.get(late)).rejects.toMatchObject({
            name: "JotaiCompatibilityError",
            code: "VALDRES_JOTAI_LATE_GET",
        })
    })

    test("gets before the first await are tracked", async () => {
        const store = createStore()
        const a = atom(1)
        const b = atom(2)
        const hoisted = atom(async get => {
            const [first, second] = [get(a), get(b)]
            await Promise.resolve()
            return first + second
        })
        expect(await store.get(hoisted)).toBe(3)
        store.set(b, 10)
        expect(await store.get(hoisted)).toBe(11)
    })

    test("a getter captured in a returned function cannot be called later", () => {
        const store = createStore()
        const a = atom(1)
        const getterFn = atom(get => () => get(a))
        expect(codeOf(() => store.get(getterFn)())).toBe(
            "VALDRES_JOTAI_LATE_GET",
        )
    })
})

test("read options.signal throws", () => {
    const store = createStore()
    const usesSignal = atom(
        (_get, options) => (options as { signal?: AbortSignal }).signal,
    )
    expect(codeOf(() => store.get(usesSignal))).toBe(
        "VALDRES_JOTAI_SIGNAL_UNSUPPORTED",
    )
})

test("Jotai's internal INTERNAL_onInit hook throws on first use", () => {
    const store = createStore()
    const a = atom(0) as ReturnType<typeof atom<number>> & {
        INTERNAL_onInit?: () => void
    }
    a.INTERNAL_onInit = () => {}
    expect(codeOf(() => store.get(a))).toBe(
        "VALDRES_JOTAI_INTERNAL_ON_INIT_UNSUPPORTED",
    )
})

describe("onMount", () => {
    test("assigning onMount after a store used the atom throws", () => {
        const store = createStore()
        const a = atom(0)
        store.get(a)
        expect(
            codeOf(() => {
                a.onMount = () => {}
            }),
        ).toBe("VALDRES_JOTAI_ON_MOUNT_AFTER_FIRST_USE")
    })

    test("replacing or removing an onMount after first use is allowed", () => {
        const store = createStore()
        const a = atom(0)
        const calls: string[] = []
        a.onMount = () => {
            calls.push("first")
        }
        store.get(a)
        a.onMount = () => {
            calls.push("second")
        }
        store.sub(a, () => {})()
        a.onMount = undefined
        store.sub(a, () => {})()
        expect(calls).toEqual(["second"])
    })

    test("atoms created by Jotai itself work, including a late onMount", () => {
        const store = createStore()
        const count = jotaiAtom(0)
        // Typed against Jotai's own `signal` option, so cast at this boundary.
        const doubled = jotaiAtom(get => get(count) * 2) as never as ReturnType<
            typeof atom<number>
        >
        store.get(doubled)
        const mounted: string[] = []
        count.onMount = set => {
            mounted.push("mount")
            set(5)
            return () => mounted.push("unmount")
        }
        const unsub = store.sub(doubled, () => {})
        expect(store.get(doubled)).toBe(10)
        unsub()
        expect(mounted).toEqual(["mount", "unmount"])
    })
})

describe("Valdres boundaries surface unchanged", () => {
    test("store methods inside a read function throw SelectorCapabilityError", () => {
        const store = createStore()
        const a = atom(0)
        const readsStore = atom(() => store.get(a))
        expect(codeOf(() => store.get(readsStore))).toBe(
            "VALDRES_SELECTOR_CAPABILITY_ERROR",
        )
    })

    test("a listener cannot operate on a different store", () => {
        const first = createStore()
        const second = createStore()
        const a = atom(0)
        first.sub(a, () => second.set(a, 1))
        let caught: unknown
        try {
            first.set(a, 1)
        } catch (error) {
            caught = error
        }
        expect(caught).toBeInstanceOf(AggregateError)
        expect(
            (caught as AggregateError).errors.map(
                e => (e as { code?: string }).code,
            ),
        ).toEqual(["VALDRES_TRANSACTION_PHASE"])
        expect(first.get(a)).toBe(1)
        expect(second.get(a)).toBe(0)
    })

    test("a dependency cycle fails with SelectorCircularDependencyError", () => {
        const store = createStore()
        const left: ReturnType<typeof atom<number>> = atom(get =>
            get(right),
        ) as never
        const right: ReturnType<typeof atom<number>> = atom(get =>
            get(left),
        ) as never
        let caught: unknown
        try {
            store.get(left)
        } catch (error) {
            caught = error
        }
        let cause = caught
        while (
            cause instanceof Error &&
            !(cause instanceof SelectorCircularDependencyError)
        ) {
            cause = cause.cause
        }
        expect(cause).toBeInstanceOf(SelectorCircularDependencyError)
    })
})

describe("stores", () => {
    test("getDefaultStore is one store; createStore makes independent ones", () => {
        expect(getDefaultStore()).toBe(getDefaultStore())
        const a = atom(0)
        const one = createStore()
        const two = createStore()
        one.set(a, 1)
        expect([one.get(a), two.get(a), getDefaultStore().get(a)]).toEqual([
            1, 0, 0,
        ])
    })

    test("an unreferenced store and its values are collectable", async () => {
        let store: ReturnType<typeof createStore> | undefined = createStore()
        const value = { big: new Array(1000).fill(0) }
        const a = atom<object>({})
        a.onMount = () => () => {}
        store.set(a, value)
        store.sub(a, () => {})()
        const detector = new LeakDetector(store)
        store = undefined
        expect(await detector.isLeaking()).toBe(false)
    })
})
