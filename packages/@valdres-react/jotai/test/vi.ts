/**
 * The subset of Vitest the upstream Jotai tests use, on bun:test, plus the
 * known-gap gate. Upstream test titles listed in `upstream/gaps.ts` are
 * expected to fail against this package (`test.failing`): if one starts
 * passing, the run fails until the manifest is updated. The reference run
 * (`JOTAI_IMPL=jotai`) runs every test normally.
 */
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe as bunDescribe,
    expect,
    jest,
    mock,
    spyOn,
    test as bunTest,
} from "bun:test"
import { appendFileSync } from "node:fs"
import { IMPL } from "./impl"
import { gaps } from "./upstream/gaps"

export { afterAll, afterEach, beforeAll, beforeEach, expect }

// Bun implements these fake-timer controls; its bundled types predate them.
const timers = jest as unknown as {
    useFakeTimers(): void
    useRealTimers(): void
    advanceTimersByTime(ms: number): void
}

const flushMicrotasks = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
}

const stubbed = new Map<string, PropertyDescriptor | undefined>()

export const vi = {
    fn: mock,
    spyOn,
    useFakeTimers: () => {
        timers.useFakeTimers()
    },
    useRealTimers: () => {
        timers.useRealTimers()
    },
    advanceTimersByTime: (ms: number) => {
        timers.advanceTimersByTime(ms)
    },
    // Vitest fires due timers in order and lets promise callbacks run between
    // them. Bun's clock cannot report the next due time, so step 1ms at a time.
    advanceTimersByTimeAsync: async (ms: number) => {
        await flushMicrotasks()
        timers.advanceTimersByTime(0)
        await flushMicrotasks()
        for (let elapsed = 0; elapsed < ms; elapsed++) {
            timers.advanceTimersByTime(1)
            await flushMicrotasks()
        }
    },
    stubGlobal: (name: string, value: unknown) => {
        if (!stubbed.has(name)) {
            stubbed.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
        }
        Object.defineProperty(globalThis, name, {
            configurable: true,
            writable: true,
            value,
        })
    },
    unstubAllGlobals: () => {
        for (const [name, descriptor] of stubbed) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor)
            else delete (globalThis as Record<string, unknown>)[name]
        }
        stubbed.clear()
    },
}

const path: string[] = []

type TestFn = (...args: never[]) => unknown

const register = (
    base: typeof bunTest,
    name: string,
    fn?: TestFn,
    options?: number | { timeout?: number },
) => {
    const key = [...path, name].join(" > ")
    const gap = gaps[key]
    // The upstream runner checks that every listed gap was registered.
    if (gap !== undefined && process.env.JOTAI_GAP_REPORT) {
        appendFileSync(process.env.JOTAI_GAP_REPORT, `${key}\n`)
    }
    if (gap === undefined || IMPL === "jotai") {
        return base(name, fn as never, options as never)
    }
    if (gap.kind === "not-applicable" || gap.skip) {
        return bunTest.skip(`${name} [${gap.kind}: ${gap.reason}]`, () => {})
    }
    // Inverted by hand: bun's `test.failing` still enforces the upstream
    // test's `expect.assertions(n)` count after inverting a thrown failure.
    const assertions = expect.assertions
    return bunTest(
        `${name} [${gap.kind}: ${gap.reason}]`,
        async () => {
            expect.assertions = () => {}
            let failure: unknown
            try {
                await (fn as () => unknown)()
            } catch (error) {
                failure = error ?? new Error("falsy throw")
            } finally {
                expect.assertions = assertions
            }
            if (failure === undefined) {
                throw new Error(
                    `Known gap now passes against the adapter: remove "${key}" from test/upstream/gaps.ts`,
                )
            }
        },
        options as never,
    )
}

const createTest = (base: typeof bunTest) => {
    const t = (name: string, fn?: TestFn, options?: number) =>
        register(base, name, fn, options)
    return Object.assign(t, {
        skip: base.skip,
        todo: base.todo,
        only: base.only,
        each:
            (cases: readonly unknown[]) =>
            (
                name: string,
                fn: (...args: never[]) => unknown,
                options?: number,
            ) => {
                for (const c of cases) {
                    const args = (Array.isArray(c) ? c : [c]) as never[]
                    let title = name
                    for (const arg of args) {
                        title = title.replace(/%[sdifjo]/, String(arg))
                    }
                    if (
                        c !== null &&
                        typeof c === "object" &&
                        !Array.isArray(c)
                    ) {
                        title = title.replace(
                            /\$(\w+)/g,
                            (match, key: string) =>
                                key in c
                                    ? String(
                                          (c as Record<string, unknown>)[key],
                                      )
                                    : match,
                        )
                    }
                    register(base, title, () => fn(...args), options)
                }
            },
    })
}

export const it = createTest(bunTest)
export const test = it

export const describe = Object.assign(
    (name: string, fn: () => void) =>
        bunDescribe(name, () => {
            path.push(name)
            try {
                fn()
            } finally {
                path.pop()
            }
        }),
    { skip: bunDescribe.skip, only: bunDescribe.only },
)
