/** Values accepted by the deterministic atom/selector-family key codec. */
export type FamilyKey =
    | string
    | number
    | boolean
    | bigint
    | null
    | undefined
    | Date
    | readonly FamilyKey[]
    | { readonly [key: string]: FamilyKey }
    | ReadonlyMap<FamilyKey, FamilyKey>
    | ReadonlySet<FamilyKey>
