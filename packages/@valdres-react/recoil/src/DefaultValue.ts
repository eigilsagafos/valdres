/**
 * Passed to a writable selector's `set` when it is reset, and accepted by
 * setters to reset an atom: `set(atom, new DefaultValue())`.
 */
export class DefaultValue {
    declare private readonly __tag: "DefaultValue"
}
