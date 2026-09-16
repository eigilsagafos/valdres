import type { QueryDefinition } from "../types/QueryDefinition"
import type { QueryWhere } from "../types/QueryWhere"

type ExactEquality<Value, Term> = Term extends { readonly eq: Value }
    ? { readonly [Key in keyof Term]: Key extends "eq" ? Term[Key] : never }
    : never

type ExactWhere<Indexes, Where> =
    Where extends QueryWhere<Indexes>
        ? {
              readonly [Name in keyof Where]: Name extends keyof Indexes
                  ? ExactEquality<Indexes[Name], Where[Name]>
                  : never
          }
        : never

/** Check inferred keys at every grammar level, including predeclared values. */
export type ExactQueryDefinition<Indexes, Definition> =
    Definition extends QueryDefinition<Indexes>
        ? {
              readonly [Name in keyof Definition]: Name extends "where"
                  ? ExactWhere<Indexes, Definition[Name]>
                  : never
          }
        : never
