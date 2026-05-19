/**
 * Focused bulk-insertion benchmark for atomFamilySearch in trigram mode,
 * compared against MiniSearch / FlexSearch / Fuse.js / Orama. Mirrors the
 * config the browser bench page uses so node-side measurements transfer
 * back to that flow.
 *
 *   bun run packages/valdres-bench/test/searchInsertion.compare.ts
 *
 * Knobs at the top of `main()` control corpus size + iteration count.
 */

// Skip valdres' dev-mode deepFreeze — see setValueInData.ts for context.
// This matches what the bench page does and gives an apples-to-apples
// comparison with the other libs (which don't freeze either).
globalThis.__valdres_dev_skip_freeze__ = true

import {
    create as oramaCreate,
    insertMultiple as oramaInsertMultiple,
} from "@orama/orama"
// eslint-disable-next-line @typescript-eslint/no-require-imports
import FlexSearch from "flexsearch"
import Fuse from "fuse.js"
import MiniSearch from "minisearch"
import { atomFamily, atomFamilySearch, store } from "valdres"

const FlexDocument = (FlexSearch as unknown as {
    Document: new (opts: unknown) => { add(doc: unknown): void }
}).Document

type Doc = {
    id: string
    title: string
    body: string
    year: number
    genre: string
}

const TITLE_ADJ = [
    "Eternal", "Silent", "Forgotten", "Crimson", "Hollow", "Stolen",
    "Broken", "Endless", "Distant", "Frozen", "Burning", "Whispering",
    "Last", "First", "Lost", "Hidden", "Ancient", "Wild", "Twisted",
    "Sacred",
]
const TITLE_NOUN = [
    "Heart", "Kingdom", "Dawn", "Garden", "Hour", "Mirror", "Letter",
    "Promise", "Symphony", "Affair", "Voyage", "Empire", "City", "Light",
    "Storm", "Door", "Bridge", "Sword", "Crown", "House",
]
const PEOPLE = [
    "Lena", "Marco", "Otis", "Saoirse", "Yusuf", "Reiko", "Adaeze",
    "Tomek", "Soren", "Inez",
]
const VERBS = [
    "investigates", "uncovers", "races to expose", "must protect",
    "is forced to confront", "agrees to smuggle", "infiltrates",
    "abandons", "obsesses over", "barters with",
]
const PLACES = [
    "Paris", "Tokyo", "Brooklyn", "Berlin", "Cairo", "Marrakech",
    "Reykjavik", "Bombay", "Lisbon", "Saigon",
]
const STAKES = [
    "buried truth", "stolen manuscript", "missing recording",
    "encrypted contract", "abandoned facility", "vanished daughter",
    "doomed shipment", "forgotten promise",
]
const GENRES = [
    "Drama", "Thriller", "Romance", "Mystery", "Sci-Fi", "Crime",
    "Comedy", "Horror", "Adventure", "Noir",
]

const makeRand = (seed: number) => {
    let s = seed >>> 0
    return () => {
        s = ((s * 1664525) | 0) + 1013904223
        return (s >>> 0) / 0x1_0000_0000
    }
}
const pick = <T>(rand: () => number, list: readonly T[]): T =>
    list[Math.floor(rand() * list.length)]

const generateDocs = (n: number): Doc[] => {
    const r = makeRand(0xC0FFEE ^ n)
    const docs: Doc[] = []
    for (let i = 0; i < n; i++) {
        const title = `The ${pick(r, TITLE_ADJ)} ${pick(r, TITLE_NOUN)}`
        const sentences: string[] = []
        for (let j = 0; j < 2 + Math.floor(r() * 2); j++) {
            sentences.push(
                `${pick(r, PEOPLE)} ${pick(r, VERBS)} the ${pick(r, STAKES)} in ${pick(r, PLACES)}.`,
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

const fmt = (ms: number) =>
    ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(1)}ms`

type Result = { name: string; ms: number }

const time = async (
    name: string,
    iter: number,
    fn: () => unknown | Promise<unknown>,
): Promise<Result> => {
    // Warmup
    await fn()
    if (typeof Bun !== "undefined") Bun.gc(true)
    const times: number[] = []
    for (let i = 0; i < iter; i++) {
        if (typeof Bun !== "undefined") Bun.gc(true)
        const t0 = performance.now()
        await fn()
        times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]
    return { name, ms: median }
}

const buildValdresTrigram = (docs: Doc[]) => {
    const s = store()
    const post = atomFamily<Doc, [string]>(null, { name: "doc" })
    atomFamilySearch(post, d => `${d.title} ${d.body}`, {
        mode: "trigram",
        minMatch: 0.4,
        limit: 25,
    })
    s.txn(({ set }) => {
        for (const d of docs) set(post(d.id), d)
    })
}

const buildValdresTrigramNoTxn = (docs: Doc[]) => {
    const s = store()
    const post = atomFamily<Doc, [string]>(null, { name: "doc" })
    atomFamilySearch(post, d => `${d.title} ${d.body}`, {
        mode: "trigram",
        minMatch: 0.4,
        limit: 25,
    })
    for (const d of docs) s.set(post(d.id), d)
}

const buildValdresExact = (docs: Doc[]) => {
    const s = store()
    const post = atomFamily<Doc, [string]>(null, { name: "doc" })
    atomFamilySearch(post, d => `${d.title} ${d.body}`)
    s.txn(({ set }) => {
        for (const d of docs) set(post(d.id), d)
    })
}

const buildMinisearch = (docs: Doc[]) => {
    const ms = new MiniSearch({
        fields: ["title", "body"],
        storeFields: ["id"],
        searchOptions: { fuzzy: 0.2, prefix: true, boost: { title: 2 } },
    })
    ms.addAll(docs)
}

const buildFlexsearch = (docs: Doc[]) => {
    const fx = new FlexDocument({
        tokenize: "forward",
        document: { id: "id", index: ["title", "body"] },
    })
    for (const d of docs) fx.add(d)
}

const buildFuse = (docs: Doc[]) => {
    new Fuse(docs, {
        keys: ["title", "body"],
        threshold: 0.4,
        includeScore: true,
        ignoreLocation: true,
    })
}

const buildOrama = async (docs: Doc[]) => {
    const db = await oramaCreate({
        schema: {
            title: "string",
            body: "string",
            year: "number",
            genre: "string",
        },
    })
    await oramaInsertMultiple(db, docs)
}

const runForSize = async (n: number, iter: number) => {
    const docs = generateDocs(n)
    console.log(`\n━━ corpus size = ${n.toLocaleString()} docs, iter=${iter} ━━`)

    const rows: Result[] = []
    rows.push(await time("valdres (trigram, txn)", iter, () => buildValdresTrigram(docs)))
    rows.push(await time("valdres (trigram, no-txn)", iter, () => buildValdresTrigramNoTxn(docs)))
    rows.push(await time("valdres (exact, txn)", iter, () => buildValdresExact(docs)))
    rows.push(await time("MiniSearch", iter, () => buildMinisearch(docs)))
    rows.push(await time("FlexSearch", iter, () => buildFlexsearch(docs)))
    rows.push(await time("Fuse.js", iter, () => buildFuse(docs)))
    rows.push(await time("Orama", iter, () => buildOrama(docs)))

    const fastest = Math.min(...rows.map(r => r.ms))
    rows.sort((a, b) => a.ms - b.ms)
    for (const r of rows) {
        const ratio = r.ms / fastest
        const tag = ratio < 1.05 ? "fastest" : `${ratio.toFixed(1)}× slower`
        console.log(`  ${r.name.padEnd(22)} ${fmt(r.ms).padStart(10)}  (${tag})`)
    }
}

const main = async () => {
    console.log(`runtime: ${typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`}`)
    const SIZES = [1_000, 5_000]
    const ITER = 5
    for (const n of SIZES) await runForSize(n, ITER)
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
