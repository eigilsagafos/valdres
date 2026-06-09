import { useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useStore, useValue } from "valdres-react"
import { atomFamily } from "../../src/atomFamily"
import { atomFamilySearch } from "../../src/atomFamilySearch"
import { defaultTokenize } from "../../src/utils/defaultTokenize"
import { englishStopWords } from "../../src/utils/englishStopWords"
import { foldAccents } from "../../src/utils/foldAccents"
import { simpleEnglishStem } from "../../src/utils/simpleEnglishStem"

type Doc = { id: string; title: string; body: string }

const DOCS: Doc[] = [
    {
        id: "js",
        title: "JavaScript",
        body: "Dynamic, prototype-based language with first-class functions. The lingua franca of the web.",
    },
    {
        id: "ts",
        title: "TypeScript",
        body: "Statically typed superset of JavaScript with structural type inference and gradual typing.",
    },
    {
        id: "rust",
        title: "Rust",
        body: "Memory-safe systems language using ownership and borrowing instead of a garbage collector.",
    },
    {
        id: "go",
        title: "Go",
        body: "Concurrent, statically typed language with goroutines, channels, and a minimal runtime.",
    },
    {
        id: "python",
        title: "Python",
        body: "Readable scripting language popular in data science, machine learning, and automation.",
    },
    {
        id: "haskell",
        title: "Haskell",
        body: "Purely functional, lazily evaluated language with a strong static type system and monads.",
    },
    {
        id: "ocaml",
        title: "OCaml",
        body: "ML-family language combining functional, imperative, and object-oriented programming.",
    },
    {
        id: "elixir",
        title: "Elixir",
        body: "Functional concurrent language on the Erlang VM, used for fault-tolerant distributed systems.",
    },
    {
        id: "clojure",
        title: "Clojure",
        body: "Functional Lisp dialect on the JVM with immutable data structures and reference types.",
    },
    {
        id: "ruby",
        title: "Ruby",
        body: "Dynamic object-oriented language designed for programmer happiness, famous for Rails.",
    },
    {
        id: "swift",
        title: "Swift",
        body: "Apple's modern systems language with optionals, protocols, and value semantics.",
    },
    {
        id: "kotlin",
        title: "Kotlin",
        body: "Pragmatic JVM language with null safety, coroutines, and seamless Java interop.",
    },
    {
        id: "zig",
        title: "Zig",
        body: "Low-level systems language with explicit memory management and compile-time metaprogramming.",
    },
    {
        id: "valdres",
        title: "Valdres",
        body: "Reactive state library with atoms, selectors, families, scopes, and insertion-time indexes.",
    },
    {
        id: "react",
        title: "React",
        body: "Declarative UI library using a virtual DOM, hooks, and unidirectional data flow.",
    },
    {
        id: "vue",
        title: "Vue",
        body: "Progressive JavaScript framework with templates, reactivity via proxies, and SFCs.",
    },
    {
        id: "svelte",
        title: "Svelte",
        body: "Compiler-driven framework that turns components into highly optimized vanilla JavaScript.",
    },
    {
        id: "solid",
        title: "SolidJS",
        body: "Fine-grained reactive UI library with JSX and signals, no virtual DOM diffing required.",
    },
    {
        id: "redux",
        title: "Redux",
        body: "Predictable state container popularized by React; pure reducers and unidirectional flow.",
    },
    {
        id: "jotai",
        title: "Jotai",
        body: "Atomic state management for React with primitive and derived atoms, minimal API.",
    },
    {
        id: "recoil",
        title: "Recoil",
        body: "Experimental state library from Facebook with atoms and selectors; spiritual predecessor.",
    },
    {
        id: "postgres",
        title: "PostgreSQL",
        body: "Open-source relational database with strong ACID guarantees and rich extensions.",
    },
    {
        id: "sqlite",
        title: "SQLite",
        body: "Embedded relational database engine, file-based, widely deployed in mobile and desktop.",
    },
    {
        id: "redis",
        title: "Redis",
        body: "In-memory key-value store used for caching, queues, pub/sub, and rate limiting.",
    },
    {
        id: "docker",
        title: "Docker",
        body: "Container runtime packaging applications with their dependencies into portable images.",
    },
    {
        id: "kubernetes",
        title: "Kubernetes",
        body: "Container orchestration platform for declaratively running and scaling distributed workloads.",
    },
    {
        id: "wasm",
        title: "WebAssembly",
        body: "Portable compilation target running near-native code in browsers and other host environments.",
    },
    {
        id: "graphql",
        title: "GraphQL",
        body: "Query language for APIs with a single endpoint, typed schema, and client-driven response shape.",
    },
    {
        id: "café",
        title: "Café Culture",
        body: "Naïve search engines fail on accented words; great fuzzy search folds diacritics.",
    },
    {
        id: "tigerstyle",
        title: "TigerStyle",
        body: "Defensive coding discipline emphasizing assertions, bounded loops, and zero hidden allocations.",
    },
]

const doc = atomFamily<Doc, [string]>(null, { name: "docs" })

const searches = {
    exact: atomFamilySearch(doc, d => `${d.title} ${d.body}`, {
        mode: "exact",
    }),
    prefix: atomFamilySearch(doc, d => `${d.title} ${d.body}`, {
        mode: "prefix",
    }),
    trigram: atomFamilySearch(doc, d => `${d.title} ${d.body}`, {
        mode: "trigram",
    }),
    fuzzy: atomFamilySearch(doc, d => `${d.title} ${d.body}`, {
        mode: "trigram",
        tokenize: text => defaultTokenize(foldAccents(text)),
        stem: simpleEnglishStem,
        stopWords: englishStopWords,
    }),
} as const

type Mode = keyof typeof searches

const MODE_LABELS: Record<Mode, string> = {
    exact: "Exact (AND)",
    prefix: "Prefix (autocomplete)",
    trigram: "Trigram (typo-tolerant)",
    fuzzy: "Trigram + stem + stopwords + folding",
}

const MODE_HINTS: Record<Mode, string> = {
    exact: 'Tokens must all appear. Try "javascript" or "memory safe".',
    prefix:
        'Tokens match prefixes. Try "typ" to find typescript, type, etc.',
    trigram:
        'Typo-tolerant via boundary trigrams. Try "javascrpit" to still find JavaScript.',
    fuzzy:
        'Full stack: stems "running"→"run", drops "the", folds "café"→"cafe".',
}

const escapeRegExp = (s: string) =>
    s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const highlightHtml = (text: string, terms: string[]): string => {
    if (terms.length === 0) return text
    const valid = terms.filter(t => t.length > 0).map(escapeRegExp)
    if (valid.length === 0) return text
    const pattern = new RegExp(`(${valid.join("|")})`, "gi")
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(pattern, "<mark>$1</mark>")
}

const ResultRow = ({
    atomRef,
    score,
    matched,
}: {
    atomRef: ReturnType<typeof doc>
    score: number
    matched: string[]
}) => {
    const value = useValue(atomRef)
    if (!value) return null
    return (
        <div className="result">
            <div className="result-head">
                <span
                    className="title"
                    dangerouslySetInnerHTML={{
                        __html: highlightHtml(value.title, matched),
                    }}
                />
                <span className="score">{score.toFixed(2)}</span>
                {matched.length > 0 && (
                    <span className="matched">
                        matched:
                        {matched.map(m => (
                            <code key={m}>{m}</code>
                        ))}
                    </span>
                )}
            </div>
            <p
                className="body"
                dangerouslySetInnerHTML={{
                    __html: highlightHtml(value.body, matched),
                }}
            />
        </div>
    )
}

const ResultsList = ({ mode, query }: { mode: Mode; query: string }) => {
    const search = searches[mode]
    // useMemo to keep the selector reference stable per (mode, query)
    const scoredSelector = useMemo(
        () => search.scored(query),
        [search, query],
    )
    const results = useValue(scoredSelector)
    if (!query.trim()) {
        return (
            <p className="empty">
                Type something above. The index already holds {DOCS.length}{" "}
                docs about languages, frameworks, and tooling.
            </p>
        )
    }
    if (results.length === 0) {
        return <p className="empty">No matches.</p>
    }
    return (
        <>
            <p className="meta">
                {results.length} result{results.length === 1 ? "" : "s"}{" "}
                — {MODE_HINTS[mode]}
            </p>
            {results.map(r => (
                <ResultRow
                    key={String(r.atom.familyArgsStringified)}
                    atomRef={r.atom}
                    score={r.score}
                    matched={r.matched}
                />
            ))}
        </>
    )
}

const Demo = () => {
    const store = useStore()
    const [query, setQuery] = useState("")
    const [mode, setMode] = useState<Mode>("trigram")

    // Seed the family on mount
    useEffect(() => {
        for (const d of DOCS) store.set(doc(d.id), d)
    }, [store])

    return (
        <>
            <div className="search-row">
                <input
                    autoFocus
                    placeholder="search…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
                {query && (
                    <button
                        className="clear-btn"
                        onClick={() => setQuery("")}
                        aria-label="clear"
                    >
                        clear
                    </button>
                )}
            </div>
            <div className="config">
                <div className="config-group">
                    {(Object.keys(searches) as Mode[]).map(m => (
                        <label key={m}>
                            <input
                                type="radio"
                                name="mode"
                                value={m}
                                checked={mode === m}
                                onChange={() => setMode(m)}
                            />
                            {MODE_LABELS[m]}
                        </label>
                    ))}
                </div>
            </div>
            <ResultsList mode={mode} query={query} />
        </>
    )
}

const root = createRoot(document.getElementById("root")!)
root.render(
    <Provider>
        <Demo />
    </Provider>,
)
