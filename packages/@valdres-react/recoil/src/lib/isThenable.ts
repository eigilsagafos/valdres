export const isThenable = (value: unknown): value is PromiseLike<unknown> =>
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
