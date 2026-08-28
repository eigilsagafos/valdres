/**
 * Compile-only model for the v1 query-construction API experiment.
 *
 * Nothing in this file is a production implementation or a stable public API.
 * The declarations intentionally model only the type relationships needed to
 * compare query ownership and definition grammar.
 */

declare const stateValue: unique symbol
declare const collectionTypes: unique symbol
declare const indexType: unique symbol
declare const indexKind: unique symbol
declare const predicateType: unique symbol
declare const orderType: unique symbol
declare const facetType: unique symbol
declare const objectWhereIndexes: unique symbol
declare const queryDefinition: unique symbol
declare const searchSourceType: unique symbol

export interface State<Value> {
    readonly [stateValue]: Value
}

export type StateValue<Target extends State<unknown>> =
    Target[typeof stateValue]

export type CanonicalKey = string | number | bigint | boolean | null

export interface CollectionRow<Key extends CanonicalKey, Value>
    extends State<Value | undefined> {
    readonly key: Key
}

export type IndexKind = "value" | "multiValue" | "ordered"

export interface IndexDescriptor<Value, Kind extends IndexKind> {
    readonly [indexType]: Value
    readonly [indexKind]: Kind
}

export type ValueIndex<Value> = IndexDescriptor<Value, "value">
export type MultiValueIndex<Value> = IndexDescriptor<Value, "multiValue">
export type OrderedIndex<Value> = IndexDescriptor<Value, "ordered">
export type IndexMap = Readonly<object>

export interface Collection<
    Key extends CanonicalKey,
    Value,
    Indexes extends IndexMap,
> extends State<readonly CollectionRow<Key, Value>[]> {
    (key: Key): CollectionRow<Key, Value>
    readonly indexes: Indexes
    readonly [collectionTypes]: {
        readonly key: Key
        readonly value: Value
        readonly indexes: Indexes
        readonly row: CollectionRow<Key, Value>
    }
}

export type AnyCollection = Collection<any, any, any>

type CollectionTypes<Target extends AnyCollection> =
    Target[typeof collectionTypes]

export type RowOf<Target extends AnyCollection> = CollectionTypes<Target>["row"]

export type IndexesOf<Target extends AnyCollection> =
    CollectionTypes<Target>["indexes"]

export type IndexValue<Target> =
    Target extends IndexDescriptor<infer Value, IndexKind> ? Value : never

type IndexProvenance<Indexes extends IndexMap> = (indexes: Indexes) => Indexes

export interface Predicate<Indexes extends IndexMap> {
    readonly [predicateType]: IndexProvenance<Indexes>
}

export interface OrderTerm<Indexes extends IndexMap> {
    readonly [orderType]: IndexProvenance<Indexes>
}

export type FacetMode = "conjunctive" | "disjunctive"
export type FacetOrder = "count-desc" | "value-asc" | "value-desc"

export interface FacetOptions {
    readonly mode?: FacetMode
    readonly order?: FacetOrder
}

export interface FacetTerm<Indexes extends IndexMap, Value> {
    readonly [facetType]: Readonly<{
        indexes: IndexProvenance<Indexes>
        value: Value
    }>
}

export interface FacetBucket<Value> {
    readonly value: Value
    readonly count: number
}

export interface QueryResult<Row, Facets> {
    readonly rows: readonly Row[]
    readonly total: number
    readonly facets: Facets
}

export interface StructuralQuery<Row, Facets, Definition = unknown>
    extends State<QueryResult<Row, Facets>> {
    readonly [queryDefinition]: Definition
}

export type QueryDefinitionOf<Target> =
    Target extends StructuralQuery<unknown, unknown, infer Definition>
        ? Definition
        : never

type ScalarBuilderOps<Indexes extends IndexMap, Value> = {
    eq(value: Value): Predicate<Indexes>
    anyOf(values: readonly Value[]): Predicate<Indexes>
    facet(options?: FacetOptions): FacetTerm<Indexes, Value>
}

type MultiValueBuilderOps<Indexes extends IndexMap, Value> = {
    has(value: Value): Predicate<Indexes>
    hasAny(values: readonly Value[]): Predicate<Indexes>
    hasAll(values: readonly Value[]): Predicate<Indexes>
    facet(options?: FacetOptions): FacetTerm<Indexes, Value>
}

type OrderedBuilderOps<Indexes extends IndexMap, Value> = ScalarBuilderOps<
    Indexes,
    Value
> & {
    gt(value: Value): Predicate<Indexes>
    gte(value: Value): Predicate<Indexes>
    lt(value: Value): Predicate<Indexes>
    lte(value: Value): Predicate<Indexes>
    between(lower: Value, upper: Value): Predicate<Indexes>
    asc(): OrderTerm<Indexes>
    desc(): OrderTerm<Indexes>
}

export type BuilderOps<Indexes extends IndexMap, Target> =
    Target extends IndexDescriptor<infer Value, "ordered">
        ? OrderedBuilderOps<Indexes, Value>
        : Target extends IndexDescriptor<infer Value, "multiValue">
          ? MultiValueBuilderOps<Indexes, Value>
          : Target extends IndexDescriptor<infer Value, "value">
            ? ScalarBuilderOps<Indexes, Value>
            : never

export type QueryBuilder<Indexes extends IndexMap> = {
    readonly index: {
        readonly [Name in keyof Indexes]: BuilderOps<Indexes, Indexes[Name]>
    }
    all(...predicates: readonly Predicate<Indexes>[]): Predicate<Indexes>
    any(...predicates: readonly Predicate<Indexes>[]): Predicate<Indexes>
    not(predicate: Predicate<Indexes>): Predicate<Indexes>
}

export interface BuilderQueryDefinition<Indexes extends IndexMap> {
    readonly where?: Predicate<Indexes>
    readonly orderBy?: OrderTerm<Indexes> | readonly OrderTerm<Indexes>[]
    readonly offset?: number
    readonly limit?: number
    readonly facets?: Readonly<Record<string, FacetTerm<Indexes, unknown>>>
}

type BuilderFacetValue<Target> =
    Target extends FacetTerm<infer _Indexes, infer Value> ? Value : never

type BuilderFacetResult<Definition> = Definition extends {
    readonly facets: infer Facets
}
    ? {
          readonly [Name in keyof Facets]: readonly FacetBucket<
              BuilderFacetValue<Facets[Name]>
          >[]
      }
    : Readonly<Record<never, never>>

export declare function queryWithBuilder<
    Target extends AnyCollection,
    const Definition extends BuilderQueryDefinition<IndexesOf<Target>>,
>(
    collection: Target,
    define: (builder: QueryBuilder<IndexesOf<Target>>) => Definition,
): StructuralQuery<RowOf<Target>, BuilderFacetResult<Definition>, Definition>

export type BuilderQueryCollection<Target extends AnyCollection> = Target & {
    query<const Definition extends BuilderQueryDefinition<IndexesOf<Target>>>(
        define: (builder: QueryBuilder<IndexesOf<Target>>) => Definition,
    ): StructuralQuery<
        RowOf<Target>,
        BuilderFacetResult<Definition>,
        Definition
    >
}

export declare function withBuilderQuery<Target extends AnyCollection>(
    collection: Target,
): BuilderQueryCollection<Target>

type ExactlyOne<Options extends Readonly<Record<PropertyKey, unknown>>> = {
    readonly [Name in keyof Options]: Readonly<
        { readonly [Selected in Name]: Options[Selected] } & {
            readonly [Other in Exclude<keyof Options, Name>]?: never
        }
    >
}[keyof Options]

type ValueConstraint<Value> = ExactlyOne<{
    readonly eq: Value
    readonly anyOf: readonly Value[]
}>

type MultiValueConstraint<Value> = ExactlyOne<{
    readonly has: Value
    readonly hasAny: readonly Value[]
    readonly hasAll: readonly Value[]
}>

type OrderedConstraint<Value> = ExactlyOne<{
    readonly eq: Value
    readonly anyOf: readonly Value[]
    readonly gt: Value
    readonly gte: Value
    readonly lt: Value
    readonly lte: Value
    readonly between: readonly [lower: Value, upper: Value]
}>

export type ObjectConstraint<Target> =
    Target extends IndexDescriptor<infer Value, "ordered">
        ? OrderedConstraint<Value>
        : Target extends IndexDescriptor<infer Value, "multiValue">
          ? MultiValueConstraint<Value>
          : Target extends IndexDescriptor<infer Value, "value">
            ? ValueConstraint<Value>
            : never

type ObjectIndexConstraints<Indexes extends IndexMap> = {
    readonly [Name in keyof Indexes]?: ObjectConstraint<Indexes[Name]>
}

/**
 * `$all`, `$any`, and `$not` avoid stealing ordinary index names such as
 * `all`, `any`, or `not`. The experiment must still judge whether the sigils
 * are pleasant enough to freeze.
 */
export type ObjectWhere<Indexes extends IndexMap> =
    ObjectIndexConstraints<Indexes> & {
        readonly $all?: readonly ObjectWhere<Indexes>[]
        readonly $any?: readonly ObjectWhere<Indexes>[]
        readonly $not?: ObjectWhere<Indexes>
        readonly [objectWhereIndexes]?: IndexProvenance<Indexes>
    }

type OrderedIndexName<Indexes extends IndexMap> = {
    [Name in keyof Indexes]: Indexes[Name] extends IndexDescriptor<
        unknown,
        "ordered"
    >
        ? Name
        : never
}[keyof Indexes]

export type ObjectOrder<Indexes extends IndexMap> = {
    [Name in OrderedIndexName<Indexes>]: Readonly<
        Record<Name, "asc" | "desc"> &
            Partial<Record<Exclude<OrderedIndexName<Indexes>, Name>, never>>
    >
}[OrderedIndexName<Indexes>]

export type ObjectFacets<Indexes extends IndexMap> = {
    readonly [Name in keyof Indexes]?: true | FacetOptions
}

export type ObjectQueryDefinition<Indexes extends IndexMap> = {
    readonly where?: ObjectWhere<Indexes>
    readonly orderBy?: ObjectOrder<Indexes> | readonly ObjectOrder<Indexes>[]
    readonly offset?: number
    readonly limit?: number
    readonly facets?: ObjectFacets<Indexes>
}

type ExactObjectConstraint<Target, Constraint> =
    Constraint extends ObjectConstraint<Target>
        ? {
              readonly [Name in keyof Constraint]: Name extends keyof ObjectConstraint<Target>
                  ? Constraint[Name]
                  : never
          }
        : never

type ExactObjectWhereList<
    Indexes extends IndexMap,
    List,
> = List extends readonly (infer Item)[]
    ? readonly ExactObjectWhere<Indexes, Item>[]
    : never

type ExactObjectWhere<Indexes extends IndexMap, Where> =
    Where extends ObjectWhere<Indexes>
        ? {
              readonly [Name in keyof Where]: Name extends keyof Indexes
                  ? ExactObjectConstraint<Indexes[Name], Where[Name]>
                  : Name extends "$all" | "$any"
                    ? ExactObjectWhereList<Indexes, Where[Name]>
                    : Name extends "$not"
                      ? ExactObjectWhere<Indexes, Where[Name]>
                      : Name extends typeof objectWhereIndexes
                        ? Where[Name]
                        : never
          }
        : never

type ExactObjectOrderTerm<Indexes extends IndexMap, Term> =
    Term extends ObjectOrder<Indexes>
        ? {
              readonly [Name in keyof Term]: Name extends OrderedIndexName<Indexes>
                  ? Term[Name]
                  : never
          }
        : never

type ExactObjectOrder<
    Indexes extends IndexMap,
    Order,
> = Order extends readonly (infer Term)[]
    ? readonly ExactObjectOrderTerm<Indexes, Term>[]
    : ExactObjectOrderTerm<Indexes, Order>

type ExactFacetOptions<Options> = Options extends true
    ? true
    : Options extends FacetOptions
      ? {
            readonly [Name in keyof Options]: Name extends keyof FacetOptions
                ? Options[Name]
                : never
        }
      : never

type ExactObjectFacets<Indexes extends IndexMap, Facets> =
    Facets extends ObjectFacets<Indexes>
        ? {
              readonly [Name in keyof Facets]: Name extends keyof Indexes
                  ? ExactFacetOptions<Facets[Name]>
                  : never
          }
        : never

type ExactObjectQueryDefinition<Indexes extends IndexMap, Definition> =
    Definition extends ObjectQueryDefinition<Indexes>
        ? {
              readonly [Name in keyof Definition]: Name extends "where"
                  ? ExactObjectWhere<Indexes, Definition[Name]>
                  : Name extends "orderBy"
                    ? ExactObjectOrder<Indexes, Definition[Name]>
                    : Name extends "facets"
                      ? ExactObjectFacets<Indexes, Definition[Name]>
                      : Name extends keyof ObjectQueryDefinition<Indexes>
                        ? Definition[Name]
                        : never
          }
        : never

type ObjectFacetResult<
    Indexes extends IndexMap,
    Definition,
> = Definition extends { readonly facets: infer Facets }
    ? {
          readonly [Name in keyof Facets & keyof Indexes]: readonly FacetBucket<
              IndexValue<Indexes[Name]>
          >[]
      }
    : Readonly<Record<never, never>>

export declare function queryWithObject<
    Target extends AnyCollection,
    const Definition extends ObjectQueryDefinition<IndexesOf<Target>>,
>(
    collection: Target,
    definition: Definition &
        ExactObjectQueryDefinition<IndexesOf<Target>, Definition>,
): StructuralQuery<
    RowOf<Target>,
    ObjectFacetResult<IndexesOf<Target>, Definition>,
    Definition
>

export type ObjectQueryCollection<Target extends AnyCollection> = Target & {
    query<const Definition extends ObjectQueryDefinition<IndexesOf<Target>>>(
        definition: Definition &
            ExactObjectQueryDefinition<IndexesOf<Target>, Definition>,
    ): StructuralQuery<
        RowOf<Target>,
        ObjectFacetResult<IndexesOf<Target>, Definition>,
        Definition
    >
}

export declare function withObjectQuery<Target extends AnyCollection>(
    collection: Target,
): ObjectQueryCollection<Target>

export declare function family<Arguments extends unknown[], Result>(
    create: (...args: Arguments) => Result,
): (...args: Arguments) => Result

export interface SearchSource<Target extends AnyCollection> {
    readonly collection: Target
    readonly [searchSourceType]: Target
}

export declare function searchSource<Target extends AnyCollection>(
    collection: Target,
): SearchSource<Target>

type AnySearchSource = SearchSource<AnyCollection>
type SearchSources = Readonly<Record<string, AnySearchSource>>

export type SearchHit<Sources extends SearchSources> = {
    readonly [Name in keyof Sources]: Readonly<{
        source: Name
        row: RowOf<Sources[Name]["collection"]>
        score: number
    }>
}[keyof Sources]

export interface SearchIndex<Sources extends SearchSources>
    extends State<readonly SearchHit<Sources>[]> {}

export declare function searchIndex<const Sources extends SearchSources>(
    options: Readonly<{ sources: Sources }>,
): SearchIndex<Sources>

export type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends <
        Value,
    >() => Value extends Right ? 1 : 2
        ? true
        : false

export type Expect<Condition extends true> = Condition
