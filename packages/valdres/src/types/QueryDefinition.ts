import type { QueryWhere } from "./QueryWhere"

export interface QueryDefinition<Indexes> {
    readonly where: QueryWhere<Indexes>
}
