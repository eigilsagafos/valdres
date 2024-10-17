export type FamilyKey =
    | PropertyKey
    | PropertyKey[]
    | { [key: PropertyKey]: FamilyKey }
