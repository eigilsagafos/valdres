/**
 * A Zod-compatible schema interface. Pass a Zod schema (e.g. `z.string()`)
 * to validate atom/selector values at runtime.
 */
export type Schema<V = unknown> = {
    parse: (value: unknown) => V
}
