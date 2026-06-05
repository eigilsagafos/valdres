import { jest } from "bun:test"

/** Drain the microtask queue so promise (`.then`) chains scheduled by a timer
 *  or a manual resolve settle before the next assertion. A few passes cover the
 *  shallow chains valdres uses (tick → fetch → handleResolve → updateMeta). */
const drainMicrotasks = async (passes = 4) => {
    for (let i = 0; i < passes; i++) await Promise.resolve()
}

export type FakeClock = {
    /** Advance fake time by `ms` (firing due timers), then settle promises. */
    advance: (ms: number) => Promise<void>
    /** Settle pending promise callbacks without moving time — e.g. after
     *  manually resolving a mocked fetch. */
    settle: () => Promise<void>
    /** Parity shim for jest/vitest's not-yet-implemented (oven-sh/bun#16142)
     *  async timer API. Identical to `advance`. */
    advanceTimersByTimeAsync: (ms: number) => Promise<void>
    /** Restore real timers (and the real `Date.now()`). Must run after every
     *  test that installed the clock, or fake timers leak into sibling tests. */
    restore: () => void
}

/** Install a deterministic clock for maxAge / SWR / interval tests, removing
 *  real wall-clock dependence so tick-count and freshness-window assertions
 *  never race CI scheduling. `jest.useFakeTimers()` also fakes `Date.now()`, and
 *  `advanceTimersByTime` advances it in lockstep with the timer queue — which is
 *  what the maxAge code's `Date.now() - lastWrite` freshness math relies on.
 *
 *  Do NOT add `setSystemTime()` to anchor an absolute start time. Verified in
 *  Bun 1.3.13: `setSystemTime` before `useFakeTimers` is overwritten (no-op);
 *  `setSystemTime` after `useFakeTimers` pins `Date.now()` so that
 *  `advanceTimersByTime` no longer moves it, which breaks the freshness windows.
 *  The tests only need relative advancement, so plain `useFakeTimers` is correct
 *  and `useRealTimers` fully restores the real clock on its own.
 *
 *  Bun's `advanceTimersByTime` already drains microtasks between timer firings
 *  (unlike jest's sync version), so timer→`.then`→timer chains resolve on their
 *  own; `advance` just adds a trailing drain so an awaited assertion sees the
 *  settled result. The async `*Async` timer APIs remain unimplemented upstream
 *  (oven-sh/bun#16142), hence the shim above.
 *
 *  Prefer `withFakeClock` so restoration is automatic. */
export const useFakeClock = (): FakeClock => {
    jest.useFakeTimers()
    const advance = async (ms: number) => {
        jest.advanceTimersByTime(ms)
        await drainMicrotasks()
    }
    return {
        advance,
        settle: () => drainMicrotasks(),
        advanceTimersByTimeAsync: advance,
        restore: () => {
            jest.useRealTimers()
        },
    }
}

/** Run `body` with a fake clock installed, restoring real timers afterwards
 *  even if it throws — no per-test install/restore boilerplate:
 *
 *      test("...", () => withFakeClock(async clock => { ... }))
 */
export const withFakeClock = async (
    body: (clock: FakeClock) => Promise<void> | void,
) => {
    const clock = useFakeClock()
    try {
        await body(clock)
    } finally {
        clock.restore()
    }
}

/** A controllable async data source for maxAge atoms. `fn` is the atom's
 *  default factory; each call records one fetch and returns a fresh pending
 *  promise. Resolve or reject the in-flight fetch by hand — microtasks are
 *  drained so the store settles before the next assertion. Replaces the
 *  hand-rolled `resolvers[]` arrays the timing tests used to repeat. */
export const mockAsyncSource = <T = unknown>() => {
    const pending: Array<{ resolve: (v: T) => void; reject: (e: unknown) => void }> = []
    let callCount = 0
    return {
        fn: (): Promise<T> =>
            new Promise<T>((resolve, reject) => {
                callCount++
                pending.push({ resolve, reject })
            }),
        /** Number of times the source has been invoked (fetches started). */
        get callCount() {
            return callCount
        },
        /** Resolve a fetch (default: the latest in flight), then settle. */
        resolve: async (value: T, index = pending.length - 1) => {
            pending[index]?.resolve(value)
            await drainMicrotasks()
        },
        /** Reject a fetch (default: the latest in flight), then settle. */
        reject: async (
            error: unknown = new Error("mock fetch failed"),
            index = pending.length - 1,
        ) => {
            pending[index]?.reject(error)
            await drainMicrotasks()
        },
    }
}
