/**
 * `DOMException`s with the names the platform uses, so callers can test
 * `error.name === "AbortError"` the same way for a cancelled `fetch`.
 */
const named = (message: string, name: string): Error =>
    typeof DOMException === "function"
        ? (new DOMException(message, name) as Error)
        : Object.assign(new Error(message), { name })

export const abortError = (message: string): Error =>
    named(message, "AbortError")
export const timeoutError = (message: string): Error =>
    named(message, "TimeoutError")
export const notSupportedError = (message: string): Error =>
    named(message, "NotSupportedError")
