// Renders the benchmark tables on /guides/performance straight from
// docs/content/bench-summary.json (generated from Bencher by
// scripts/gen-bench-summary.ts). Every head-to-head benchmark is shown — fast
// and slow alike — so the page stays truthful and updates itself on each build.

export type BenchEntry = {
    name: string
    jscTag: string | null
    v8Tag: string | null
}

export type BenchCategory = {
    name: string
    benchmarks: BenchEntry[]
}

export type BenchSummary = {
    jotaiVersion: string
    date: string
    categories: BenchCategory[]
}

// Mirror compile-mdx.ts's heading slug logic so component <h2> ids line up with
// the injected table-of-contents entries.
export function categorySlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
}

function Tag({ tag }: { tag: string | null }) {
    if (!tag) return <span className="text-zinc-400 dark:text-zinc-500">—</span>
    const slower = tag.endsWith("slower")
    return (
        <span
            className={
                slower
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
            }
        >
            {tag}
        </span>
    )
}

export function BenchmarkTables({ summary }: { summary: BenchSummary }) {
    // Collect every result where Valdres trails Jotai, so we can name them
    // explicitly rather than hide them.
    const slower: { name: string; engine: string; tag: string }[] = []
    for (const cat of summary.categories) {
        for (const b of cat.benchmarks) {
            if (b.jscTag?.endsWith("slower"))
                slower.push({ name: b.name, engine: "Safari (JSC)", tag: b.jscTag })
            if (b.v8Tag?.endsWith("slower"))
                slower.push({ name: b.name, engine: "Chrome (V8)", tag: b.v8Tag })
        }
    }

    return (
        <>
            <p>
                These benchmark the framework-agnostic{" "}
                <strong>core engine</strong> (atoms, selectors, families,
                transactions) head-to-head against{" "}
                <a href="https://github.com/pmndrs/jotai">Jotai</a> v
                {summary.jotaiVersion} on the same CI runner, across two
                JavaScript engines: Bun (JavaScriptCore / Safari) and Node.js
                (V8 / Chrome). The figures below are the latest{" "}
                <code>main</code> run — refreshed automatically, nothing is
                excluded.
            </p>
            <p>
                They measure the shared engine, not framework rendering. The
                React, Vue, Svelte, Solid, and Angular adapters build on each
                framework's own reactivity — Valdres rides on top of it rather
                than trying to outrun it, so adapter performance is bounded by
                the framework itself.
            </p>

            {summary.categories.map(cat => (
                <div key={cat.name}>
                    <h2 id={categorySlug(cat.name)}>{cat.name}</h2>
                    <table>
                        <thead>
                            <tr>
                                <th align="left">Benchmark</th>
                                <th align="right">Safari (JSC)</th>
                                <th align="right">Chrome (V8)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cat.benchmarks.map(b => (
                                <tr key={b.name}>
                                    <td>{b.name}</td>
                                    <td align="right">
                                        <Tag tag={b.jscTag} />
                                    </td>
                                    <td align="right">
                                        <Tag tag={b.v8Tag} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            {slower.length > 0 && (
                <div className="callout callout-warning">
                    <div className="callout-title">
                        Where Valdres still trails Jotai
                    </div>
                    <p>
                        Honest accounting — these are the operations where
                        Valdres is currently slower. They're tracked as
                        optimization targets:
                    </p>
                    <ul>
                        {slower.map(s => (
                            <li key={`${s.name}-${s.engine}`}>
                                <code>{s.name}</code> — {s.engine}: {s.tag}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    )
}
