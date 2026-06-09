import { describe, expect, test } from "bun:test"
import { createBKTree } from "./BKTree"
import { levenshtein } from "./levenshtein"

// Bounded edit distance — the tree decides the cutoff per call.
const dist = (a: string, b: string, max: number) => levenshtein(a, b, max)
// True distance, for the brute-force oracle.
const trueDist = (a: string, b: string) =>
    levenshtein(a, b, Math.max(a.length, b.length))

/** Brute-force oracle: every live word within `k` edits of `query`,
 *  excluding distance 0, as a sorted "word:distance" list for comparison. */
const bruteForce = (
    live: Set<string>,
    query: string,
    k: number,
): string[] => {
    const out: string[] = []
    for (const w of live) {
        const d = trueDist(query, w)
        if (d > 0 && d <= k) out.push(`${w}:${d}`)
    }
    return out.sort()
}

const fromTree = (
    results: { word: string; distance: number }[],
): string[] => results.map(r => `${r.word}:${r.distance}`).sort()

describe("BKTree", () => {
    test("matches brute force on a fixed vocabulary", () => {
        const words = [
            "book",
            "books",
            "boo",
            "cook",
            "cake",
            "cape",
            "boon",
            "back",
            "buck",
            "stranger",
            "strange",
            "strangr",
            "strong",
            "storm",
        ]
        const tree = createBKTree(dist)
        const live = new Set<string>()
        for (const w of words) {
            tree.add(w)
            live.add(w)
        }
        for (const q of ["book", "strange", "cak", "storm", "xyz", "boo"]) {
            for (let k = 0; k <= 3; k++) {
                expect(fromTree(tree.search(q, k))).toEqual(
                    bruteForce(live, q, k),
                )
            }
        }
    })

    test("re-adding a removed word re-activates it (tombstone reuse)", () => {
        const tree = createBKTree(dist)
        tree.add("hello")
        tree.add("hallo")
        expect(tree.size()).toBe(2)
        tree.remove("hallo")
        expect(tree.size()).toBe(1)
        expect(fromTree(tree.search("hello", 1))).toEqual([])
        tree.add("hallo")
        expect(tree.size()).toBe(2)
        expect(fromTree(tree.search("hello", 1))).toEqual(["hallo:1"])
    })

    test("stays correct through heavy add/remove churn (incl. rebuilds)", () => {
        // Deterministic LCG — no Math.random (forbidden in this repo's
        // workflow scripts and avoided here for reproducibility).
        let seed = 0x12345
        const rnd = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0
            return seed / 0x100000000
        }
        const letters = "abcdef"
        const mkWord = () => {
            const len = 3 + Math.floor(rnd() * 5)
            let w = ""
            for (let i = 0; i < len; i++)
                w += letters[Math.floor(rnd() * letters.length)]
            return w
        }
        const tree = createBKTree(dist)
        const refcount = new Map<string, number>()
        const live = new Set<string>()

        const inc = (w: string) => {
            const prev = refcount.get(w) ?? 0
            refcount.set(w, prev + 1)
            if (prev === 0) {
                tree.add(w)
                live.add(w)
            }
        }
        const dec = (w: string) => {
            const next = (refcount.get(w) ?? 0) - 1
            if (next <= 0) {
                refcount.delete(w)
                tree.remove(w)
                live.delete(w)
            } else {
                refcount.set(w, next)
            }
        }

        const seenWords: string[] = []
        for (let step = 0; step < 4000; step++) {
            if (rnd() < 0.6 || seenWords.length === 0) {
                const w = mkWord()
                seenWords.push(w)
                inc(w)
            } else {
                const w = seenWords[Math.floor(rnd() * seenWords.length)]
                dec(w)
            }
            // Spot-check correctness periodically against the oracle.
            if (step % 200 === 0) {
                expect(tree.size()).toBe(live.size)
                const q = mkWord()
                for (let k = 1; k <= 2; k++) {
                    expect(fromTree(tree.search(q, k))).toEqual(
                        bruteForce(live, q, k),
                    )
                }
            }
        }
    })
})
