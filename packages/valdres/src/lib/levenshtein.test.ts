import { describe, expect, test } from "bun:test"
import { levenshtein } from "./levenshtein"

describe("levenshtein", () => {
    test("equal strings → 0", () => {
        expect(levenshtein("hello", "hello", 5)).toBe(0)
        expect(levenshtein("", "", 5)).toBe(0)
    })

    test("single insertion / deletion / substitution → 1", () => {
        expect(levenshtein("cat", "cats", 5)).toBe(1) // insert
        expect(levenshtein("cats", "cat", 5)).toBe(1) // delete
        expect(levenshtein("cat", "cot", 5)).toBe(1) // substitute
    })

    test("transposition counts as 2 in standard Levenshtein", () => {
        // 'ab' ↔ 'ba' — one delete + one insert (or two subs). Standard
        // Levenshtein doesn't have a transposition operator (that's
        // Damerau-Levenshtein).
        expect(levenshtein("ab", "ba", 5)).toBe(2)
    })

    test("returns max+1 sentinel when distance exceeds budget", () => {
        expect(levenshtein("hello", "world", 1)).toBe(2) // 4 edits, max+1=2
        expect(levenshtein("hello", "world", 2)).toBe(3) // 4 edits, max+1=3
        // Within budget — exact value returned
        expect(levenshtein("hello", "hellz", 1)).toBe(1)
    })

    test("length-difference pre-filter short-circuits", () => {
        // 5-char vs 10-char strings differ by at least 5. With max=2 we
        // should bail out before doing any DP work.
        expect(levenshtein("abcde", "0123456789", 2)).toBe(3)
    })

    test("empty string vs non-empty = length", () => {
        expect(levenshtein("", "hello", 5)).toBe(5)
        expect(levenshtein("hello", "", 5)).toBe(5)
    })

    test("typo cases from common search vocab", () => {
        expect(levenshtein("stranger", "strangr", 2)).toBe(1)
        expect(levenshtein("stranger", "stranegr", 2)).toBe(2) // transposition
        expect(levenshtein("running", "ruunning", 2)).toBe(1)
        expect(levenshtein("eternal", "etrnal", 2)).toBe(1)
    })

    test("commutativity (a, b, k) === (b, a, k)", () => {
        const pairs: [string, string, number][] = [
            ["abc", "abcd", 5],
            ["hello world", "hello", 10],
            ["", "x", 5],
        ]
        for (const [a, b, k] of pairs) {
            expect(levenshtein(a, b, k)).toBe(levenshtein(b, a, k))
        }
    })
})
