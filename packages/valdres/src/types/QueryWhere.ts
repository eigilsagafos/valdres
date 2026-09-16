/** Exactly one declared scalar equality index, with no compound terms. */
export type QueryWhere<Indexes> = {
    [Name in keyof Indexes]: {
        readonly [Key in Name]: { readonly eq: Indexes[Name] }
    } & { readonly [Other in Exclude<keyof Indexes, Name>]?: never }
}[keyof Indexes]
