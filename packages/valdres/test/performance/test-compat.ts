// Runtime-agnostic test harness — resolves bun:test or vitest at runtime.
// Performance and cross-engine rewrite-guard suites import from here instead
// of a runtime-specific module.

let _describe: any
let _test: any
let _expect: any
let _jest: any

if (typeof Bun !== "undefined") {
    const bunTest = await import("bun:test")
    _describe = bunTest.describe
    _test = bunTest.test
    _expect = bunTest.expect
    _jest = bunTest.jest
} else {
    const vitest = await import("vitest")
    _describe = vitest.describe
    _test = vitest.test
    _expect = vitest.expect
    _jest = vitest.vi
}

export {
    _describe as describe,
    _test as test,
    _expect as expect,
    _jest as jest,
}
