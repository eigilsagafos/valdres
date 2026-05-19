/**
 * Compares the legacy `index` constructor (read-time selectors) against
 * the new `atomFamilyIndex` (write-time buckets), and measures absolute
 * throughput for `atomFamilySort` and `atomFamilySearch` (no legacy
 * equivalent). Run with:
 *
 *   bun run packages/valdres/test/performance/atomFamilyIndex.compare.ts
 */

import { measure } from "mitata"
import { atomFamily } from "../../src/atomFamily"
import { atomFamilyIndex } from "../../src/atomFamilyIndex"
import { atomFamilySearch } from "../../src/atomFamilySearch"
import { atomFamilySort } from "../../src/atomFamilySort"
import { index as legacyIndex } from "../../src/indexConstructor"
import { store } from "../../src/store"

type Post = {
    id: string
    title: string
    body: string
    createdAt: number
    tags: string[]
}

const TAGS = [
    "alpha", "beta", "gamma", "delta", "epsilon",
    "zeta", "eta", "theta", "iota", "kappa",
    "lambda", "mu", "nu", "xi", "omicron",
    "pi", "rho", "sigma", "tau", "upsilon",
    "phi", "chi", "psi", "omega", "aleph",
    "beth", "gimel", "daleth", "he", "waw",
    "zayin", "heth", "teth", "yodh", "kaph",
    "lamedh", "mem", "nun", "samekh", "ayin",
    "pe", "tsade", "qoph", "resh", "shin",
    "taw", "ant", "bee", "cat", "dog",
]

const TAGS_PER_POST = 3

const makePosts = (n: number): Post[] => {
    const out: Post[] = []
    for (let i = 0; i < n; i++) {
        const tags: string[] = []
        for (let j = 0; j < TAGS_PER_POST; j++) {
            tags.push(TAGS[(i * 7 + j * 13) % TAGS.length])
        }
        out.push({
            id: String(i),
            title: `Post ${i} ${TAGS[(i * 5) % TAGS.length]}`,
            body: `${TAGS[(i * 3) % TAGS.length]} ${TAGS[(i * 11) % TAGS.length]} sample content`,
            createdAt: (i * 31 + 1729) % (1 << 30),
            tags: Array.from(new Set(tags)),
        })
    }
    return out
}

const fmtNs = (ns: number): string => {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)}ms`
    return `${(ns / 1_000_000_000).toFixed(2)}s`
}

const fmtBytes = (bytes: number): string => {
    const abs = Math.abs(bytes)
    if (abs < 1024) return `${bytes}B`
    if (abs < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(2)}MB`
}

const measureMemory = async <T>(fn: () => T): Promise<{ result: T; deltaBytes: number }> => {
    if (typeof Bun !== "undefined") Bun.gc(true)
    await new Promise(r => setTimeout(r, 50))
    if (typeof Bun !== "undefined") Bun.gc(true)
    const before = process.memoryUsage().heapUsed
    const result = fn()
    if (typeof Bun !== "undefined") Bun.gc(true)
    await new Promise(r => setTimeout(r, 50))
    if (typeof Bun !== "undefined") Bun.gc(true)
    const after = process.memoryUsage().heapUsed
    return { result, deltaBytes: after - before }
}

const MEASURE_OPTS = {
    min_samples: 10,
    min_cpu_time: 500 * 1e6,
    warmup_samples: 3,
}

const median = (samples: number[]): number => {
    const sorted = [...samples].sort((a, b) => a - b)
    const m = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m]
}

const compareTime = async (
    label: string,
    runLegacy: () => unknown,
    runNew: () => unknown,
) => {
    const legacyFirst = Math.random() > 0.5
    const [a, b] = legacyFirst
        ? [await measure(runLegacy, MEASURE_OPTS), await measure(runNew, MEASURE_OPTS)]
        : [await measure(runNew, MEASURE_OPTS), await measure(runLegacy, MEASURE_OPTS)]
    const legacyStats = legacyFirst ? a : b
    const newStats = legacyFirst ? b : a
    const lm = median(legacyStats.samples)
    const nm = median(newStats.samples)
    const speedup = lm / nm
    const tag =
        speedup >= 1
            ? `new is ${speedup.toFixed(1)}× faster`
            : `new is ${(1 / speedup).toFixed(1)}× slower`
    console.log(
        `  ${label.padEnd(46)}  legacy=${fmtNs(lm).padStart(10)}  new=${fmtNs(nm).padStart(10)}  (${tag})`,
    )
}

const measureOne = async (label: string, fn: () => unknown) => {
    const stats = await measure(fn, MEASURE_OPTS)
    const m = median(stats.samples)
    console.log(`  ${label.padEnd(58)}  ${fmtNs(m).padStart(10)}`)
}

// ── Index: legacy vs new ──────────────────────────────────────────────
const buildLegacyIndex = (posts: Post[]) => {
    const s = store()
    const post = atomFamily<Post, [string]>(null, { name: "posts" })
    const idx = legacyIndex(post, (p: Post, tag: string) => p.tags.includes(tag))
    for (const p of posts) s.set(post(p.id), p)
    return { s, post, idx }
}

const buildNewIndex = (posts: Post[]) => {
    const s = store()
    const post = atomFamily<Post, [string]>(null, { name: "posts" })
    const idx = atomFamilyIndex(post, (p: Post) => p.tags)
    for (const p of posts) s.set(post(p.id), p)
    return { s, post, idx }
}

const runIndexSection = async (N: number) => {
    const posts = makePosts(N)
    console.log(`\n━━ atomFamilyIndex vs legacy index — N=${N.toLocaleString()} ━━`)

    await compareTime(
        "build store + load all posts",
        () => buildLegacyIndex(posts),
        () => buildNewIndex(posts),
    )

    await compareTime(
        "first read of 1 term (post-build)",
        () => {
            const b = buildLegacyIndex(posts)
            return b.s.get(b.idx("alpha"))
        },
        () => {
            const b = buildNewIndex(posts)
            return b.s.get(b.idx("alpha"))
        },
    )

    const legacyWarm = (() => {
        const b = buildLegacyIndex(posts)
        b.s.get(b.idx("alpha"))
        return () => b.s.get(b.idx("alpha"))
    })()
    const newWarm = (() => {
        const b = buildNewIndex(posts)
        b.s.get(b.idx("alpha"))
        return () => b.s.get(b.idx("alpha"))
    })()
    await compareTime("warm read of 1 term", legacyWarm, newWarm)

    const updateBatch = posts.slice(0, 100).map(p => ({
        ...p,
        tags: [TAGS[(parseInt(p.id) + 1) % TAGS.length]],
    }))
    const legacyUpdate = (() => {
        const b = buildLegacyIndex(posts)
        for (let i = 0; i < 10; i++) b.s.get(b.idx(TAGS[i]))
        let n = 0
        return () => {
            const u = updateBatch[n++ % updateBatch.length]
            b.s.set(b.post(u.id), u)
        }
    })()
    const newUpdate = (() => {
        const b = buildNewIndex(posts)
        for (let i = 0; i < 10; i++) b.s.get(b.idx(TAGS[i]))
        let n = 0
        return () => {
            const u = updateBatch[n++ % updateBatch.length]
            b.s.set(b.post(u.id), u)
        }
    })()
    await compareTime("update 1 post (10 terms primed)", legacyUpdate, newUpdate)

    const legacyMem = await measureMemory(() => {
        const b = buildLegacyIndex(posts)
        for (const t of TAGS) b.s.get(b.idx(t))
        return b
    })
    const newMem = await measureMemory(() => {
        const b = buildNewIndex(posts)
        for (const t of TAGS) b.s.get(b.idx(t))
        return b
    })
    const memRatio = legacyMem.deltaBytes / newMem.deltaBytes
    const memTag =
        memRatio >= 1
            ? `new uses ${memRatio.toFixed(1)}× less`
            : `new uses ${(1 / memRatio).toFixed(1)}× more`
    console.log(
        `  ${"memory: build + read all 50 tags".padEnd(46)}  legacy=${fmtBytes(legacyMem.deltaBytes).padStart(10)}  new=${fmtBytes(newMem.deltaBytes).padStart(10)}  (${memTag})`,
    )
}

// ── Sort: absolute throughput (no legacy equivalent) ───────────────────
const runSortSection = async (N: number) => {
    const posts = makePosts(N)
    console.log(`\n━━ atomFamilySort — N=${N.toLocaleString()} (no legacy) ━━`)

    await measureOne("build + load all posts (incremental sort at root)", () => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        atomFamilySort(post, p => p.createdAt)
        for (const p of posts) s.set(post(p.id), p)
    })

    // Update throughput: pre-build, then update one post.
    const sortUpdate = (() => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        const sorted = atomFamilySort(post, p => p.createdAt)
        for (const p of posts) s.set(post(p.id), p)
        s.get(sorted) // prime
        let n = 0
        return () => {
            const p = posts[n++ % posts.length]
            s.set(post(p.id), { ...p, createdAt: (p.createdAt + 1) % (1 << 30) })
        }
    })()
    await measureOne("update 1 post (sorted view primed)", sortUpdate)

    // Warm read after first read.
    const sortWarm = (() => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        const sorted = atomFamilySort(post, p => p.createdAt)
        for (const p of posts) s.set(post(p.id), p)
        s.get(sorted)
        return () => s.get(sorted)
    })()
    await measureOne("warm read of sorted view", sortWarm)

    const sortMem = await measureMemory(() => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        const sorted = atomFamilySort(post, p => p.createdAt)
        for (const p of posts) s.set(post(p.id), p)
        s.get(sorted)
        return { s, sorted }
    })
    console.log(`  ${"memory: build + read sorted view".padEnd(58)}  ${fmtBytes(sortMem.deltaBytes).padStart(10)}`)
}

// ── Search: absolute throughput (no legacy equivalent) ─────────────────
const runSearchSection = async (N: number) => {
    const posts = makePosts(N)
    console.log(`\n━━ atomFamilySearch — N=${N.toLocaleString()} (no legacy) ━━`)

    await measureOne("build + load all posts (tokenize title+body)", () => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        atomFamilySearch(post, p => `${p.title} ${p.body}`)
        for (const p of posts) s.set(post(p.id), p)
    })

    // Multi-token query (warm).
    const searchWarm = (() => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        const search = atomFamilySearch(post, p => `${p.title} ${p.body}`)
        for (const p of posts) s.set(post(p.id), p)
        s.get(search("alpha beta")) // prime
        return () => s.get(search("alpha beta"))
    })()
    await measureOne("warm read of 2-token query", searchWarm)

    // First read of a fresh query (post-build).
    await measureOne("first read of 3-token query (post-build)", () => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        const search = atomFamilySearch(post, p => `${p.title} ${p.body}`)
        for (const p of posts) s.set(post(p.id), p)
        return s.get(search("alpha beta gamma"))
    })

    // Update after multiple queries primed (exercises token-Set cache).
    const searchUpdate = (() => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        const search = atomFamilySearch(post, p => `${p.title} ${p.body}`)
        for (const p of posts) s.set(post(p.id), p)
        // Prime 10 different queries to populate token-Set cache
        for (let i = 0; i < 10; i++) s.get(search(`${TAGS[i]} ${TAGS[i + 5]}`))
        let n = 0
        return () => {
            const p = posts[n++ % posts.length]
            s.set(post(p.id), { ...p, body: `${p.body} updated-${n}` })
        }
    })()
    await measureOne("update 1 post (10 queries primed)", searchUpdate)

    const searchMem = await measureMemory(() => {
        const s = store()
        const post = atomFamily<Post, [string]>(null, { name: "posts" })
        const search = atomFamilySearch(post, p => `${p.title} ${p.body}`)
        for (const p of posts) s.set(post(p.id), p)
        // Prime a few queries
        for (let i = 0; i < 5; i++) s.get(search(TAGS[i]))
        return { s, search }
    })
    console.log(`  ${"memory: build + 5 single-token queries".padEnd(58)}  ${fmtBytes(searchMem.deltaBytes).padStart(10)}`)
}

const main = async () => {
    console.log("\n╭─ valdres index/sort/search benchmarks ─────────────╮")
    console.log(`│  runtime: ${typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`}`)
    console.log("╰────────────────────────────────────────────────────╯")

    // Index: compare against legacy at small + medium scale only
    // (legacy explodes at 50K).
    for (const N of [1_000, 10_000]) {
        await runIndexSection(N)
    }

    // Sort + Search: absolute throughput at multiple scales.
    for (const N of [1_000, 10_000, 50_000]) {
        await runSortSection(N)
    }
    for (const N of [1_000, 10_000, 50_000]) {
        await runSearchSection(N)
    }

    console.log("\n")
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
