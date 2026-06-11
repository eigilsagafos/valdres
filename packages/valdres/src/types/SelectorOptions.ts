import type { EqualFunc } from "./EqualFunc"
import type { Schema } from "./Schema"

export type SelectorOptions<Value extends any> = {
    name?: string
    /** Schema to validate this selector's result against. A no-op unless
     *  validation is enabled — set `store({ schemaValidation: true })` or this
     *  selector's own `schemaValidation: true`. Validate-only: the value is
     *  checked but returned unchanged. See {@link Schema}. */
    schema?: Schema<Value>
    /** Per-selector override of the store's `schemaValidation` flag. When set,
     *  it wins over the store-level setting — use `true` to always validate a
     *  boundary selector (even in a store with validation off), or `false` to
     *  exempt a hot selector. Defaults to the store's setting. */
    schemaValidation?: boolean
    equal?: EqualFunc<Value>
}
