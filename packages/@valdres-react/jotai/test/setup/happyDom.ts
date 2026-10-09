import { GlobalRegistrator } from "@happy-dom/global-registrator"
import * as matchers from "@testing-library/jest-dom/matchers"
import { afterEach, expect } from "bun:test"

GlobalRegistrator.register()
expect.extend(matchers as never)
// Vitest matcher used upstream that bun:test lacks.
expect.extend({
    toHaveBeenCalledExactlyOnceWith(received: unknown, ...expected: unknown[]) {
        const calls = (received as { mock: { calls: unknown[][] } }).mock.calls
        const pass = calls.length === 1 && this.equals(calls[0], expected)
        return {
            pass,
            message: () =>
                `expected exactly one call with ${this.utils.printExpected(expected)}, got ${this.utils.printReceived(calls)}`,
        }
    },
})
;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

// Vitest exposes `afterEach` as a global, which Testing Library uses to unmount
// rendered trees between tests; bun:test does not, so register it here.
const { cleanup } = await import("@testing-library/react")
afterEach(() => {
    cleanup()
})
