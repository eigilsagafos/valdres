import { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useStore, useValue } from "valdres-react"
import { atomFamily } from "../../src/atomFamily"
import { atomFamilySearch } from "../../src/atomFamilySearch"
import { GENRES, MOVIES, MOVIES_BY_ID, type Movie } from "./data"
import {
    computeFacets,
    emptyFacetState,
    type FacetState,
} from "./facetEngine"

// ── valdres: text relevance over the movie family ────────────────────────
// atomFamilySearch handles the search box; the facet engine (facetEngine.ts)
// handles structured filtering + disjunctive counts on top of its results.
const movie = atomFamily<Movie, [string]>(null, { name: "movie" })
const search = atomFamilySearch(
    movie,
    m => ({ title: m.title, cast: m.cast.join(" "), director: m.director }),
    {
        mode: "prefix",
        match: "ranked",
        fields: { title: { boost: 3 }, cast: { boost: 1 }, director: { boost: 1 } },
    },
)

const PAGE_SIZE = 18
const DIRECTOR_PREVIEW = 8

type SortKey = "relevance" | "rating" | "year-desc" | "year-asc" | "title"
const SORT_LABELS: Record<SortKey, string> = {
    relevance: "Relevance",
    rating: "Rating (high→low)",
    "year-desc": "Year (new→old)",
    "year-asc": "Year (old→new)",
    title: "Title (A→Z)",
}

const toggle = <T,>(xs: T[], x: T): T[] =>
    xs.includes(x) ? xs.filter(v => v !== x) : [...xs, x]

const Stars = ({ rating }: { rating: number }) => {
    const full = Math.round(rating / 2) // 0–5
    return (
        <span className="stars" title={`${rating.toFixed(1)} / 10`}>
            {"★".repeat(full)}
            {"☆".repeat(5 - full)}
            <span className="rating-num">{rating.toFixed(1)}</span>
        </span>
    )
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const highlight = (text: string, q: string) => {
    const toks = q.trim().split(/\s+/).filter(t => t.length >= 2).map(escapeRe)
    if (toks.length === 0) return text
    const parts = text.split(new RegExp(`(${toks.join("|")})`, "gi"))
    return parts.map((p, i) =>
        toks.some(t => new RegExp(`^${t}$`, "i").test(p)) ? (
            <mark key={i}>{p}</mark>
        ) : (
            <span key={i}>{p}</span>
        ),
    )
}

const RefinementList = ({
    title,
    items,
    selected,
    onToggle,
    searchable,
    previewCount,
    formatLabel,
}: {
    title: string
    items: { value: string; count: number }[]
    selected: string[]
    onToggle: (value: string) => void
    searchable?: boolean
    previewCount?: number
    formatLabel?: (value: string) => string
}) => {
    const [filter, setFilter] = useState("")
    const [expanded, setExpanded] = useState(false)
    const fmt = formatLabel ?? ((v: string) => v)

    let visible = items
    if (searchable && filter.trim()) {
        const f = filter.trim().toLowerCase()
        visible = items.filter(i => fmt(i.value).toLowerCase().includes(f))
    }
    const limit = previewCount ?? visible.length
    const shown = expanded ? visible : visible.slice(0, limit)
    const hiddenCount = visible.length - shown.length

    return (
        <section className="facet">
            <h3>{title}</h3>
            {searchable && (
                <input
                    className="facet-search"
                    placeholder={`Search ${title.toLowerCase()}…`}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                />
            )}
            <ul className="refinements">
                {shown.map(item => {
                    const isSel = selected.includes(item.value)
                    return (
                        <li key={item.value}>
                            <label className={isSel ? "sel" : ""}>
                                <input
                                    type="checkbox"
                                    checked={isSel}
                                    onChange={() => onToggle(item.value)}
                                />
                                <span className="ref-label">{fmt(item.value)}</span>
                                <span
                                    className={
                                        "count" + (item.count === 0 ? " zero" : "")
                                    }
                                >
                                    {item.count.toLocaleString()}
                                </span>
                            </label>
                        </li>
                    )
                })}
            </ul>
            {hiddenCount > 0 && (
                <button className="show-more" onClick={() => setExpanded(true)}>
                    Show {hiddenCount} more
                </button>
            )}
            {expanded && previewCount && visible.length > previewCount && (
                <button className="show-more" onClick={() => setExpanded(false)}>
                    Show less
                </button>
            )}
        </section>
    )
}

const RatingFacet = ({
    items,
    value,
    onSet,
}: {
    items: { threshold: number; count: number }[]
    value: number
    onSet: (threshold: number) => void
}) => (
    <section className="facet">
        <h3>Rating</h3>
        <ul className="refinements">
            {items.map(({ threshold, count }) => {
                const isSel = value === threshold
                return (
                    <li key={threshold}>
                        <label className={isSel ? "sel" : ""}>
                            <input
                                type="radio"
                                name="rating"
                                checked={isSel}
                                onChange={() => onSet(isSel ? 0 : threshold)}
                                onClick={() => isSel && onSet(0)}
                            />
                            <span className="ref-label stars">
                                {"★".repeat(Math.round(threshold / 2))}
                                <span className="rating-num">
                                    {threshold} & up
                                </span>
                            </span>
                            <span className="count">
                                {count.toLocaleString()}
                            </span>
                        </label>
                    </li>
                )
            })}
        </ul>
    </section>
)

const MovieCard = ({ m, query }: { m: Movie; query: string }) => (
    <article className="card">
        <div className="card-head">
            <h4>{highlight(m.title, query)}</h4>
            <Stars rating={m.rating} />
        </div>
        <div className="card-meta">
            {m.year} · {m.runtime} min · dir. {highlight(m.director, query)}
        </div>
        <div className="card-genres">
            {m.genres.map(g => (
                <span className="tag" key={g}>
                    {g}
                </span>
            ))}
        </div>
        <div className="card-cast">
            {m.cast.map(c => highlight(c, query)).map((c, i) => (
                <span key={i}>
                    {i > 0 ? ", " : ""}
                    {c}
                </span>
            ))}
        </div>
    </article>
)

const Demo = () => {
    const store = useStore()
    const [seeded, setSeeded] = useState(false)
    const [query, setQuery] = useState("")
    const [facet, setFacet] = useState<FacetState>(emptyFacetState)
    const [sortKey, setSortKey] = useState<SortKey>("rating")
    const [page, setPage] = useState(0)

    // Seed all 5,000 movies in a single transaction (one descriptor batch).
    useEffect(() => {
        store.txn(txn => {
            for (const m of MOVIES) txn.set(movie(m.id), m)
        })
        setSeeded(true)
    }, [store])

    const trimmed = query.trim()
    const hasQuery = trimmed.length >= 2
    // Only run the search selector for a real query; otherwise the candidate
    // set is the whole corpus and the facet engine filters that.
    const scoredSel = useMemo(
        () => search.scored(hasQuery ? trimmed : ""),
        [hasQuery, trimmed],
    )
    const scored = useValue(scoredSel)

    const candidates = useMemo(() => {
        if (!seeded || !hasQuery) return MOVIES
        return scored
            .map(r => MOVIES_BY_ID.get(String(r.atom.familyArgsStringified)))
            .filter((m): m is Movie => m != null)
    }, [seeded, hasQuery, scored])

    const result = useMemo(
        () => computeFacets(candidates, facet),
        [candidates, facet],
    )

    const sorted = useMemo(() => {
        const hits = result.hits
        if (sortKey === "relevance") return hits // candidates already ranked
        const arr = [...hits]
        if (sortKey === "rating") arr.sort((a, b) => b.rating - a.rating)
        else if (sortKey === "year-desc") arr.sort((a, b) => b.year - a.year)
        else if (sortKey === "year-asc") arr.sort((a, b) => a.year - b.year)
        else if (sortKey === "title")
            arr.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
        return arr
    }, [result, sortKey])

    // Reset to page 0 whenever the result set could change.
    useEffect(() => setPage(0), [query, facet, sortKey])

    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    const clampedPage = Math.min(page, pageCount - 1)
    const pageItems = sorted.slice(
        clampedPage * PAGE_SIZE,
        clampedPage * PAGE_SIZE + PAGE_SIZE,
    )

    const set = (patch: Partial<FacetState>) =>
        setFacet(prev => ({ ...prev, ...patch }))
    const activeCount =
        facet.genres.length +
        facet.decades.length +
        facet.directors.length +
        (facet.ratingMin > 0 ? 1 : 0)

    return (
        <>
            <header className="topbar">
                <div className="brand">🎬 valdres movies</div>
                <input
                    className="searchbox"
                    autoFocus
                    placeholder="Search 5,000 movies by title, cast, or director…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                {query && (
                    <button className="clear" onClick={() => setQuery("")}>
                        ✕
                    </button>
                )}
            </header>

            <div className="layout">
                <aside className="sidebar">
                    <RefinementList
                        title="Genres"
                        items={result.facets.genres}
                        selected={facet.genres}
                        onToggle={v => set({ genres: toggle(facet.genres, v) })}
                        previewCount={GENRES.length}
                    />
                    <RatingFacet
                        items={result.facets.rating}
                        value={facet.ratingMin}
                        onSet={t => set({ ratingMin: t })}
                    />
                    <RefinementList
                        title="Decade"
                        items={result.facets.decades.map(d => ({
                            value: String(d.value),
                            count: d.count,
                        }))}
                        selected={facet.decades.map(String)}
                        onToggle={v =>
                            set({ decades: toggle(facet.decades, Number(v)) })
                        }
                        formatLabel={v => `${v}s`}
                    />
                    <RefinementList
                        title="Director"
                        items={result.facets.directors}
                        selected={facet.directors}
                        onToggle={v =>
                            set({ directors: toggle(facet.directors, v) })
                        }
                        searchable
                        previewCount={DIRECTOR_PREVIEW}
                    />
                </aside>

                <main className="results">
                    <div className="results-bar">
                        <div className="stat">
                            <strong>{result.total.toLocaleString()}</strong> movies
                            {hasQuery && (
                                <span className="muted">
                                    {" "}
                                    matching “{trimmed}”
                                </span>
                            )}
                        </div>
                        <label className="sort">
                            Sort{" "}
                            <select
                                value={sortKey}
                                onChange={e =>
                                    setSortKey(e.target.value as SortKey)
                                }
                            >
                                {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
                                    <option
                                        key={k}
                                        value={k}
                                        disabled={k === "relevance" && !hasQuery}
                                    >
                                        {SORT_LABELS[k]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {activeCount > 0 && (
                        <div className="chips">
                            {facet.genres.map(g => (
                                <button
                                    key={"g" + g}
                                    className="chip"
                                    onClick={() =>
                                        set({ genres: toggle(facet.genres, g) })
                                    }
                                >
                                    {g} ✕
                                </button>
                            ))}
                            {facet.decades.map(d => (
                                <button
                                    key={"d" + d}
                                    className="chip"
                                    onClick={() =>
                                        set({ decades: toggle(facet.decades, d) })
                                    }
                                >
                                    {d}s ✕
                                </button>
                            ))}
                            {facet.directors.map(d => (
                                <button
                                    key={"dir" + d}
                                    className="chip"
                                    onClick={() =>
                                        set({
                                            directors: toggle(facet.directors, d),
                                        })
                                    }
                                >
                                    {d} ✕
                                </button>
                            ))}
                            {facet.ratingMin > 0 && (
                                <button
                                    className="chip"
                                    onClick={() => set({ ratingMin: 0 })}
                                >
                                    ★ {facet.ratingMin}+ ✕
                                </button>
                            )}
                            <button
                                className="chip clear-all"
                                onClick={() => setFacet(emptyFacetState())}
                            >
                                Clear all
                            </button>
                        </div>
                    )}

                    {pageItems.length === 0 ? (
                        <p className="empty">No movies match these filters.</p>
                    ) : (
                        <div className="grid">
                            {pageItems.map(m => (
                                <MovieCard key={m.id} m={m} query={trimmed} />
                            ))}
                        </div>
                    )}

                    {pageCount > 1 && (
                        <div className="pagination">
                            <button
                                disabled={clampedPage === 0}
                                onClick={() => setPage(clampedPage - 1)}
                            >
                                ← Prev
                            </button>
                            <span className="page-info">
                                Page {clampedPage + 1} of{" "}
                                {pageCount.toLocaleString()}
                            </span>
                            <button
                                disabled={clampedPage >= pageCount - 1}
                                onClick={() => setPage(clampedPage + 1)}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </main>
            </div>
        </>
    )
}

const root = createRoot(document.getElementById("root")!)
root.render(
    <Provider>
        <Demo />
    </Provider>,
)
