/**
 * Levenshtein (edit-distance) computation with early termination. Used
 * by `atomFamilySearch`'s `tolerance` option to find indexed tokens
 * within K edits of a query token.
 *
 * Optimized for the typical search use case where we're testing many
 * indexed tokens against one query token and bailing out as soon as
 * we exceed the allowed budget. Two key wins:
 *
 *  1. **Length pre-filter**: if `|a.length - b.length| > max`, the
 *     distance is already too large — return `max + 1` without
 *     touching the DP table.
 *  2. **Per-row early exit**: track the row minimum; if every cell
 *     in the row exceeds `max`, no path through this row can finish
 *     under budget.
 *
 * Both make `tolerance: 1` lookups against a 10k-vocab dictionary
 * roughly 5-10× faster than the textbook DP, which is the difference
 * between "feels live" and "noticeable latency" in the demo.
 *
 * Returns the actual distance if ≤ `max`; otherwise `max + 1` as a
 * sentinel meaning "exceeds budget" (don't rely on the exact value
 * past that).
 */
export const levenshtein = (
    a: string,
    b: string,
    max: number,
): number => {
    const la = a.length
    const lb = b.length

    // Length pre-filter: differ by more than `max` characters and
    // distance is at least the length difference.
    const lenDiff = la > lb ? la - lb : lb - la
    if (lenDiff > max) return max + 1

    // Cheap exact-match shortcut. `===` on JS strings is interned-fast
    // for the common case of duplicate tokens in the dictionary.
    if (a === b) return 0

    // Ensure `a` is the shorter string — keeps the per-row work O(min)
    // rather than O(max(la, lb)).
    if (la > lb) {
        return levenshtein(b, a, max)
    }

    // Two rolling rows. `prev` is the previous DP row, `curr` is the
    // one we're computing. After each row we swap roles.
    const prev = new Uint16Array(la + 1)
    const curr = new Uint16Array(la + 1)
    for (let i = 0; i <= la; i++) prev[i] = i

    for (let j = 1; j <= lb; j++) {
        curr[0] = j
        let rowMin = j
        const bj = b.charCodeAt(j - 1)
        for (let i = 1; i <= la; i++) {
            const cost = a.charCodeAt(i - 1) === bj ? 0 : 1
            const v = Math.min(
                curr[i - 1] + 1, // insertion
                prev[i] + 1, // deletion
                prev[i - 1] + cost, // substitution
            )
            curr[i] = v
            if (v < rowMin) rowMin = v
        }
        // No cell in this row is under budget → no completion path can be.
        if (rowMin > max) return max + 1
        // Roll: copy curr into prev. Uint16Array.set is a native memcpy.
        prev.set(curr)
    }

    const result = prev[la]
    return result > max ? max + 1 : result
}
