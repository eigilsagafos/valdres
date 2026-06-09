import { describe, expect, test } from "bun:test"
import { highlightMatches } from "./highlightMatches"
import { simpleEnglishStem } from "./simpleEnglishStem"

const slice = (text: string, ranges: { start: number; end: number }[]) =>
    ranges.map(r => text.slice(r.start, r.end))

describe("highlightMatches", () => {
    test("returns char ranges for matching words (case-insensitive)", () => {
        const text = "The Eternal Stranger"
        const ranges = highlightMatches(text, "stranger")
        expect(ranges).toEqual([{ start: 12, end: 20 }])
        expect(slice(text, ranges)).toEqual(["Stranger"])
    })

    test("multiple words, multiple occurrences, in order", () => {
        const text = "a stranger meets another stranger"
        const ranges = highlightMatches(text, "stranger meets")
        expect(slice(text, ranges)).toEqual([
            "stranger",
            "meets",
            "stranger",
        ])
        // ascending by position
        expect(ranges.map(r => r.start)).toEqual([2, 11, 25])
    })

    test("no match → empty", () => {
        expect(highlightMatches("hello world", "dragon")).toEqual([])
    })

    test("query with only stop words → empty", () => {
        expect(
            highlightMatches("the and of", "the of", { stopWords: true }),
        ).toEqual([])
    })

    test("stemming aligns highlights with stemmed hits", () => {
        const text = "running runs run"
        const ranges = highlightMatches(text, "run", {
            stem: simpleEnglishStem,
        })
        // running / runs / run all stem to "run".
        expect(slice(text, ranges)).toEqual(["running", "runs", "run"])
    })

    test("prefix mode highlights words the query prefixes", () => {
        const text = "apple applesauce apricot banana"
        const ranges = highlightMatches(text, "app", { mode: "prefix" })
        expect(slice(text, ranges)).toEqual(["apple", "applesauce"])
    })

    test("merge combines adjacent matched words into one span", () => {
        const text = "eternal stranger here"
        const unmerged = highlightMatches(text, "eternal stranger")
        expect(unmerged).toHaveLength(2)
        const merged = highlightMatches(text, "eternal stranger", {
            merge: true,
        })
        // Adjacent matched words (only a space between) collapse to one
        // span, separator included: "eternal stranger" → [0, 16).
        expect(merged).toEqual([{ start: 0, end: 16 }])
        expect(slice(text, merged)).toEqual(["eternal stranger"])
    })

    test("merge does not bridge a non-matching word", () => {
        const text = "eternal quiet stranger"
        const merged = highlightMatches(text, "eternal stranger", {
            merge: true,
        })
        // "quiet" sits between the two matches → no bridge.
        expect(slice(text, merged)).toEqual(["eternal", "stranger"])
    })
})
