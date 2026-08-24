/**
 * Renders an unknown caught value as a message.
 *
 * `catch` binds `unknown`, and `(thrown as Error).message` prints "undefined"
 * for anything that is not an Error — a string throw, a rejected non-Error, a
 * thrown `undefined`. Release scripts report these straight to CI logs, where a
 * message reading "undefined" costs real debugging time.
 */
export function describeError(thrown: unknown): string {
    if (thrown instanceof Error) return thrown.message
    if (typeof thrown === "string" && thrown !== "") return thrown
    return `non-Error value thrown: ${Bun.inspect(thrown)}`
}
