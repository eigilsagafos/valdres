import {
    create as oramaCreate,
    insertMultiple as oramaInsertMultiple,
    search as oramaSearch,
} from "@orama/orama"
// FlexSearch's ESM build exports a default object — not named exports —
// despite what the .d.ts implies. Reach into the default for `Document`.
import FlexSearch from "flexsearch"
const FlexDocument = (FlexSearch as unknown as {
    Document: new (opts: unknown) => {
        add(doc: unknown): void
        search(
            query: string,
            limit?: number,
        ): Array<{ field: string; result: Array<string | number> }>
    }
}).Document
import Fuse from "fuse.js"
import MiniSearch from "minisearch"
import { useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { atomFamily, atomFamilySearch, store } from "valdres"

// ─── Types ─────────────────────────────────────────────────────────────
type Doc = {
    id: string
    title: string
    body: string
    year: number
    genre: string
}
type ResultRow = {
    id: string
    score?: number
    title?: string
    year?: number
    genre?: string
}
type BuildOutcome = { time: number; instance: unknown }
type QueryOutcome = {
    time: number
    count: number
    results: ResultRow[]
}

interface BenchLib {
    name: string
    build(docs: Doc[]): BuildOutcome | Promise<BuildOutcome>
    query(
        instance: unknown,
        q: string,
    ): QueryOutcome | Promise<QueryOutcome>
}

// ─── Movie-themed corpus generator (deterministic LCG) ─────────────────
const TITLE_ADJECTIVES = [
    "Eternal", "Silent", "Forgotten", "Crimson", "Hollow", "Stolen",
    "Broken", "Endless", "Distant", "Frozen", "Burning", "Whispering",
    "Last", "First", "Lost", "Hidden", "Ancient", "Wild", "Twisted",
    "Sacred", "Bitter", "Velvet", "Iron", "Golden", "Silver", "Midnight",
    "Phantom", "Shadow", "Echo", "Storm", "Sunken", "Restless", "Quiet",
    "Brutal", "Wandering", "Cold", "Glass", "Paper", "Stone", "Salt",
]
const TITLE_NOUNS = [
    "Heart", "Kingdom", "Dawn", "Garden", "Hour", "Mirror", "Letter",
    "Promise", "Symphony", "Affair", "Voyage", "Empire", "City", "Light",
    "Storm", "Door", "Bridge", "Sword", "Crown", "House", "Forest",
    "Sea", "Star", "Road", "Throne", "Code", "Machine", "Witness",
    "Thief", "Soldier", "Stranger", "Architect", "Painter", "Detective",
    "Pilot", "Surgeon", "Conductor", "Dancer", "Spy", "Wife", "Son",
    "Daughter", "Mother", "Brother", "Sister", "Father", "Killer",
    "Survivor", "Watchman", "Gatekeeper", "Cartographer",
]
const PLACE_WORDS = [
    "Paris", "Tokyo", "Brooklyn", "Berlin", "Cairo", "Marrakech", "Reykjavik",
    "Bombay", "Lisbon", "Saigon", "Manila", "Havana", "Belgrade",
    "Mars", "the Moon", "the Pacific", "the Arctic", "the desert",
    "the asteroid belt", "the borderlands", "the colony", "the citadel",
]
const PEOPLE = [
    "Lena", "Marco", "Otis", "Saoirse", "Yusuf", "Reiko", "Adaeze",
    "Tomek", "Soren", "Inez", "Mehmet", "Sage", "Aurélie", "Bruno",
    "Hadiya", "Idris", "Margot", "Ravi", "Tariq", "Wren", "Yael",
]
const VERBS = [
    "investigates", "uncovers", "races to expose", "must protect",
    "is forced to confront", "agrees to smuggle", "infiltrates",
    "abandons", "obsesses over", "barters with", "remembers", "rebuilds",
    "betrays", "rescues", "escorts", "negotiates with", "exposes",
]
const COMPLICATIONS = [
    "while the city sleeps", "after a stranger appears on the doorstep",
    "as the storm closes the harbor", "without telling anyone",
    "before the trial begins", "with an unreliable witness",
    "during a citywide blackout", "across three uneasy time zones",
    "in defiance of the council", "in the days before the eclipse",
    "while pretending to be someone else", "on the wrong end of a ledger",
    "with a fortune at stake", "before the war reaches the coast",
    "after the official records are destroyed",
]
const STAKES = [
    "buried truth", "stolen manuscript", "missing recording",
    "encrypted contract", "abandoned facility", "vanished daughter",
    "doomed shipment", "forgotten promise", "private letter",
    "rare instrument", "unfinished sculpture", "leaked dossier",
    "diplomatic favor", "rival's confession", "blood debt",
]
const GENRES = [
    "Drama", "Thriller", "Romance", "Mystery", "Sci-Fi", "Crime",
    "Comedy", "Horror", "Adventure", "Noir", "Heist", "Historical",
]
const COMMON_WORDS = [
    "the", "a", "and", "of", "to", "in", "for", "with", "is", "are",
    "but", "though", "yet", "where", "when", "who", "all", "no",
]

const makeRand = (seed: number) => {
    let s = seed >>> 0
    return () => {
        s = ((s * 1664525) | 0) + 1013904223
        return (s >>> 0) / 0x1_0000_0000
    }
}
const pick = <T,>(rand: () => number, list: readonly T[]): T =>
    list[Math.floor(rand() * list.length)]

const generateDocs = (n: number): Doc[] => {
    const r = makeRand(0xC0FFEE ^ n)
    const docs: Doc[] = []
    for (let i = 0; i < n; i++) {
        // Three title shapes for variety
        let title: string
        const shape = Math.floor(r() * 3)
        if (shape === 0) {
            title = `The ${pick(r, TITLE_ADJECTIVES)} ${pick(r, TITLE_NOUNS)}`
        } else if (shape === 1) {
            title = `${pick(r, TITLE_NOUNS)} of ${pick(r, PLACE_WORDS)}`
        } else {
            title = `${pick(r, PEOPLE)}'s ${pick(r, TITLE_NOUNS)}`
        }
        // Plot: 2-3 sentences from templates
        const sentenceCount = 2 + Math.floor(r() * 2)
        const sentences: string[] = []
        for (let j = 0; j < sentenceCount; j++) {
            const protagonist = pick(r, PEOPLE)
            const verb = pick(r, VERBS)
            const stake = pick(r, STAKES)
            const place = pick(r, PLACE_WORDS)
            const comp = pick(r, COMPLICATIONS)
            // Mix in some common words so search has realistic noise
            sentences.push(
                `${protagonist} ${verb} the ${stake} ${pick(r, ["in", "near", "across"])} ${place} ${comp}.`,
            )
        }
        docs.push({
            id: `m-${i}`,
            title,
            body: sentences.join(" "),
            year: 1970 + Math.floor(r() * 55),
            genre: pick(r, GENRES),
        })
    }
    return docs
}

// ─── Library adapters ──────────────────────────────────────────────────
const valdresLib: BenchLib = {
    name: "valdres",
    build(docs) {
        const s = store()
        const doc = atomFamily<Doc, [string]>(null, { name: "bench-doc" })
        // Field-aware extractor so BM25F has per-field stats. Title is
        // boosted 2× to match how MiniSearch / Orama configure their
        // defaults for movie-corpus queries.
        //
        // `mode: "prefix"` matches the algorithm class Orama / MiniSearch
        // use — index whole tokens with their prefixes, so `"str"` finds
        // "stranger" cleanly. Trigram mode tolerates typos but ranks
        // worse on prefix-style queries (length norm dominates the
        // small boost from extra n-gram matches) and is markedly slower
        // because each query token expands to ~5–10 trigram lookups.
        // For typo tolerance, swap to `mode: "trigram"` and accept the
        // ranking + speed trade-off.
        const search = atomFamilySearch(
            doc,
            d => ({ title: d.title, body: d.body }),
            {
                mode: "prefix",
                // `tolerance: 1` enables Levenshtein-style typo
                // tolerance (mirrors Orama's `tolerance` parameter).
                // A query like `"strangr"` finds "Stranger"; a query
                // like `"eternl"` finds "Eternal". Per-query token
                // walks the term dictionary, so this adds a few ms of
                // query latency.
                tolerance: 1,
                // No `limit` — valdres' `limit` caps the result count
                // (not just returned rows); we want apples-to-apples
                // match counts with Orama / MiniSearch.
                fields: {
                    title: { boost: 2 },
                    body: { boost: 1 },
                },
                name: "bench",
            },
        )
        const t0 = performance.now()
        // Batch in a transaction so propagation fires once, not per-doc
        s.txn(({ set }) => {
            for (const d of docs) set(doc(d.id), d)
        })
        const time = performance.now() - t0
        return { time, instance: { store: s, doc, search } }
    },
    query(instance, q) {
        const inst = instance as {
            store: ReturnType<typeof store>
            doc: ReturnType<typeof atomFamily<Doc, [string]>>
            search: ReturnType<typeof atomFamilySearch<Doc, [string]>>
        }
        const t0 = performance.now()
        const results = inst.store.get(inst.search.scored(q))
        const time = performance.now() - t0
        return {
            time,
            count: results.length,
            results: results.slice(0, 50).map(r => {
                const v = inst.store.get(r.atom) as Doc | null
                return {
                    id: String(r.atom.familyArgs[0]),
                    score: r.score,
                    title: v?.title,
                    year: v?.year,
                    genre: v?.genre,
                }
            }),
        }
    },
}

const minisearchLib: BenchLib = {
    name: "MiniSearch",
    build(docs) {
        const ms = new MiniSearch({
            fields: ["title", "body"],
            storeFields: ["id", "title", "year", "genre"],
            searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 2 } },
        })
        const t0 = performance.now()
        ms.addAll(docs)
        const time = performance.now() - t0
        return { time, instance: ms }
    },
    query(instance, q) {
        const ms = instance as MiniSearch
        const t0 = performance.now()
        const results = ms.search(q)
        const time = performance.now() - t0
        return {
            time,
            count: results.length,
            results: results.slice(0, 50).map(r => ({
                id: String(r.id),
                score: r.score,
                title: (r as { title?: string }).title,
                year: (r as { year?: number }).year,
                genre: (r as { genre?: string }).genre,
            })),
        }
    },
}

type FlexDocumentInstance = InstanceType<typeof FlexDocument>

const flexsearchLib: BenchLib = {
    name: "FlexSearch",
    build(docs) {
        const fx = new FlexDocument({
            tokenize: "forward",
            document: {
                id: "id",
                index: ["title", "body"],
            },
        })
        const docsMap = new Map<string, Doc>()
        const t0 = performance.now()
        for (const d of docs) {
            fx.add(d)
            docsMap.set(d.id, d)
        }
        const time = performance.now() - t0
        return { time, instance: { fx, docsMap } }
    },
    query(instance, q) {
        const inst = instance as {
            fx: FlexDocumentInstance
            docsMap: Map<string, Doc>
        }
        const t0 = performance.now()
        const results = inst.fx.search(q, 50)
        const time = performance.now() - t0
        const ids = new Set<string>()
        for (const r of results) {
            for (const id of r.result) ids.add(String(id))
        }
        return {
            time,
            count: ids.size,
            results: [...ids].slice(0, 50).map(id => {
                const d = inst.docsMap.get(id)
                return {
                    id,
                    title: d?.title,
                    year: d?.year,
                    genre: d?.genre,
                }
            }),
        }
    },
}

const fuseLib: BenchLib = {
    name: "Fuse.js",
    build(docs) {
        const t0 = performance.now()
        const fuse = new Fuse(docs, {
            keys: ["title", "body"],
            threshold: 0.4,
            includeScore: true,
            ignoreLocation: true,
        })
        const time = performance.now() - t0
        return { time, instance: fuse }
    },
    query(instance, q) {
        const fuse = instance as Fuse<Doc>
        const t0 = performance.now()
        const results = fuse.search(q)
        const time = performance.now() - t0
        return {
            time,
            count: results.length,
            results: results.slice(0, 50).map(r => ({
                id: r.item.id,
                // Fuse uses 0 = perfect → invert for display intuition
                score: r.score !== undefined ? 1 - r.score : undefined,
                title: r.item.title,
                year: r.item.year,
                genre: r.item.genre,
            })),
        }
    },
}

const oramaLib: BenchLib = {
    name: "Orama",
    async build(docs) {
        // create() is async; schema setup is configuration only, not
        // indexing — keep it outside the timed block to match the other
        // adapters which time only the insert phase.
        const db = await oramaCreate({
            schema: {
                title: "string",
                body: "string",
                year: "number",
                genre: "string",
            },
        })
        const t0 = performance.now()
        await oramaInsertMultiple(db, docs)
        const time = performance.now() - t0
        return { time, instance: db }
    },
    async query(instance, q) {
        // Orama's generics blow up TS depth inference here — sidestep with
        // `any` (the explicit cast below pins the runtime shape).
        const db = instance as any
        const t0 = performance.now()
        const result = (await oramaSearch(db, {
            term: q,
            properties: ["title", "body"],
            limit: 50,
        })) as {
            count: number
            hits: Array<{
                id: string
                score: number
                document: Doc
            }>
        }
        const time = performance.now() - t0
        return {
            time,
            count: result.count,
            results: result.hits.slice(0, 50).map(h => ({
                id: String(h.id),
                score: h.score,
                title: h.document.title,
                year: h.document.year,
                genre: h.document.genre,
            })),
        }
    },
}

const LIBS: BenchLib[] = [
    valdresLib,
    oramaLib,
    minisearchLib,
    flexsearchLib,
    fuseLib,
]

// ─── Timing classification for badges ──────────────────────────────────
const timingClass = (ms: number): "fast" | "mid" | "slow" => {
    if (ms < 5) return "fast"
    if (ms < 50) return "mid"
    return "slow"
}

/** Format a duration with appropriate precision — drops to microseconds
 *  for sub-millisecond timings so a 0.0001ms query reads as "0.1µs"
 *  instead of "0.00ms". */
const fmtMs = (ms: number): string => {
    if (!Number.isFinite(ms) || ms <= 0) return "<1µs"
    if (ms < 0.001) return "<1µs"
    if (ms < 1) return (ms * 1000).toFixed(ms < 0.01 ? 0 : 1) + "µs"
    if (ms < 10) return ms.toFixed(2) + "ms"
    return ms.toFixed(1) + "ms"
}

/** Run a query with adaptive iteration count: if a single shot takes
 *  longer than ~0.5ms (well above browser timer resolution), trust it.
 *  Otherwise repeat in a tight loop until the total wall time is
 *  meaningful, then return the per-iteration mean. Keeps fast libraries
 *  from reading as "0.00ms" while still bounding the work for slow
 *  ones. */
const adaptiveTime = async (
    lib: BenchLib,
    instance: unknown,
    q: string,
): Promise<QueryOutcome> => {
    const first = await lib.query(instance, q)
    if (first.time >= 0.5) return first
    // Pick an iteration count that targets ~5ms of total measurement
    // time, capped so we don't melt the main thread on borderline cases.
    const target = first.time > 0
        ? Math.min(500, Math.max(20, Math.ceil(5 / first.time)))
        : 200
    const t0 = performance.now()
    let last = first
    for (let i = 0; i < target; i++) {
        last = await lib.query(instance, q)
    }
    const elapsed = performance.now() - t0
    return {
        time: elapsed / target,
        count: last.count,
        results: last.results,
    }
}

// ─── React UI ──────────────────────────────────────────────────────────
type LibState = {
    name: string
    buildTime: number
    instance: unknown
}

type QueryState = {
    name: string
    time: number
    count: number
    results: ResultRow[]
}

/** Standard debounce: returns a value that only updates after `delay`
 *  ms of inactivity. Prevents the search benchmark from running on every
 *  keystroke (which freezes the UI because the slow libraries like
 *  Fuse.js take 5-50ms per call). */
const useDebounced = <T,>(value: T, delay: number): T => {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay)
        return () => window.clearTimeout(id)
    }, [value, delay])
    return debounced
}

const Bench = () => {
    const [corpusSize, setCorpusSize] = useState(5000)
    const [query, setQuery] = useState("")
    const debouncedQuery = useDebounced(query, 200)
    const [libs, setLibs] = useState<LibState[]>([])
    const [building, setBuilding] = useState(false)
    const [querying, setQuerying] = useState(false)
    const [queryResults, setQueryResults] = useState<QueryState[]>([])
    /** Bump to force a rebuild on the same corpus size — wired to the
     *  rebuild button. Without this, `setCorpusSize(s => s)` returns the
     *  same value and React skips the effect. */
    const [rebuildToken, setRebuildToken] = useState(0)
    const queryRef = useRef<HTMLInputElement>(null)

    const docs = useMemo(
        () => generateDocs(corpusSize),
        // Re-generate when either size or rebuild token changes
        // (corpus content is deterministic per size, so this regenerates
        // identical docs — fine, the cost is in the index rebuild).
        [corpusSize, rebuildToken],
    )

    // Build all libraries when corpus or rebuild token changes
    useEffect(() => {
        let cancelled = false
        // Clear previous state immediately so the UI shows something is
        // happening, even before the (potentially long) build kicks off.
        setBuilding(true)
        setLibs([])
        setQueryResults([])

        const buildAll = async () => {
            // Yield once so React paints "building…" before we hog the
            // main thread.
            await new Promise(r => setTimeout(r, 0))
            const built: LibState[] = []
            for (const lib of LIBS) {
                if (cancelled) return
                const out = await lib.build(docs)
                if (cancelled) return
                built.push({
                    name: lib.name,
                    buildTime: out.time,
                    instance: out.instance,
                })
                // Yield between libs so the UI can repaint and show
                // progressive results as each one finishes.
                setLibs([...built])
                await new Promise(r => setTimeout(r, 0))
            }
            if (!cancelled) {
                setBuilding(false)
                queryRef.current?.focus()
            }
        }
        buildAll()
        return () => {
            cancelled = true
        }
    }, [docs])

    // Re-query when the debounced query (or libs) changes
    useEffect(() => {
        if (libs.length === 0) return
        if (debouncedQuery.trim().length === 0) {
            setQueryResults([])
            return
        }
        let cancelled = false
        const runQueries = async () => {
            setQuerying(true)
            const out: QueryState[] = []
            for (const lib of LIBS) {
                if (cancelled) return
                const state = libs.find(l => l.name === lib.name)
                if (!state) continue
                const result = await adaptiveTime(
                    lib,
                    state.instance,
                    debouncedQuery,
                )
                out.push({
                    name: lib.name,
                    time: result.time,
                    count: result.count,
                    results: result.results,
                })
                // Yield between libs so the UI can repaint progressively
                if (!cancelled) setQueryResults([...out])
                await new Promise(r => setTimeout(r, 0))
            }
            if (!cancelled) setQuerying(false)
        }
        runQueries()
        return () => {
            cancelled = true
            setQuerying(false)
        }
    }, [debouncedQuery, libs])

    const fastestBuild = libs.length
        ? Math.min(...libs.map(l => l.buildTime))
        : 0
    const fastestQuery = queryResults.length
        ? Math.min(...queryResults.map(r => r.time))
        : 0

    return (
        <>
            <div className="controls">
                <label>
                    Corpus size:
                    <select
                        value={corpusSize}
                        onChange={e => setCorpusSize(Number(e.target.value))}
                        disabled={building}
                    >
                        <option value={100}>100 docs</option>
                        <option value={500}>500 docs</option>
                        <option value={1000}>1,000 docs</option>
                        <option value={5000}>5,000 docs</option>
                        <option value={10000}>10,000 docs</option>
                    </select>
                </label>
                <button
                    className="btn"
                    onClick={() => setRebuildToken(t => t + 1)}
                    disabled={building}
                    title="Re-run build benchmarks for the current corpus size"
                >
                    {building ? "building…" : "rebuild"}
                </button>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    {building
                        ? "Indexing corpus…"
                        : libs.length > 0
                          ? `Indexed ${docs.length.toLocaleString()} docs across ${libs.length} libraries.`
                          : ""}
                </span>
            </div>

            <div className="search-row">
                <input
                    ref={queryRef}
                    placeholder='Try "eternal kingdom", "frozen dawn", "detective stolen", "tokyo storm", "wittness" (typo)…'
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    disabled={building}
                />
            </div>

            <div className="grid">
                {LIBS.map(lib => {
                    const state = libs.find(l => l.name === lib.name)
                    const queryState = queryResults.find(
                        q => q.name === lib.name,
                    )
                    return (
                        <div key={lib.name} className="lib">
                            <div className="lib-name">
                                <span>{lib.name}</span>
                                <span className="ms">
                                    {state ? fmtMs(state.buildTime) : "—"}{" "}
                                    build
                                    {state &&
                                    state.buildTime === fastestBuild &&
                                    libs.length > 1 ? (
                                        <span className="badge fastest">
                                            fastest
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                            {queryState ? (
                                <>
                                    <div className="lib-stats">
                                        <span
                                            className={timingClass(
                                                queryState.time,
                                            )}
                                        >
                                            {fmtMs(queryState.time)}
                                        </span>
                                        {" • "}
                                        {queryState.count.toLocaleString()}{" "}
                                        match
                                        {queryState.count === 1 ? "" : "es"}
                                        {queryState.time === fastestQuery &&
                                        queryResults.length > 1 ? (
                                            <span
                                                className="badge fastest"
                                                style={{
                                                    marginLeft: "0.4rem",
                                                }}
                                            >
                                                fastest
                                            </span>
                                        ) : null}
                                    </div>
                                    {queryState.results.length === 0 ? (
                                        <div className="empty">
                                            No matches.
                                        </div>
                                    ) : (
                                        queryState.results.map(r => (
                                            <div
                                                key={r.id}
                                                className="result"
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "0.4rem",
                                                        alignItems: "baseline",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontWeight: 500,
                                                            fontSize: "0.9rem",
                                                        }}
                                                    >
                                                        {r.title ?? r.id}
                                                    </span>
                                                    {r.score !== undefined && (
                                                        <span
                                                            style={{
                                                                color: "var(--muted)",
                                                                fontFamily:
                                                                    "ui-monospace, monospace",
                                                                fontSize:
                                                                    "0.72rem",
                                                                marginLeft:
                                                                    "auto",
                                                            }}
                                                        >
                                                            {r.score.toFixed(
                                                                2,
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                {(r.year || r.genre) && (
                                                    <div
                                                        style={{
                                                            fontSize:
                                                                "0.72rem",
                                                            color: "var(--muted)",
                                                        }}
                                                    >
                                                        {r.year ? r.year : ""}
                                                        {r.year && r.genre
                                                            ? " · "
                                                            : ""}
                                                        {r.genre ?? ""}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </>
                            ) : (
                                <div className="empty">
                                    {building
                                        ? "building…"
                                        : state
                                          ? "type a query above"
                                          : ""}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="summary">
                Query timings adapt to per-call cost: single-shot for
                queries above ~0.5ms, mean of many tight-loop iterations
                otherwise (sub-ms shown in µs). Input is debounced 200ms
                so typing doesn't trigger a benchmark per keystroke. Build
                times measure the bulk-insert phase only — schema /
                constructor setup happens before the timer starts. <code>valdres</code> is
                configured with <code>mode: "trigram"</code>,{" "}
                <code>simpleEnglishStem</code>, and{" "}
                <code>englishStopWords</code>. Other libraries use sensible
                defaults (MiniSearch:{" "}
                <code>fuzzy: 0.2, prefix: true, title boost ×2</code>;
                FlexSearch: <code>tokenize: "forward"</code>; Fuse.js:{" "}
                <code>threshold: 0.4, ignoreLocation: true</code>).
            </div>
        </>
    )
}

const root = createRoot(document.getElementById("root")!)
root.render(<Bench />)
