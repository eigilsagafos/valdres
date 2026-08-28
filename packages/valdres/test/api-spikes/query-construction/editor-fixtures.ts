import type {
    Collection,
    MultiValueIndex,
    OrderedIndex,
    QueryDefinitionOf,
    StateValue,
    ValueIndex,
} from "./model"
import {
    queryWithBuilder,
    queryWithObject,
    searchIndex,
    searchSource,
    withBuilderQuery,
    withObjectQuery,
} from "./model"

type MovieId = string & { readonly __movieId: true }
type PersonId = string & { readonly __personId: true }

interface Movie {
    readonly genre: "comedy" | "documentary" | "drama"
    readonly tags: readonly ("award-winner" | "classic" | "family")[]
    readonly rating: number
    readonly releasedAt: number
}

interface Person {
    readonly name: string
    readonly bornAt: number
}

interface MovieIndexes {
    readonly genre: ValueIndex<Movie["genre"]>
    readonly tags: MultiValueIndex<Movie["tags"][number]>
    readonly rating: OrderedIndex<number>
    readonly releasedAt: OrderedIndex<number>
}

interface PersonIndexes {
    readonly name: ValueIndex<string>
    readonly bornAt: OrderedIndex<number>
}

declare const movies: Collection<MovieId, Movie, MovieIndexes>
declare const people: Collection<PersonId, Person, PersonIndexes>

export const /*^quickinfo:builder-query*/ builderEditorQuery = queryWithBuilder(
        movies,
        query => ({
            where: query.index./*^completion:builder-indexes*/ genre./*^completion:builder-genre-operators*/ eq(
                "drama",
            ),
            orderBy: [
                query.index.rating.desc(),
                query.index.releasedAt.asc(),
            ] as const,
            facets: { genre: query.index.genre.facet() },
        }),
    )

export type /*^quickinfo:builder-facets*/ BuilderFacets = StateValue<
    typeof builderEditorQuery
>["facets"]

export type /*^quickinfo:builder-order*/ BuilderOrder = QueryDefinitionOf<
    typeof builderEditorQuery
>["orderBy"]

export const /*^quickinfo:object-query*/ objectEditorQuery = queryWithObject(
        movies,
        {
            where: {
                /*^completion:object-indexes*/ genre: {
                    /*^completion:object-genre-operators*/ eq: "drama",
                },
            },
            orderBy: [{ rating: "desc" }, { releasedAt: "asc" }] as const,
            facets: { genre: true },
        },
    )

export type /*^quickinfo:object-facets*/ ObjectFacets = StateValue<
    typeof objectEditorQuery
>["facets"]

export type /*^quickinfo:object-order*/ ObjectOrder = QueryDefinitionOf<
    typeof objectEditorQuery
>["orderBy"]

const builderMovies = withBuilderQuery(movies)
const objectMovies = withObjectQuery(movies)

export const /*^quickinfo:attached-builder-query*/ attachedBuilderEditorQuery =
        builderMovies./*^completion:attached-builder-members*/ query(query => ({
            where: query.index.genre.eq("drama"),
        }))

export const /*^quickinfo:attached-object-query*/ attachedObjectEditorQuery =
        objectMovies./*^completion:attached-object-members*/ query({
            where: { genre: { eq: "drama" } },
        })

export const globalEditorSearch = searchIndex({
    sources: {
        movie: searchSource(movies),
        person: searchSource(people),
    },
})

export type /*^quickinfo:multi-source-hit*/ MultiSourceHit = StateValue<
    typeof globalEditorSearch
>[number]
