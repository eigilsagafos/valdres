import { describe, expect, test } from "bun:test"
import { atomFamily } from "../atomFamily"
import { store } from "../store"
import { defaultTokenize } from "../utils/defaultTokenize"
import {
    createSearchDescriptor,
    type FieldStats,
} from "./createSearchDescriptor"

type Doc = { id: string; title: string; body: string }
const FIELDS = ["title", "body"] as const

const extract = (d: Doc): Map<string, FieldStats> => {
    const m = new Map<string, FieldStats>()
    for (const f of FIELDS) {
        const tokens = defaultTokenize(d[f])
        if (tokens.length === 0) continue
        const termCounts = new Map<string, number>()
        for (const t of tokens) termCounts.set(t, (termCounts.get(t) ?? 0) + 1)
        m.set(f, { length: tokens.length, termCounts })
    }
    return m
}

const setup = () => {
    const family = atomFamily<Doc, [string]>(null, { name: "p" })
    const added: string[] = []
    const sd = createSearchDescriptor<Doc>(extract, {
        vocab: {
            onTermAdded: t => added.push(`+${t}`),
            onTermRemoved: t => added.push(`-${t}`),
        },
    })
    if (!family.__valdresIndexes) family.__valdresIndexes = new Set()
    family.__valdresIndexes.add(sd.descriptor)
    return { family, sd, vocabLog: added }
}

describe("createSearchDescriptor", () => {
    const lcg = (seed: number) => () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 0x100000000
    }
    const VOCAB = ["alpha","beta","gamma","delta","eps","zeta","rare","common","storm","city"]

    test("buckets + fieldTotals match brute force through random mutations", () => {
        const { family, sd } = setup()
        const s = store()
        const data = (s as unknown as { data: any }).data
        const rnd = lcg(0xbead)
        const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
        const words = (n: number) =>
            Array.from({ length: n }, () => pick(VOCAB)).join(" ")
        const docs = new Map<string, Doc>()

        const storageOf = () => data.values.get(sd.descriptor)
        const bucketIds = (term: string) =>
            s
                .get(sd.termAtom(term))
                .map(a => String(a.familyArgsStringified))
                .sort()
        const oracleBucket = (term: string) =>
            [...docs.entries()]
                .filter(([, d]) =>
                    FIELDS.some(f => defaultTokenize(d[f]).includes(term)),
                )
                .map(([id]) => id)
                .sort()
        const oracleFieldTotal = (field: string) => {
            let len = 0
            let count = 0
            for (const d of docs.values()) {
                const t = defaultTokenize(d[field])
                if (t.length) {
                    len += t.length
                    count += 1
                }
            }
            return { totalLength: len, docCount: count }
        }

        const check = () => {
            for (const term of VOCAB) {
                expect(bucketIds(term)).toEqual(oracleBucket(term))
            }
            const storage = storageOf()
            if (storage) {
                for (const f of FIELDS) {
                    const got = sd.getFieldTotal(storage, f)
                    const want = oracleFieldTotal(f)
                    expect(got.docCount).toBe(want.docCount)
                    expect(got.totalLength).toBe(want.totalLength)
                }
            }
        }

        for (let step = 0; step < 500; step++) {
            const id = `d${Math.floor(rnd() * 30)}`
            if (rnd() < 0.6 || docs.size === 0) {
                const doc: Doc = {
                    id,
                    title: words(1 + Math.floor(rnd() * 3)),
                    body: words(1 + Math.floor(rnd() * 5)),
                }
                docs.set(id, doc)
                s.set(family(id), doc)
            } else {
                const victim = pick([...docs.keys()])
                docs.delete(victim)
                s.del(family(victim))
            }
            if (step % 20 === 0) check()
        }
        check()
        // Vocab refcounts drop to empty once everything is gone.
        s.txn(({ del }) => {
            for (const id of docs.keys()) del(family(id))
        })
        docs.clear()
        check()
        expect(sd.getFieldTotal(storageOf(), "title").docCount).toBe(0)
    })

    test("reactive: subscribed bucket fires and re-reads see new members", () => {
        const { family, sd } = setup()
        const s = store()
        s.set(family("1"), { id: "1", title: "alpha", body: "x" })
        let fires = 0
        s.sub(sd.termAtom("alpha"), () => {
            fires++
        })
        expect(
            s.get(sd.termAtom("alpha")).map(a => String(a.familyArgsStringified)),
        ).toEqual(["1"])
        s.set(family("2"), { id: "2", title: "alpha beta", body: "y" })
        expect(fires).toBeGreaterThan(0)
        expect(
            s
                .get(sd.termAtom("alpha"))
                .map(a => String(a.familyArgsStringified))
                .sort(),
        ).toEqual(["1", "2"])
    })

    test("scope: child sees inherited + overrides; root unaffected", () => {
        const { family, sd } = setup()
        const s = store()
        const ids = (st: ReturnType<typeof store>, term: string) =>
            st
                .get(sd.termAtom(term))
                .map(a => String(a.familyArgsStringified))
                .sort()
        s.set(family("a"), { id: "a", title: "alpha", body: "shared" })
        s.set(family("b"), { id: "b", title: "beta", body: "shared" })
        const child = s.scope("c1")
        child.set(family("b"), { id: "b", title: "gamma", body: "shared" })
        child.set(family("c"), { id: "c", title: "alpha", body: "shared" })

        expect(ids(s, "alpha")).toEqual(["a"])
        expect(ids(child, "alpha")).toEqual(["a", "c"])
        expect(ids(child, "gamma")).toEqual(["b"])
        expect(ids(s, "gamma")).toEqual([])
        expect(ids(s, "shared")).toEqual(["a", "b"])
        expect(ids(child, "shared")).toEqual(["a", "b", "c"])
    })

    test("vocab hooks fire on distinct-term edges", () => {
        const { family, sd, vocabLog } = setup()
        const s = store()
        s.set(family("1"), { id: "1", title: "alpha alpha", body: "beta" })
        // alpha (twice → one add), beta → two distinct adds
        expect(vocabLog.filter(l => l.startsWith("+")).sort()).toEqual([
            "+alpha",
            "+beta",
        ])
        s.del(family("1"))
        expect(vocabLog).toContain("-alpha")
        expect(vocabLog).toContain("-beta")
    })
})
