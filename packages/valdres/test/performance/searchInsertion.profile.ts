/**
 * Coarse-grained profiler for atomFamilySearch bulk insert.
 *
 *   bun run --inspect packages/valdres/test/performance/searchInsertion.profile.ts
 *
 * Prints time spent in each phase (setAtoms loop, propagation, descriptor
 * onWrite, tokenize + extract). Doesn't replace `--prof` but lets us catch
 * regressions and zero in on hot paths without leaving terminal.
 */

;(globalThis as { __valdres_dev_skip_freeze__?: boolean })
    .__valdres_dev_skip_freeze__ = true

import { atomFamily } from "../../src/atomFamily"
import { atomFamilySearch } from "../../src/atomFamilySearch"
import { store } from "../../src/store"

type Doc = { id: string; title: string; body: string }

const makeDocs = (n: number): Doc[] => {
    const out: Doc[] = []
    for (let i = 0; i < n; i++) {
        out.push({
            id: `m-${i}`,
            title: `The Eternal Kingdom of Marco ${i}`,
            body: `Lena investigates the buried truth in Paris while Marco uncovers the stolen manuscript in Berlin. Cairo is hot.`,
        })
    }
    return out
}

const time = <T>(label: string, fn: () => T): T => {
    const t0 = performance.now()
    const out = fn()
    const elapsed = performance.now() - t0
    console.log(`  ${label.padEnd(40)} ${elapsed.toFixed(2)}ms`)
    return out
}

const main = () => {
    const N = 5000
    const docs = makeDocs(N)
    console.log(`profile: N=${N.toLocaleString()} docs`)

    // 1. Baseline: just iterate docs (no valdres at all)
    time("baseline: iterate docs only", () => {
        let acc = ""
        for (const d of docs) acc += d.title
        return acc.length
    })

    // 2. Tokenize + trigram only (no valdres state)
    time("tokenize + trigram only", () => {
        const out: string[] = []
        for (const d of docs) {
            const text = `${d.title} ${d.body}`
            const tokens = text.toLowerCase().split(/\s+/)
            for (const tok of tokens) {
                const padded = `\x00\x00${tok}\x00\x00`
                for (let i = 0; i + 3 <= padded.length; i++) {
                    out.push(padded.slice(i, i + 3))
                }
            }
        }
        return out.length
    })

    // 3. Bare valdres write (no atomFamilySearch)
    time("bare valdres txn write (no index)", () => {
        const s = store()
        const post = atomFamily<Doc, [string]>(null, { name: "doc" })
        s.txn(({ set }) => {
            for (const d of docs) set(post(d.id), d)
        })
    })

    // 3b. Bare valdres write WITHOUT txn (per-set propagation)
    time("bare valdres NO-txn write (no index)", () => {
        const s = store()
        const post = atomFamily<Doc, [string]>(null, { name: "doc" })
        for (const d of docs) s.set(post(d.id), d)
    })

    // 4. With atomFamilySearch exact mode
    time("atomFamilySearch (exact)", () => {
        const s = store()
        const post = atomFamily<Doc, [string]>(null, { name: "doc" })
        atomFamilySearch(post, d => `${d.title} ${d.body}`)
        s.txn(({ set }) => {
            for (const d of docs) set(post(d.id), d)
        })
    })

    // 4b. atomFamilyIndex directly with string-array extractor (mimics
    //     atomFamilySearch's internal pipeline minus tokenize/trigram).
    time("atomFamilyIndex (string-array)", () => {
        // Mimics the bucket-update path with the same term count as
        // trigram but skips tokenize/trigram. Each doc → 150 string keys.
        const s = store()
        const post = atomFamily<Doc, [string]>(null, { name: "doc" })
        const stash: string[][] = []
        for (let i = 0; i < N; i++) {
            const terms: string[] = []
            for (let j = 0; j < 150; j++) terms.push(`term-${j % 50}-${i % 200}`)
            stash.push(terms)
        }
        const { atomFamilyIndex } = require("../../src/atomFamilyIndex")
        atomFamilyIndex(post, (_v: Doc, i = parseInt((_v.id ?? "0").slice(2))) => stash[i] ?? [])
        s.txn(({ set }) => {
            for (const d of docs) set(post(d.id), d)
        })
    })

    // 5. With atomFamilySearch trigram mode
    time("atomFamilySearch (trigram)", () => {
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
    })

    // 6. With atomFamilySearch trigram WITHOUT txn (per-set propagation)
    time("atomFamilySearch (trigram, no txn)", () => {
        const s = store()
        const post = atomFamily<Doc, [string]>(null, { name: "doc" })
        atomFamilySearch(post, d => `${d.title} ${d.body}`, {
            mode: "trigram",
            minMatch: 0.4,
            limit: 25,
        })
        for (const d of docs) s.set(post(d.id), d)
    })
}

main()
