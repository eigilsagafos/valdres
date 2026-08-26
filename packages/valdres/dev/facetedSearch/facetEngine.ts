// The faceted-search reference engine — the TARGET behavior we want valdres
// to power natively. It implements DISJUNCTIVE faceting (Algolia / Elasticsearch
// semantics): the count shown for a facet field F is computed by applying every
// active filter EXCEPT F's own, so multi-select within F keeps its other values
// live, while a DIFFERENT field's filter still narrows F's counts.
//
// This is deliberately a small, pure module: it is the spec the architecture
// discussion is about, and the brute-force oracle a future differential fuzzer
// would gate the real (indexed) implementation against. The demo runs valdres'
// atomFamilySearch for the text-relevance candidate set, then this engine for
// structured filtering + facet counts.

import type { Movie } from "./data"

export type FacetState = {
    genres: string[]
    /** "or" → a movie matches ANY selected genre (disjunctive). "and" → a
     *  movie must have ALL selected genres (conjunctive). */
    genresMode: "or" | "and"
    decades: number[] // OR within, disjunctive
    directors: string[] // OR within, disjunctive
    ratingMin: number // range (>= ); 0 = no constraint
}

export const emptyFacetState = (): FacetState => ({
    genres: [],
    genresMode: "or",
    decades: [],
    directors: [],
    ratingMin: 0,
})

/** Per-field clause predicates. A field with no active selection is the
 *  always-true predicate (no constraint). Each is one "conjunction-level"
 *  clause — exactly the shape disjunctive faceting is defined over. */
const clauses = (f: FacetState): Record<string, (m: Movie) => boolean> => ({
    genres: m =>
        f.genres.length === 0 ||
        (f.genresMode === "and"
            ? f.genres.every(g => m.genres.includes(g))
            : m.genres.some(g => f.genres.includes(g))),
    decades: m => f.decades.length === 0 || f.decades.includes(m.decade),
    directors: m => f.directors.length === 0 || f.directors.includes(m.director),
    rating: m => f.ratingMin <= 0 || m.rating >= f.ratingMin,
})

const FIELDS = ["genres", "decades", "directors", "rating"] as const

/** Movies passing every clause EXCEPT `skip` (pass all when skip is null).
 *  This is the disjunctive "exclude-own-filter" base set. */
const baseExcluding = (
    candidates: Movie[],
    cl: Record<string, (m: Movie) => boolean>,
    skip: string | null,
): Movie[] =>
    candidates.filter(m =>
        FIELDS.every(field => field === skip || cl[field](m)),
    )

export type FacetCounts = {
    genres: { value: string; count: number }[]
    decades: { value: number; count: number }[]
    directors: { value: string; count: number }[]
    /** Count of movies at or above each star threshold (disjunctive on rating). */
    rating: { threshold: number; count: number }[]
}

export type FacetResult = {
    /** Movies passing ALL active filters, in `candidates` order. */
    hits: Movie[]
    total: number
    /** Disjunctive facet counts (each field counted with its own filter dropped). */
    facets: FacetCounts
}

const RATING_THRESHOLDS = [9, 8, 7, 6, 5]

/** Tally a value→count map over `movies`, keeping insertion order via a Map. */
const tally = <K>(movies: Movie[], key: (m: Movie) => K | K[]): Map<K, number> => {
    const out = new Map<K, number>()
    for (const m of movies) {
        const v = key(m)
        const vals = Array.isArray(v) ? v : [v]
        // Dedupe per movie (a value counts once even if listed twice).
        for (const x of new Set(vals)) out.set(x, (out.get(x) ?? 0) + 1)
    }
    return out
}

export const computeFacets = (
    candidates: Movie[],
    f: FacetState,
): FacetResult => {
    const cl = clauses(f)
    const hits = baseExcluding(candidates, cl, null)

    // Genre counts depend on the mode:
    //  - "or"  (disjunctive): drop the genre clause, so picking one genre keeps
    //    the others' counts live (multi-select OR).
    //  - "and" (conjunctive): keep the genre clause — count over the fully
    //    filtered hits, so each value shows "how many results ALSO have this
    //    genre" (selected genres show the full hit count). Conjunctive counting
    //    MUST pair with conjunctive filtering, which clauses() now does.
    const gBase =
        f.genresMode === "and" ? hits : baseExcluding(candidates, cl, "genres")
    const dBase = baseExcluding(candidates, cl, "decades")
    const dirBase = baseExcluding(candidates, cl, "directors")
    const rBase = baseExcluding(candidates, cl, "rating")

    const gCounts = tally(gBase, m => m.genres)
    const decCounts = tally(dBase, m => m.decade)
    const dirCounts = tally(dirBase, m => m.director)

    return {
        hits,
        total: hits.length,
        facets: {
            // Always surface every selected value (count 0 if it dropped out),
            // so a refinement never silently vanishes from the panel.
            genres: withSelectedZero(gCounts, f.genres).sort(byCountDescThenLabel),
            decades: [...decCounts.entries()]
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => a.value - b.value),
            directors: withSelectedZero(dirCounts, f.directors)
                .sort(byCountDescThenLabel),
            rating: RATING_THRESHOLDS.map(threshold => ({
                threshold,
                count: rBase.filter(m => m.rating >= threshold).length,
            })),
        },
    }
}

const withSelectedZero = (
    counts: Map<string, number>,
    selected: string[],
): { value: string; count: number }[] => {
    const m = new Map(counts)
    for (const s of selected) if (!m.has(s)) m.set(s, 0)
    return [...m.entries()].map(([value, count]) => ({ value, count }))
}

const byCountDescThenLabel = (
    a: { value: string; count: number },
    b: { value: string; count: number },
) => (b.count !== a.count ? b.count - a.count : a.value < b.value ? -1 : 1)
