import type {
    BuilderQueryDefinition,
    Collection,
    CollectionRow,
    Equal,
    Expect,
    MultiValueIndex,
    ObjectWhere,
    OrderTerm,
    OrderedIndex,
    QueryDefinitionOf,
    QueryBuilder,
    StateValue,
    ValueIndex,
} from "./model"
import {
    family,
    queryWithBuilder,
    queryWithObject,
    searchIndex,
    searchSource,
    withBuilderQuery,
    withObjectQuery,
} from "./model"

type MovieId = string & { readonly __movieId: true }
type PersonId = string & { readonly __personId: true }
type Genre = "comedy" | "documentary" | "drama"
type Tag = "award-winner" | "classic" | "family" | "spoiler"

interface Movie {
    readonly title: string
    readonly genre: Genre
    readonly tags: readonly Tag[]
    readonly rating: number
    readonly releasedAt: number
}

interface Person {
    readonly name: string
    readonly bornAt: number
}

interface MovieIndexes {
    readonly genre: ValueIndex<Genre>
    readonly tags: MultiValueIndex<Tag>
    readonly rating: OrderedIndex<number>
    readonly releasedAt: OrderedIndex<number>
}

interface PersonIndexes {
    readonly name: ValueIndex<string>
    readonly bornAt: OrderedIndex<number>
}

declare const movies: Collection<MovieId, Movie, MovieIndexes>
declare const people: Collection<PersonId, Person, PersonIndexes>

type MovieRow = CollectionRow<MovieId, Movie>
type PersonRow = CollectionRow<PersonId, Person>

// A: standalone ownership + query-local builder callback.
export const builderSimple = queryWithBuilder(movies, query => ({
    where: query.index.genre.eq("drama"),
}))

export const builderPopularDrama = queryWithBuilder(movies, query => ({
    where: query.all(
        query.index.genre.eq("drama"),
        query.index.tags.hasAny(["award-winner", "classic"]),
        query.index.rating.gte(8),
    ),
    orderBy: query.index.releasedAt.desc(),
    offset: 0,
    limit: 24,
    facets: {
        genre: query.index.genre.facet({ mode: "disjunctive" }),
        tags: query.index.tags.facet({ mode: "disjunctive" }),
    },
}))

export const builderNestedBoolean = queryWithBuilder(movies, query => ({
    where: query.all(
        query.index.genre.eq("drama"),
        query.any(query.index.releasedAt.gte(2020), query.index.rating.gte(9)),
        query.not(query.index.tags.has("spoiler")),
    ),
}))

export const builderRepeatedConstraint = queryWithBuilder(movies, query => ({
    where: query.all(
        query.index.releasedAt.gte(1980),
        query.index.releasedAt.lt(1990),
    ),
}))

type MovieQueryBuilder = QueryBuilder<MovieIndexes>
const isClassic = (query: MovieQueryBuilder) => query.index.tags.has("classic")
const isRecent = (query: MovieQueryBuilder) => query.index.releasedAt.gte(2020)

export const builderReusableFragments = queryWithBuilder(movies, query => ({
    where: query.any(isClassic(query), isRecent(query)),
}))

export const builderByGenre = family((genre: Genre, page: number) =>
    queryWithBuilder(movies, query => ({
        where: query.index.genre.eq(genre),
        orderBy: query.index.rating.desc(),
        offset: page * 50,
        limit: 50,
    })),
)

// C: standalone ownership + recursively typed object grammar.
export const objectSimple = queryWithObject(movies, {
    where: { genre: { eq: "drama" } },
})

export const objectPopularDrama = queryWithObject(movies, {
    where: {
        genre: { eq: "drama" },
        tags: { hasAny: ["award-winner", "classic"] },
        rating: { gte: 8 },
    },
    orderBy: { releasedAt: "desc" },
    offset: 0,
    limit: 24,
    facets: {
        genre: { mode: "disjunctive" },
        tags: { mode: "disjunctive" },
    },
})

export const objectNestedBoolean = queryWithObject(movies, {
    where: {
        genre: { eq: "drama" },
        $any: [{ releasedAt: { gte: 2020 } }, { rating: { gte: 9 } }],
        $not: { tags: { has: "spoiler" } },
    },
})

export const objectRepeatedConstraint = queryWithObject(movies, {
    where: {
        $all: [{ releasedAt: { gte: 1980 } }, { releasedAt: { lt: 1990 } }],
    },
})

const classicObjectFragment: ObjectWhere<MovieIndexes> = {
    tags: { has: "classic" },
}
const recentObjectFragment: ObjectWhere<MovieIndexes> = {
    releasedAt: { gte: 2020 },
}

export const objectReusableFragments = queryWithObject(movies, {
    where: { $any: [classicObjectFragment, recentObjectFragment] },
})

export const objectByGenre = family((genre: Genre, page: number) =>
    queryWithObject(movies, {
        where: { genre: { eq: genre } },
        orderBy: { rating: "desc" },
        offset: page * 50,
        limit: 50,
    }),
)

// Ownership comparison: the same two grammars attached to a Collection.
const builderMovies = withBuilderQuery(movies)
const objectMovies = withObjectQuery(movies)

export const attachedBuilderSimple = builderMovies.query(query => ({
    where: query.index.genre.eq("drama"),
}))

export const attachedBuilderPopularDrama = builderMovies.query(query => ({
    where: query.all(
        query.index.genre.eq("drama"),
        query.index.tags.hasAny(["award-winner", "classic"]),
        query.index.rating.gte(8),
    ),
    orderBy: query.index.releasedAt.desc(),
    offset: 0,
    limit: 24,
    facets: {
        genre: query.index.genre.facet({ mode: "disjunctive" }),
        tags: query.index.tags.facet({ mode: "disjunctive" }),
    },
}))

export const attachedBuilderNestedBoolean = builderMovies.query(query => ({
    where: query.all(
        query.index.genre.eq("drama"),
        query.any(query.index.releasedAt.gte(2020), query.index.rating.gte(9)),
        query.not(query.index.tags.has("spoiler")),
    ),
}))

export const attachedBuilderRepeatedConstraint = builderMovies.query(query => ({
    where: query.all(
        query.index.releasedAt.gte(1980),
        query.index.releasedAt.lt(1990),
    ),
}))

export const attachedBuilderReusableFragments = builderMovies.query(query => ({
    where: query.any(isClassic(query), isRecent(query)),
}))

export const attachedBuilderByGenre = family((genre: Genre, page: number) =>
    builderMovies.query(query => ({
        where: query.index.genre.eq(genre),
        orderBy: query.index.rating.desc(),
        offset: page * 50,
        limit: 50,
    })),
)

export const attachedObjectSimple = objectMovies.query({
    where: { genre: { eq: "drama" } },
})

export const attachedObjectPopularDrama = objectMovies.query({
    where: {
        genre: { eq: "drama" },
        tags: { hasAny: ["award-winner", "classic"] },
        rating: { gte: 8 },
    },
    orderBy: { releasedAt: "desc" },
    offset: 0,
    limit: 24,
    facets: {
        genre: { mode: "disjunctive" },
        tags: { mode: "disjunctive" },
    },
})

export const attachedObjectNestedBoolean = objectMovies.query({
    where: {
        genre: { eq: "drama" },
        $any: [{ releasedAt: { gte: 2020 } }, { rating: { gte: 9 } }],
        $not: { tags: { has: "spoiler" } },
    },
})

export const attachedObjectRepeatedConstraint = objectMovies.query({
    where: {
        $all: [{ releasedAt: { gte: 1980 } }, { releasedAt: { lt: 1990 } }],
    },
})

export const attachedObjectReusableFragments = objectMovies.query({
    where: { $any: [classicObjectFragment, recentObjectFragment] },
})

export const attachedObjectByGenre = family((genre: Genre, page: number) =>
    objectMovies.query({
        where: { genre: { eq: genre } },
        orderBy: { rating: "desc" },
        offset: page * 50,
        limit: 50,
    }),
)

type BuilderResult = StateValue<typeof builderPopularDrama>
type ObjectResult = StateValue<typeof objectPopularDrama>
type AttachedBuilderResult = StateValue<typeof attachedBuilderPopularDrama>
type AttachedObjectResult = StateValue<typeof attachedObjectPopularDrama>

type _BuilderRow = Expect<Equal<BuilderResult["rows"][number], MovieRow>>
type _ObjectRow = Expect<Equal<ObjectResult["rows"][number], MovieRow>>
type _BuilderFacetKeys = Expect<
    Equal<keyof BuilderResult["facets"], "genre" | "tags">
>
type _ObjectFacetKeys = Expect<
    Equal<keyof ObjectResult["facets"], "genre" | "tags">
>
type _BuilderGenreFacet = Expect<
    Equal<BuilderResult["facets"]["genre"][number]["value"], Genre>
>
type _ObjectGenreFacet = Expect<
    Equal<ObjectResult["facets"]["genre"][number]["value"], Genre>
>
type _BuilderOwnershipParity = Expect<
    Equal<AttachedBuilderResult, BuilderResult>
>
type _ObjectOwnershipParity = Expect<Equal<AttachedObjectResult, ObjectResult>>

const builderOrderTupleProbe = queryWithBuilder(movies, query => ({
    orderBy: [query.index.rating.desc(), query.index.releasedAt.asc()] as const,
}))
const objectOrderTupleProbe = queryWithObject(movies, {
    orderBy: [{ rating: "desc" }, { releasedAt: "asc" }] as const,
})

type _BuilderOrderTuple = Expect<
    Equal<
        QueryDefinitionOf<typeof builderOrderTupleProbe>["orderBy"],
        readonly [OrderTerm<MovieIndexes>, OrderTerm<MovieIndexes>]
    >
>
type _ObjectOrderTuple = Expect<
    Equal<
        QueryDefinitionOf<typeof objectOrderTupleProbe>["orderBy"],
        readonly [{ readonly rating: "desc" }, { readonly releasedAt: "asc" }]
    >
>

const builderNegative = queryWithBuilder(movies, query => ({
    // @ts-expect-error genre values are a closed domain
    where: query.index.genre.eq("horror"),
    // @ts-expect-error a multi-value index has no numeric range ordering
    orderBy: query.index.tags.desc(),
}))
void builderNegative

const objectNegative = queryWithObject(movies, {
    // @ts-expect-error genre values are a closed domain
    where: { genre: { eq: "horror" } },
    // @ts-expect-error only an ordered index can be used for orderBy
    orderBy: { genre: "asc" },
})
void objectNegative

const objectEmptyConstraint = queryWithObject(movies, {
    where: {
        // @ts-expect-error one concrete operator is required
        genre: {},
    },
})
void objectEmptyConstraint

const objectMultipleOperators = queryWithObject(movies, {
    where: {
        // @ts-expect-error one constraint object cannot select two operators
        genre: { eq: "drama", anyOf: ["comedy"] },
    },
})
void objectMultipleOperators

const objectUnknownOperator = queryWithObject(movies, {
    where: {
        // @ts-expect-error object operators are a closed grammar
        genre: { equals: "drama" },
    },
})
void objectUnknownOperator

const objectExtraOperator = queryWithObject(movies, {
    where: {
        genre: {
            eq: "drama",
            // @ts-expect-error valid operators cannot hide an unknown operator
            equals: "drama",
        },
    },
})
void objectExtraOperator

const objectUnknownIndex = queryWithObject(movies, {
    where: {
        genre: { eq: "drama" },
        // @ts-expect-error object indexes are a closed collection-local set
        category: { eq: "drama" },
    },
})
void objectUnknownIndex

const objectNestedUnknownIndex = queryWithObject(movies, {
    where: {
        // @ts-expect-error exactness is recursive through Boolean lists
        $all: [
            {
                genre: { eq: "drama" },
                category: { eq: "drama" },
            },
        ],
    },
})
void objectNestedUnknownIndex

const objectNestedUnknownOperator = queryWithObject(movies, {
    where: {
        // @ts-expect-error exactness is recursive through Boolean negation
        $not: { genre: { eq: "drama", equals: "drama" } },
    },
})
void objectNestedUnknownOperator

const objectUnknownFacet = queryWithObject(movies, {
    facets: {
        genre: true,
        // @ts-expect-error facets are a closed collection-local set
        category: true,
    },
})
void objectUnknownFacet

const objectUnknownFacetOption = queryWithObject(movies, {
    facets: {
        genre: {
            // @ts-expect-error facet options are a closed grammar
            typo: true,
        },
    },
})
void objectUnknownFacetOption

const objectExtraFacetOption = queryWithObject(movies, {
    facets: {
        genre: {
            mode: "disjunctive",
            // @ts-expect-error valid facet options cannot hide an unknown option
            typo: true,
        },
    },
})
void objectExtraFacetOption

const objectUnknownDefinitionField = queryWithObject(movies, {
    where: { genre: { eq: "drama" } },
    // @ts-expect-error query definition fields are a closed grammar
    pageSize: 24,
})
void objectUnknownDefinitionField

const attachedObjectUnknownDefinitionField = objectMovies.query({
    where: { genre: { eq: "drama" } },
    // @ts-expect-error attached ownership applies the same exact grammar
    pageSize: 24,
})
void attachedObjectUnknownDefinitionField

const objectUndefinedSecondOperator = queryWithObject(movies, {
    where: {
        // @ts-expect-error an explicitly undefined key is still a second operator
        genre: { eq: "drama", anyOf: undefined },
    },
})
void objectUndefinedSecondOperator

const objectMultipleOrderFields = queryWithObject(movies, {
    // @ts-expect-error one order term names exactly one ordered index
    orderBy: { rating: "desc", releasedAt: "asc" },
})
void objectMultipleOrderFields

const objectUnknownOrderField = queryWithObject(movies, {
    // @ts-expect-error valid order fields cannot hide an unknown field
    orderBy: { rating: "desc", popularity: "asc" },
})
void objectUnknownOrderField

const objectUndefinedSecondOrderField = queryWithObject(movies, {
    // @ts-expect-error an explicitly undefined key is still a second order field
    orderBy: { rating: "desc", releasedAt: undefined },
})
void objectUndefinedSecondOrderField

declare const personQueryBuilder: QueryBuilder<PersonIndexes>

const builderForeignTerms: BuilderQueryDefinition<MovieIndexes> = {
    // @ts-expect-error predicates retain their originating index map
    where: personQueryBuilder.index.name.eq("Ada"),
    // @ts-expect-error order terms retain their originating index map
    orderBy: personQueryBuilder.index.bornAt.desc(),
    facets: {
        // @ts-expect-error facet terms retain their originating index map
        personName: personQueryBuilder.index.name.facet(),
    },
}
void builderForeignTerms

declare const personObjectFragment: ObjectWhere<PersonIndexes>

// @ts-expect-error reusable object fragments retain their originating index map
const movieObjectFragment: ObjectWhere<MovieIndexes> = personObjectFragment
void movieObjectFragment

// Future beta multi-collection shape: source and row remain correlated.
export const globalSearch = searchIndex({
    sources: {
        movie: searchSource(movies),
        person: searchSource(people),
    },
})

type GlobalHit = StateValue<typeof globalSearch>[number]

export function narrowGlobalHit(hit: GlobalHit): MovieRow | PersonRow {
    if (hit.source === "movie") {
        const row: MovieRow = hit.row
        // @ts-expect-error discriminant narrowing excludes PersonRow
        const wrong: PersonRow = hit.row
        void wrong
        return row
    }

    const row: PersonRow = hit.row
    // @ts-expect-error discriminant narrowing excludes MovieRow
    const wrong: MovieRow = hit.row
    void wrong
    return row
}
