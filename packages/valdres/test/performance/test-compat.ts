// Runtime-agnostic test harness — resolves bun:test or vitest at runtime.
// All .bench.ts files import from here instead of a runtime-specific module.

let _describe: any
let _test: any
let _expect: any

if (typeof Bun !== "undefined") {
    const bunTest = await import("bun:test")
    _describe = bunTest.describe
    _test = bunTest.test
    _expect = bunTest.expect
} else {
    const vitest = await import("vitest")
    _describe = vitest.describe
    _test = vitest.test
    _expect = vitest.expect
}

export const nanoseconds: () => number =
    typeof Bun !== "undefined"
        ? () => Bun.nanoseconds()
        : () => Math.round(performance.now() * 1_000_000)

export { _describe as describe, _test as test, _expect as expect }
